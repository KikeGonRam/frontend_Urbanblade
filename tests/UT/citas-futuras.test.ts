import { describe, expect, it } from 'vitest'
import { esCitaFutura, motivoBloqueoPorFecha } from '~/utils/citas'

/* UX #14: en una cita confirmada de un día futuro solo «Iniciar» se bloqueaba; Completar y No asistió seguían activos. */
const hoy = new Date(2026, 9, 28, 15, 0)

describe('citas futuras', () => {
  it('reconoce el día de hoy, el pasado y el futuro', () => {
    expect(esCitaFutura('2026-10-28', hoy)).toBe(false)
    expect(esCitaFutura('2026-10-27', hoy)).toBe(false)
    expect(esCitaFutura('2026-11-02', hoy)).toBe(true)
    expect(esCitaFutura(null, hoy)).toBe(false)
  })

  it('bloquea completar y no asistió solo si la cita es futura', () => {
    expect(motivoBloqueoPorFecha('2026-11-02', 'completada', hoy)).not.toBe('')
    expect(motivoBloqueoPorFecha('2026-11-02', 'no_asistio', hoy)).not.toBe('')
    expect(motivoBloqueoPorFecha('2026-10-28', 'completada', hoy)).toBe('')
  })

  it('no bloquea iniciar por fecha (ya lo decide el servidor)', () => {
    expect(motivoBloqueoPorFecha('2026-11-02', 'en_proceso', hoy)).toBe('')
  })
})
