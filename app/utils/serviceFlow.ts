/*
 * Flujo de citas V2 en las pantallas: tiempo restante del servicio en curso, minutos que se pueden agregar y forma del
 * ticket que devuelve el backend al terminar. Funciones puras (sin Vue ni red) para poder probarlas aparte.
 */

/** Minutos que el barbero puede agregar de una vez (coinciden con config/appointments.php del backend). */
export const EXTEND_OPTIONS = [10, 15] as const

export interface ServiceTicket {
  folio: string
  cita: string | null
  fecha: string | null
  cliente: string | null
  barbero: string | null
  servicio: string | null
  duracion_min: number
  minutos_extra: number
  metodo_pago: string | null
  precio_servicio: number
  descuentos: number
  deposito_aplicado: number
  monto: number
  propina: number
  total_pagado: number
  comprobante_url: string | null
}

/** Minutos que faltan para `finIso` (negativo si ya se pasó); null si no hay fin estimado válido. */
export function minutesLeft(finIso: string | null | undefined, now: Date = new Date()): number | null {
  if (!finIso) return null
  const end = Date.parse(finIso)
  if (Number.isNaN(end)) return null
  return Math.ceil((end - now.getTime()) / 60000)
}

/** Texto corto para la tarjeta del servicio en curso: «Quedan 12 min», «Termina en 1 min», «Se pasó 3 min». */
export function remainingLabel(minutes: number | null): string {
  if (minutes === null) return 'Sin hora de fin'
  if (minutes > 1) return `Quedan ${minutes} min`
  if (minutes === 1) return 'Termina en 1 min'
  if (minutes === 0) return 'Termina ahora'
  return `Se pasó ${Math.abs(minutes)} min`
}

/** Estado visual del contador: normal, por terminar (≤5 min) o pasado. */
export function remainingTone(minutes: number | null): 'ok' | 'soon' | 'over' {
  if (minutes === null || minutes > 5) return 'ok'
  return minutes >= 0 ? 'soon' : 'over'
}

/** Mensaje del backend (`message`) dentro de un error de `$fetch`, o el texto de respaldo. */
export function apiMessage(err: unknown, fallback: string): string {
  const message = (err as { data?: { message?: unknown } } | null)?.data?.message
  return typeof message === 'string' && message.trim() !== '' ? message : fallback
}

/** ¿El 422 de «agregar tiempo» permite confirmar y extender de todos modos (choca con la siguiente cita)? */
export function canForceExtend(err: unknown): boolean {
  return (err as { data?: { puede_forzar?: unknown } } | null)?.data?.puede_forzar === true
}

/** Formato de dinero en pesos mexicanos para tickets y adeudos. */
export function money(value: number | string | null | undefined): string {
  const amount = Number(value ?? 0)
  return `$${(Number.isFinite(amount) ? amount : 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
