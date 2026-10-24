import { describe, expect, it } from 'vitest'
import { computeLoyaltyCharge } from '~/utils/loyaltyCharge'
import { appointmentStatus } from '~/utils/appointmentStatus'

/*
 * T086: servicios de lógica del cliente web que no dependen de pantalla ni de red. El cálculo de lealtad es solo
 * un adelanto para el personal: el backend vuelve a calcular el cobro de forma autoritativa.
 */
describe('cálculo del cobro con lealtad', () => {
  const base = { monto: 500, nivelPct: 10, puntosDisponibles: 300, puntosCanjear: 0, propina: 0, usarPremioRifa: false }

  it('aplica el descuento del nivel al monto', () => {
    const r = computeLoyaltyCharge(base)

    expect(r.montoConNivel).toBe(450)
    expect(r.total).toBe(450)
  })

  it('canjea los puntos pedidos como descuento', () => {
    const r = computeLoyaltyCharge({ ...base, puntosCanjear: 100 })

    expect(r.descuentoPuntos).toBe(100)
    expect(r.total).toBe(350)
  })

  it('no deja canjear más de la mitad del monto con nivel', () => {
    const r = computeLoyaltyCharge({ ...base, puntosCanjear: 400 })

    expect(r.maxPuntosCanjeables).toBe(225)
    expect(r.descuentoPuntos).toBe(225)
    expect(r.total).toBe(225)
  })

  it('no deja canjear más puntos de los que la persona tiene', () => {
    const r = computeLoyaltyCharge({ ...base, puntosDisponibles: 50, puntosCanjear: 200 })

    expect(r.maxPuntosCanjeables).toBe(50)
    expect(r.descuentoPuntos).toBe(50)
  })

  it('suma la propina al total sin descontarla', () => {
    const r = computeLoyaltyCharge({ ...base, puntosCanjear: 100, propina: 50 })

    expect(r.total).toBe(400)
  })

  it('con el premio de la rifa solo se cobra la propina', () => {
    const r = computeLoyaltyCharge({ ...base, puntosCanjear: 100, propina: 30, usarPremioRifa: true })

    expect(r).toEqual({ montoConNivel: 0, maxPuntosCanjeables: 0, descuentoPuntos: 0, total: 30 })
  })

  it('trata valores vacíos o no numéricos como cero', () => {
    const r = computeLoyaltyCharge({ ...base, monto: Number.NaN, nivelPct: Number.NaN, propina: Number.NaN })

    expect(r.total).toBe(0)
  })
})

describe('etiqueta y tono de los estados de cita', () => {
  it.each([
    ['pendiente', 'Pendiente', 'warning'],
    ['confirmada', 'Confirmada', 'info'],
    ['en_proceso', 'En proceso', 'gold'],
    ['completada', 'Completada', 'success'],
    ['cancelada', 'Cancelada', 'danger'],
    ['no_asistio', 'No asistió', 'neutral'],
  ])('%s se muestra como «%s» con tono %s', (estado, label, tone) => {
    expect(appointmentStatus(estado)).toEqual({ label, tone })
  })

  it('un estado desconocido se muestra tal cual y en tono neutro', () => {
    expect(appointmentStatus('reprogramada')).toEqual({ label: 'reprogramada', tone: 'neutral' })
  })

  it('sin estado muestra «Sin estado»', () => {
    expect(appointmentStatus(null)).toEqual({ label: 'Sin estado', tone: 'neutral' })
    expect(appointmentStatus(undefined)).toEqual({ label: 'Sin estado', tone: 'neutral' })
  })
})
