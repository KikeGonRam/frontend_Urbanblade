import { describe, expect, it } from 'vitest'
import { formatMoney, formatShortDate } from '~/utils/format'

/* Auditoría UI/UX A-03 y A-05: un solo formato de moneda y de fecha en toda la interfaz. */
describe('formatMoney', () => {
  it('usa separador de miles y dos decimales', () => {
    expect(formatMoney(2690)).toBe('$2,690.00')
    expect(formatMoney('10800')).toBe('$10,800.00')
    expect(formatMoney(150)).toBe('$150.00')
  })

  it('admite cifras redondas sin decimales', () => {
    expect(formatMoney(5400, 0)).toBe('$5,400')
  })

  it('trata vacío y valores no numéricos como cero', () => {
    expect(formatMoney(null)).toBe('$0.00')
    expect(formatMoney(undefined)).toBe('$0.00')
    expect(formatMoney('abc')).toBe('$0.00')
  })
})

describe('formatShortDate', () => {
  it('muestra el día local de una fecha sin hora, sin desfase de zona', () => {
    expect(formatShortDate('2026-11-02')).toBe('2 nov 2026')
    expect(formatShortDate('2026-10-28')).toBe('28 oct 2026')
  })

  it('devuelve una raya si no hay fecha válida', () => {
    expect(formatShortDate(null)).toBe('—')
    expect(formatShortDate('no-es-fecha')).toBe('—')
  })
})
