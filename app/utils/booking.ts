/** Utilidades de formato del asistente de reserva. */

export function bookingCurrency(n: number): string {
  return `$${Math.round(n).toLocaleString('es-MX')}`
}

export function bookingPrettyDate(iso: string): string {
  // Sin guarda, un iso vacío produce "Invalid Date" visible en pantalla.
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return ''

  return new Date(y, m - 1, d).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })
}

// Fechas armadas en horario local, nunca con toISOString(): el backend valida
// 'after_or_equal:today' contra America/Mexico_City, y en UTC-6 el ISO de
// "hoy por la noche" ya cae en mañana.
export function bookingLocalISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function bookingSlotMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}
