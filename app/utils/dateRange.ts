/*
 * Atajos del selector de rango de fechas (auditoría UI/UX A-07). Las fechas viajan como «YYYY-MM-DD» en hora local,
 * que es lo que entregan y esperan los campos de fecha y la API.
 */
export type RangoPreset = 'hoy' | '7dias' | 'mes'

export interface Rango {
  desde: string
  hasta: string
}

function ymd(fecha: Date): string {
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  const dia = String(fecha.getDate()).padStart(2, '0')

  return `${fecha.getFullYear()}-${mes}-${dia}`
}

export function rangoPreset(preset: RangoPreset, ahora: Date = new Date()): Rango {
  const hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate())

  if (preset === 'hoy') return { desde: ymd(hoy), hasta: ymd(hoy) }

  if (preset === '7dias') {
    const inicio = new Date(hoy)
    inicio.setDate(hoy.getDate() - 6)

    return { desde: ymd(inicio), hasta: ymd(hoy) }
  }

  return { desde: ymd(new Date(hoy.getFullYear(), hoy.getMonth(), 1)), hasta: ymd(hoy) }
}

/** Corrige un rango invertido (desde posterior a hasta) intercambiando los extremos. */
export function ordenarRango(desde: string, hasta: string): Rango {
  return desde && hasta && desde > hasta ? { desde: hasta, hasta: desde } : { desde, hasta }
}
