import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import SchedulePage from '~/pages/barber/schedule.vue'

/*
 * Formulario «Mi Horario» del barbero (pages/barber/schedule.vue): días laborales, horas de apertura y cierre,
 * «Aplicar a todos los días», resumen de la semana y guardado. `apiFetch` se simula; el resto es la página real.
 */
const { apiFetch } = vi.hoisted(() => ({ apiFetch: vi.fn() }))
mockNuxtImport('useApi', () => () => ({ apiFetch }))

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
const NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

/** Lunes a viernes de 9 a 19, sábado de 10 a 16 y domingo de descanso. */
function weekFixture() {
  return {
    schedules: DAYS.map((day, i) => ({
      day_of_week: day,
      start_time: i === 5 ? '10:00' : '09:00',
      end_time: i === 5 ? '16:00' : '19:00',
      is_active: i !== 6,
    })),
  }
}

async function mountPage() {
  apiFetch.mockResolvedValueOnce(weekFixture())
  const wrapper = await mountSuspended(SchedulePage)
  await flushPromises()

  return wrapper
}

const summary = (wrapper: Awaited<ReturnType<typeof mountPage>>) => wrapper.get('aside[aria-label="Resumen de tu semana"]')

describe('formulario «Mi Horario»', () => {
  beforeEach(() => {
    apiFetch.mockReset()
  })

  it('muestra los siete días en orden con sus horas y el domingo en descanso', async () => {
    const wrapper = await mountPage()

    const labels = wrapper.findAll('article label').map(l => l.text()).filter(t => NAMES.includes(t))
    expect(labels).toEqual(NAMES)
    expect((wrapper.get('#start-monday').element as HTMLInputElement).value).toBe('09:00')
    expect((wrapper.get('#end-saturday').element as HTMLInputElement).value).toBe('16:00')
    expect(wrapper.get('#start-sunday').attributes('disabled')).toBeDefined()
    expect(wrapper.get('#start-monday').attributes('disabled')).toBeUndefined()
  })

  it('resume la semana: días con atención y horas totales', async () => {
    const wrapper = await mountPage()

    // 5 días de 10 h + un sábado de 6 h = 56 h en 6 días.
    expect(summary(wrapper).text()).toContain('6 de 7')
    expect(summary(wrapper).text()).toContain('56')
  })

  it('al apagar un día se deshabilitan sus horas y baja el resumen', async () => {
    const wrapper = await mountPage()

    await wrapper.get('article:first-of-type button[role="switch"]').trigger('click')

    expect(wrapper.get('#start-monday').attributes('disabled')).toBeDefined()
    expect(wrapper.get('#end-monday').attributes('disabled')).toBeDefined()
    expect(summary(wrapper).text()).toContain('5 de 7')
    expect(summary(wrapper).text()).toContain('46')
  })

  it('«Aplicar a todos los días» repite las horas y el estado de ese día en toda la semana', async () => {
    const wrapper = await mountPage()

    await wrapper.findAll('article:first-of-type button').find(b => b.text() === 'Aplicar a todos los días')!.trigger('click')

    for (const day of DAYS) {
      expect((wrapper.get(`#start-${day}`).element as HTMLInputElement).value).toBe('09:00')
      expect((wrapper.get(`#end-${day}`).element as HTMLInputElement).value).toBe('19:00')
    }
    expect(summary(wrapper).text()).toContain('7 de 7')
    expect(summary(wrapper).text()).toContain('70')
  })

  it('guarda los siete días con las horas en formato HH:MM y avisa que se actualizó', async () => {
    const wrapper = await mountPage()
    await wrapper.get('#end-friday').setValue('20:30')
    apiFetch.mockResolvedValueOnce({})

    await wrapper.get('form').trigger('submit')
    await flushPromises()

    const [url, options] = apiFetch.mock.calls[1]!
    expect(url).toBe('/barber/schedule')
    expect(options.method).toBe('PUT')
    expect(options.body.schedules).toHaveLength(7)
    expect(options.body.schedules[4]).toEqual({ day_of_week: 'friday', start_time: '09:00', end_time: '20:30', is_active: true })
    expect(options.body.schedules[6]).toMatchObject({ day_of_week: 'sunday', is_active: false })
    expect(wrapper.text()).toContain('Horario actualizado correctamente.')
  })

  it('permite una segunda franja por día y la guarda como otra fila', async () => {
    const wrapper = await mountPage()

    await wrapper.findAll('article:first-of-type button').find(b => b.text().includes('Agregar descanso'))!.trigger('click')
    expect(wrapper.find('#start-monday-1').exists()).toBe(true)
    await wrapper.get('#end-monday').setValue('14:00')
    await wrapper.get('#start-monday-1').setValue('16:00')
    await wrapper.get('#end-monday-1').setValue('20:00')
    apiFetch.mockResolvedValueOnce({})

    await wrapper.get('form').trigger('submit')
    await flushPromises()

    const filas = apiFetch.mock.calls[1]![1].body.schedules
    expect(filas).toHaveLength(8)
    expect(filas.slice(0, 2)).toEqual([
      { day_of_week: 'monday', start_time: '09:00', end_time: '14:00', is_active: true },
      { day_of_week: 'monday', start_time: '16:00', end_time: '20:00', is_active: true },
    ])
    // 5 + 4 h del lunes cuentan en el resumen: lunes 9 h, resto igual que antes.
    expect(summary(wrapper).text()).toContain('55')
  })

  it('no ofrece una tercera franja y deja quitar la segunda', async () => {
    const wrapper = await mountPage()
    const primero = () => wrapper.findAll('article:first-of-type button')

    await primero().find(b => b.text().includes('Agregar descanso'))!.trigger('click')
    expect(primero().some(b => b.text().includes('Agregar descanso'))).toBe(false)

    await primero().find(b => b.text() === 'Quitar')!.trigger('click')
    expect(wrapper.find('#start-monday-1').exists()).toBe(false)
  })

  it('muestra el motivo del servidor si no se pudo guardar y deja el botón disponible', async () => {
    const wrapper = await mountPage()
    apiFetch.mockRejectedValueOnce({ data: { message: 'La hora de cierre debe ser posterior a la de apertura.' } })

    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(wrapper.text()).toContain('La hora de cierre debe ser posterior a la de apertura.')
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeUndefined()
    expect(wrapper.text()).toContain('Guardar horario')
  })

  it('si no carga el horario ofrece reintentar en lugar de mostrar el formulario', async () => {
    apiFetch.mockRejectedValueOnce(new Error('sin red'))

    const wrapper = await mountSuspended(SchedulePage)
    await flushPromises()

    expect(wrapper.text()).toContain('No se pudo cargar tu horario')
    expect(wrapper.find('form').exists()).toBe(false)
  })
})
