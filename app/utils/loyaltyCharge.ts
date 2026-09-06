/**
 * Puerto directo de barber/resources/js/loyalty-charge.js — mismo cálculo
 * de "cuánto se cobra realmente" con descuento de nivel + canje de puntos,
 * solo para que el staff vea el desglose antes de cobrar. El backend
 * (LoyaltyService + PaymentService) vuelve a calcular todo de forma
 * autoritativa al procesar el pago; esto nunca mueve dinero por sí mismo.
 */
export interface LoyaltyChargeInput {
  monto: number
  nivelPct: number
  puntosDisponibles: number
  puntosCanjear: number
  propina: number
  usarPremioRifa: boolean
}

export interface LoyaltyChargeResult {
  montoConNivel: number
  maxPuntosCanjeables: number
  descuentoPuntos: number
  total: number
}

export function computeLoyaltyCharge({
  monto,
  nivelPct,
  puntosDisponibles,
  puntosCanjear,
  propina,
  usarPremioRifa,
}: LoyaltyChargeInput): LoyaltyChargeResult {
  const montoNum = Number(monto) || 0
  const propinaNum = Number(propina) || 0

  if (usarPremioRifa) {
    return { montoConNivel: 0, maxPuntosCanjeables: 0, descuentoPuntos: 0, total: propinaNum }
  }

  const montoConNivel = montoNum * (1 - (Number(nivelPct) || 0) / 100)
  const maxPuntosCanjeables = Math.max(0, Math.min(Math.trunc(puntosDisponibles) || 0, Math.floor(montoConNivel * 0.5)))
  const descuentoPuntos = Math.min(Math.trunc(puntosCanjear) || 0, maxPuntosCanjeables)
  const total = Math.max(0, montoConNivel - descuentoPuntos) + propinaNum

  return { montoConNivel, maxPuntosCanjeables, descuentoPuntos, total }
}
