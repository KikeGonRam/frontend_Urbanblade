import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import ServicesPage from '~/pages/services/index.vue'

/*
 * T090 (HT-28): formulario de servicio de la administración (pages/services/index.vue), con enfoque de caja negra.
 *
 * Caso: «Campos obligatorios y mensajes del formulario de servicio». Comprueba RF-05 (Administración de servicios) y
 * RNF-20 (Validación de formularios). Integración simulada: la página, el formulario y sus componentes son los reales;
 * solo `apiFetch` se cambia por una API falsa que valida igual que barber (ServiceManagementController::store con los
 * mensajes de lang/es/validation.php).
 *
 * Particiones: formulario vacío (el navegador no lo envía), formulario vacío que llega al servidor (un mensaje bajo
 * cada campo y no se guarda) y formulario lleno (se envía el guardado con los datos escritos).
 */
const { apiFetch } = vi.hoisted(() => ({ apiFetch: vi.fn() }))
mockNuxtImport('useApi', () => () => ({ apiFetch }))

/*
 * happy-dom 21 revisa el `step` de los campos numéricos con el resto de punto flotante (`220 % 0.01 !== 0`), así que
 * marca como inválido un precio de $220 con step="0.01". Los navegadores siguen el estándar HTML, que hace esa cuenta
 * en decimal: en Chrome 220 es válido. Solo para este archivo se cambia esa regla por la del estándar, para que el
 * botón «Guardar servicio» valide igual que en el navegador real. Las demás reglas (required, min, max) no se tocan.
 */
Object.defineProperty(ValidityState.prototype, 'stepMismatch', {
  configurable: true,
  get(this: { element: HTMLInputElement }) {
    const campo = this.element
    if (campo.localName !== 'input' || !['number', 'range'].includes(campo.type) || campo.value === '') return false
    const paso = campo.getAttribute('step')
    if (paso === 'any') return false
    const base = campo.hasAttribute('min') ? Number(campo.getAttribute('min')) : 0
    const pasos = (Number(campo.value) - base) / (paso === null ? 1 : Number(paso))

    return Math.abs(pasos - Math.round(pasos)) > 1e-9
  },
})

interface Servicio {
  id: string
  slug: string
  nombre: string
  categoria: string
  precio: number
  duracion_min: number
  descripcion: string | null
  imagen: string | null
  imagen_url: string | null
  activo: boolean
}

/** Campos obligatorios del formulario, con el mensaje que barber devuelve cuando faltan. */
const OBLIGATORIOS = [
  { campo: '#service-nombre', clave: 'nombre', mensaje: 'El campo nombre es obligatorio.' },
  { campo: '#service-categoria', clave: 'categoria', mensaje: 'El campo categoría es obligatorio.' },
  { campo: '#service-precio', clave: 'precio', mensaje: 'El campo precio es obligatorio.' },
  { campo: '#service-duracion', clave: 'duracion_min', mensaje: 'El campo duracion min es obligatorio.' },
]

let catalogo: Servicio[] = []

// ── API falsa: responde como barber ──────────────────────────────────────────────────────────────────────────────

function apiFalsa(url: string, opciones: { method?: string; body?: FormData } = {}) {
  if (url === '/services/manage' && opciones.method === 'POST') return guardar(opciones.body!)
  if (url === '/services/manage') {
    return Promise.resolve({
      data: [...catalogo],
      meta: { current_page: 1, last_page: 1, total: catalogo.length },
      categories: ['Cortes', 'Barba'],
    })
  }

  return Promise.resolve({ data: [] })
}

/**
 * Igual que ServiceManagementController::store: Laravel recorta los textos (un campo vacío llega como null), valida y,
 * si algo falla, responde 422 con un mensaje por campo y el resumen «primer error (and N more errors)».
 */
function guardar(body: FormData) {
  const valor = (clave: string) => String(body.get(clave) ?? '').trim()
  const errors: Record<string, string[]> = {}
  for (const { clave, mensaje } of OBLIGATORIOS) {
    if (!valor(clave)) errors[clave] = [mensaje]
  }
  if (!errors.precio && (Number.isNaN(Number(valor('precio'))) || Number(valor('precio')) < 0)) {
    errors.precio = ['El campo precio debe ser al menos 0.']
  }
  const duracion = Number(valor('duracion_min'))
  if (!errors.duracion_min && (!Number.isInteger(duracion) || duracion < 5 || duracion > 600)) {
    errors.duracion_min = ['El campo duracion min debe estar entre 5 y 600.']
  }

  const mensajes = Object.values(errors).flat()
  if (mensajes.length) {
    const resto = mensajes.length - 1
    const message = resto ? `${mensajes[0]} (and ${resto} more error${resto === 1 ? '' : 's'})` : mensajes[0]

    return Promise.reject(Object.assign(new Error('Unprocessable Content'), { statusCode: 422, data: { message, errors } }))
  }

  const nuevo: Servicio = {
    id: `s-${catalogo.length + 1}`,
    slug: valor('nombre').toLowerCase().replace(/\s+/g, '-'),
    nombre: valor('nombre'),
    categoria: valor('categoria'),
    precio: Number(valor('precio')),
    duracion_min: duracion,
    descripcion: valor('descripcion') || null,
    imagen: null,
    imagen_url: null,
    activo: valor('activo') === '1',
  }
  catalogo.push(nuevo)

  return Promise.resolve({ message: 'Servicio creado correctamente.', data: nuevo })
}

// ── Cómo se usa el formulario (como lo haría el administrador) ───────────────────────────────────────────────────

let montada: { unmount: () => void } | undefined

/** Monta la página dentro del documento, como en el navegador: solo así el botón «Guardar servicio» envía el form. */
async function abrirFormulario() {
  const wrapper = await mountSuspended(ServicesPage, { attachTo: document.body })
  montada = wrapper
  await flushPromises()
  await boton(wrapper, '+ Nuevo Servicio').trigger('click')

  return wrapper
}

type Pagina = Awaited<ReturnType<typeof abrirFormulario>>

const boton = (wrapper: Pagina, texto: string) => wrapper.findAll('button').find(b => b.text() === texto)!
const formulario = (wrapper: Pagina) => wrapper.find('[role="dialog"][aria-label="Formulario de servicio"]')
/** Lo que se ve alrededor de un campo: su etiqueta, el campo y el mensaje en rojo debajo, si lo hay. */
const zonaDe = (wrapper: Pagina, campo: string) => wrapper.get(campo).element.parentElement!.textContent ?? ''

async function vaciarObligatorios(wrapper: Pagina) {
  for (const { campo } of OBLIGATORIOS) await wrapper.get(campo).setValue('')
}

const guardados = () => apiFetch.mock.calls.filter(([url, o]) => url === '/services/manage' && o?.method === 'POST')
const consultasDeLaLista = () => apiFetch.mock.calls.filter(([url, o]) => url === '/services/manage' && !o?.method)

// ── Casos de prueba ─────────────────────────────────────────────────────────────────────────────────────────────

describe('formulario de servicio: campos obligatorios y mensajes', () => {
  beforeEach(() => {
    catalogo = [
      {
        id: 's-1',
        slug: 'corte-clasico',
        nombre: 'Corte clásico',
        categoria: 'Cortes',
        precio: 150,
        duracion_min: 30,
        descripcion: null,
        imagen: null,
        imagen_url: null,
        activo: true,
      },
    ]
    apiFetch.mockReset()
    apiFetch.mockImplementation(apiFalsa)
  })

  afterEach(() => {
    montada?.unmount()
    montada = undefined
  })

  it('vacío: el navegador marca cada campo obligatorio con su mensaje y no envía el guardado', async () => {
    const wrapper = await abrirFormulario()
    await vaciarObligatorios(wrapper)

    await boton(wrapper, 'Guardar servicio').trigger('click')
    await flushPromises()

    for (const { campo } of OBLIGATORIOS) {
      const entrada = wrapper.get(campo).element as HTMLInputElement
      expect(entrada.validity.valueMissing, campo).toBe(true)
      expect(entrada.validationMessage, campo).not.toBe('')
    }
    expect(guardados()).toHaveLength(0)
    expect(formulario(wrapper).exists()).toBe(true)
  })

  it('vacío que llega al servidor: un mensaje bajo cada campo y no se guarda', async () => {
    const wrapper = await abrirFormulario()
    await vaciarObligatorios(wrapper)

    // El formulario llega a la API sin pasar por la validación del navegador; barber lo rechaza campo por campo.
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    for (const { campo, mensaje } of OBLIGATORIOS) {
      expect(zonaDe(wrapper, campo).split(mensaje).length - 1, `un solo mensaje bajo ${campo}`).toBe(1)
    }
    expect(formulario(wrapper).exists()).toBe(true)
    expect(consultasDeLaLista()).toHaveLength(1)
    expect(catalogo).toHaveLength(1)
  })

  it('lleno: se envía el guardado con los datos escritos y el servicio aparece en el catálogo', async () => {
    const wrapper = await abrirFormulario()
    await wrapper.get('#service-nombre').setValue('Corte degradado')
    await wrapper.get('#service-categoria').setValue('Cortes')
    await wrapper.get('#service-precio').setValue('220')
    await wrapper.get('#service-duracion').setValue('45')
    await wrapper.get('#service-descripcion').setValue('Degradado con navaja y acabado a tijera.')

    await boton(wrapper, 'Guardar servicio').trigger('click')
    await flushPromises()

    expect(guardados()).toHaveLength(1)
    const datos = Object.fromEntries((guardados()[0]![1].body as FormData).entries())
    expect(datos).toEqual({
      nombre: 'Corte degradado',
      categoria: 'Cortes',
      precio: '220',
      duracion_min: '45',
      descripcion: 'Degradado con navaja y acabado a tijera.',
      activo: '1',
    })
    expect(formulario(wrapper).exists()).toBe(false)
    expect(consultasDeLaLista()).toHaveLength(2)
    expect(wrapper.text()).toContain('Corte degradado')
  })
})
