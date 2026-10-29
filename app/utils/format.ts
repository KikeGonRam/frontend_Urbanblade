/*
 * Formatos únicos de la interfaz (auditoría UI/UX, A-03 y A-05): antes cada pantalla armaba su
 * moneda y su fecha, y convivían «$2690.00», «$5400» y «$10,800», o «2026-11-02» y «28 oct 2026».
 */

/** Moneda MXN con separador de miles: $2,690.00 (por defecto 2 decimales; 0 para cifras redondas). */
export function formatMoney(value: number | string | null | undefined, decimals = 2): string {
  const n = Number(value ?? 0)

  return '$' + (Number.isFinite(n) ? n : 0).toLocaleString('es-MX', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

/** Fecha corta «2 nov 2026». Acepta «YYYY-MM-DD» (día local, sin desfase de zona) o una fecha ISO. */
export function formatShortDate(value: string | null | undefined): string {
  if (!value) return '—'
  const soloDia = /^\d{4}-\d{2}-\d{2}$/.test(value)
  const date = new Date(soloDia ? `${value}T00:00:00` : value)
  if (Number.isNaN(date.getTime())) return '—'

  return date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }).replace(/\./g, '')
}
