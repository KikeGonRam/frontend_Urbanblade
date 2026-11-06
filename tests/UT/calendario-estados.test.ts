import { describe, expect, it } from 'vitest'
import { APPOINTMENT_STATUS, appointmentEventClasses } from '~/utils/appointmentStatus'

/* Auditoría UX del 6-nov-2026: el calendario pinta cada cita con el tono de su estado, no con el color del backend. */
describe('clases de una cita en el calendario', () => {
  it('cada estado lleva el tono de su insignia', () => {
    for (const [estado, { tone }] of Object.entries(APPOINTMENT_STATUS)) {
      expect(appointmentEventClasses(estado)).toContain(`ub-ev--${tone}`)
    }
  })

  it('las citas que ya no ocurrirán se marcan como apagadas y las demás no', () => {
    expect(appointmentEventClasses('cancelada')).toContain('ub-ev--apagada')
    expect(appointmentEventClasses('no_asistio')).toContain('ub-ev--apagada')
    expect(appointmentEventClasses('confirmada')).not.toContain('ub-ev--apagada')
  })

  it('un estado desconocido cae en el tono neutro sin romper', () => {
    expect(appointmentEventClasses(undefined)).toEqual(['ub-ev', 'ub-ev--neutral'])
  })
})
