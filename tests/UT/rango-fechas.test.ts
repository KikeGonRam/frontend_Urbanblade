import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import DateRange from '~/components/ui/DateRange.vue'
import { ordenarRango, rangoPreset } from '~/utils/dateRange'

/* Auditoría UI/UX A-07: selector de rango con atajos en lugar de dos campos nativos sueltos. */
const jueves = new Date(2026, 9, 29, 15, 30) // 29 oct 2026

describe('atajos de rango', () => {
  it('calcula hoy, los últimos 7 días y el mes en curso', () => {
    expect(rangoPreset('hoy', jueves)).toEqual({ desde: '2026-10-29', hasta: '2026-10-29' })
    expect(rangoPreset('7dias', jueves)).toEqual({ desde: '2026-10-23', hasta: '2026-10-29' })
    expect(rangoPreset('mes', jueves)).toEqual({ desde: '2026-10-01', hasta: '2026-10-29' })
  })

  it('cruza el cambio de mes sin errores', () => {
    expect(rangoPreset('7dias', new Date(2026, 10, 3))).toEqual({ desde: '2026-10-28', hasta: '2026-11-03' })
  })

  it('intercambia un rango invertido y respeta uno vacío o correcto', () => {
    expect(ordenarRango('2026-10-29', '2026-10-01')).toEqual({ desde: '2026-10-01', hasta: '2026-10-29' })
    expect(ordenarRango('2026-10-01', '2026-10-29')).toEqual({ desde: '2026-10-01', hasta: '2026-10-29' })
    expect(ordenarRango('', '2026-10-29')).toEqual({ desde: '', hasta: '2026-10-29' })
  })
})

describe('componente DateRange', () => {
  it('un atajo rellena los dos campos y queda marcado', async () => {
    const wrapper = await mountSuspended(DateRange, { props: { from: '', to: '' } })

    await wrapper.findAll('button').find(b => b.text() === 'Hoy')!.trigger('click')

    const emitidos = wrapper.emitted('update:from')!.at(-1)![0] as string
    expect(emitidos).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(wrapper.emitted('update:to')!.at(-1)![0]).toBe(emitidos)
  })

  it('conserva las etiquetas accesibles de los campos', async () => {
    const wrapper = await mountSuspended(DateRange, { props: { from: '', to: '', fromLabel: 'Desde', toLabel: 'Hasta' } })

    expect(wrapper.find('input[aria-label="Desde"]').exists()).toBe(true)
    expect(wrapper.find('input[aria-label="Hasta"]').exists()).toBe(true)
  })
})
