import { describe, expect, it } from 'vitest'
import { reservaPendienteDeRedireccion } from '~/utils/citas'

/* UX #4: el inicio de sesión no recordaba la reserva que la persona estaba confirmando. */
describe('reserva pendiente en el inicio de sesión', () => {
  it('lee fecha y hora del redirect a /reservar', () => {
    expect(reservaPendienteDeRedireccion('/reservar?servicio=s1&barbero=b1&fecha=2026-11-02&hora=16:00:00')).toEqual({ fecha: '2026-11-02', hora: '16:00' })
  })

  it('ignora otros destinos y datos incompletos o raros', () => {
    expect(reservaPendienteDeRedireccion('/dashboard')).toBeNull()
    expect(reservaPendienteDeRedireccion('/reservar?servicio=s1')).toBeNull()
    expect(reservaPendienteDeRedireccion('/reservar?fecha=<script>&hora=x')).toBeNull()
    expect(reservaPendienteDeRedireccion(undefined)).toBeNull()
  })
})
