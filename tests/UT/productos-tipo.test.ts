import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { DOMWrapper, enableAutoUnmount, flushPromises } from '@vue/test-utils'
import { clearNuxtData } from '#imports'
import ProductsPage from '~/pages/inventory/products/index.vue'

/*
 * Tipo de producto (pages/inventory/products/index.vue): el valor que envía el formulario y las etiquetas de la
 * tabla y los filtros. La API (barber) solo acepta venta_cliente, insumo_trabajo y los antiguos venta y
 * uso_interno. `apiFetch` se simula; el resto es la página real.
 */
const { apiFetch } = vi.hoisted(() => ({ apiFetch: vi.fn() }))
mockNuxtImport('useApi', () => () => ({ apiFetch }))

enableAutoUnmount(afterEach)

const product = (id: string, tipo: string) => ({
  id,
  nombre: `Producto ${id}`,
  categoria: 'Insumos',
  descripcion: null,
  precio_compra: 10,
  precio_venta: 20,
  stock_actual: 8,
  stock_minimo: 2,
  tipo,
  activo: true,
})

async function mountPage(tipos: string[] = []) {
  const filas = tipos.map((t, i) => product(String(i + 1), t))
  apiFetch.mockImplementation(async (url: string) =>
    url === '/inventory/products'
      ? {
          data: filas,
          meta: {
            current_page: 1,
            last_page: 1,
            total: filas.length,
            stats: { total: filas.length, valor_total: 0, bajo_stock: 0 },
            categorias: ['Insumos'],
            tipos,
          },
        }
      : { data: [] },
  )
  const wrapper = await mountSuspended(ProductsPage)
  await flushPromises()

  return wrapper
}

/* El panel del formulario se teletransporta a <body>. */
const inBody = <T extends Element>(selector: string) => new DOMWrapper(document.body.querySelector<T>(selector)!)
const tipoSelect = () => inBody<HTMLSelectElement>('#prod-tipo')

async function submitAndGetBody() {
  await inBody<HTMLFormElement>('#product-form').trigger('submit')
  await flushPromises()
  const call = apiFetch.mock.calls.find(([, options]) => options?.method === 'POST')!

  return call[1].body as FormData
}

describe('tipo de producto en el inventario', () => {
  beforeEach(() => {
    apiFetch.mockReset()
    clearNuxtData()
  })

  it('al elegir «Insumo interno de barbería» envía insumo_trabajo', async () => {
    const wrapper = await mountPage()
    await wrapper.findAll('button').find(b => b.text() === '+ Nuevo Producto')!.trigger('click')

    const insumo = tipoSelect().findAll('option').find(o => o.text() === 'Insumo interno de barbería')!
    await tipoSelect().setValue(insumo.element.value)
    const body = await submitAndGetBody()

    expect(body.get('tipo')).toBe('insumo_trabajo')
  })

  it.each([
    ['venta_cliente', 'Venta'],
    ['venta', 'Venta'],
    ['insumo_trabajo', 'Insumo'],
    ['uso_interno', 'Insumo'],
  ])('muestra el tipo %s como «%s» en la tabla y en el filtro', async (tipo, etiqueta) => {
    const wrapper = await mountPage([tipo])

    expect(wrapper.get('tbody').text()).toContain(etiqueta)
    const chips = wrapper.findAll('fieldset').find(f => f.text().includes('Filtrar por tipo'))!
    expect(chips.findAll('button').map(b => b.text())).toEqual(['Todos', etiqueta])
  })

  it.each([
    ['venta', 'venta_cliente'],
    ['uso_interno', 'insumo_trabajo'],
    ['insumo_trabajo', 'insumo_trabajo'],
  ])('al editar un producto %s deja seleccionado %s y lo envía así', async (guardado, esperado) => {
    const wrapper = await mountPage([guardado])
    await wrapper.get('button[aria-label="Editar Producto 1"]').trigger('click')

    expect((tipoSelect().element as HTMLSelectElement).value).toBe(esperado)
    expect((await submitAndGetBody()).get('tipo')).toBe(esperado)
  })
})
