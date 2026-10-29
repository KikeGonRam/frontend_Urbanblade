import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import DataTable from '~/components/ui/DataTable.vue'

/* Auditoría UI/UX A-06: una sola tabla con encabezado fijo, orden, carga, vacío y tarjetas en móvil. */
const columns = [
  { key: 'nombre', label: 'Nombre', sortable: true },
  { key: 'total', label: 'Total', align: 'right', sortable: true },
] as const
const rows = [
  { id: 'a', nombre: 'Bruno', total: 300 },
  { id: 'b', nombre: 'Ana', total: 1200 },
  { id: 'c', nombre: 'Carla', total: 90 },
]
const nombres = (wrapper: Awaited<ReturnType<typeof mountSuspended>>) => wrapper.findAll('tbody tr').map(tr => tr.find('td').text())

describe('tabla común', () => {
  it('pinta encabezados, filas y etiquetas por celda para el modo tarjeta', async () => {
    const wrapper = await mountSuspended(DataTable, { props: { columns: [...columns], rows, ariaLabel: 'Pedidos' } })

    expect(wrapper.get('table').attributes('aria-label')).toBe('Pedidos')
    expect(wrapper.findAll('th').map(th => th.text().replace(/[↕▲▼]/g, '').trim())).toEqual(['Nombre', 'Total'])
    expect(nombres(wrapper)).toEqual(['Bruno', 'Ana', 'Carla'])
    expect(wrapper.find('td').attributes('data-label')).toBe('Nombre')
  })

  it('ordena por columna y alterna ascendente, descendente y sin orden', async () => {
    const wrapper = await mountSuspended(DataTable, { props: { columns: [...columns], rows, ariaLabel: 'Pedidos' } })
    const botonNombre = () => wrapper.findAll('thead button').find(b => b.text().startsWith('Nombre'))!

    await botonNombre().trigger('click')
    expect(nombres(wrapper)).toEqual(['Ana', 'Bruno', 'Carla'])
    expect(wrapper.findAll('th')[0]!.attributes('aria-sort')).toBe('ascending')

    await botonNombre().trigger('click')
    expect(nombres(wrapper)).toEqual(['Carla', 'Bruno', 'Ana'])

    await botonNombre().trigger('click')
    expect(nombres(wrapper)).toEqual(['Bruno', 'Ana', 'Carla'])
  })

  it('ordena numéricamente, no como texto', async () => {
    const wrapper = await mountSuspended(DataTable, { props: { columns: [...columns], rows, ariaLabel: 'Pedidos' } })

    await wrapper.findAll('thead button').find(b => b.text().startsWith('Total'))!.trigger('click')

    expect(wrapper.findAll('tbody tr').map(tr => tr.findAll('td')[1]!.text())).toEqual(['90', '300', '1200'])
  })

  it('muestra el esqueleto al cargar y el vacío sin filas', async () => {
    const cargando = await mountSuspended(DataTable, { props: { columns: [...columns], rows, ariaLabel: 'Pedidos', loading: true } })
    expect(cargando.find('table').exists()).toBe(false)
    expect(cargando.find('[role="status"]').exists()).toBe(true)

    const vacia = await mountSuspended(DataTable, { props: { columns: [...columns], rows: [], ariaLabel: 'Pedidos', emptyTitle: 'Sin pedidos' } })
    expect(vacia.find('table').exists()).toBe(false)
    expect(vacia.text()).toContain('Sin pedidos')
  })

  it('agrega la columna de acciones solo si hay ranura', async () => {
    const wrapper = await mountSuspended(DataTable, {
      props: { columns: [...columns], rows, ariaLabel: 'Pedidos' },
      slots: { actions: '<button>Abrir</button>' },
    })

    expect(wrapper.findAll('th').map(th => th.text())).toContain('Acciones')
    expect(wrapper.findAll('tbody button')).toHaveLength(3)
  })
})
