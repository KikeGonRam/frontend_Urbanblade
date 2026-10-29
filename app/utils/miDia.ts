/*
 * Cálculos de «Mi día» del barbero (auditoría UI/UX B-01): tiempo relativo de cada cita y huecos libres entre
 * citas, sobre horas «HH:MM» (o «HH:MM:SS») del mismo día.
 */
export function minutosDelDia(hora: string | null | undefined): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(hora ?? '')

  return m ? Number(m[1]) * 60 + Number(m[2]) : null
}

export function minutosAhora(ahora: Date = new Date()): number {
  return ahora.getHours() * 60 + ahora.getMinutes()
}

/** «en 42 min», «en 1 h 10 min», «ahora» o «hace 15 min» respecto de `ahora`. */
export function etiquetaRelativa(hora: string | null | undefined, ahora: Date = new Date()): string {
  const objetivo = minutosDelDia(hora)
  if (objetivo === null) return ''
  const delta = objetivo - minutosAhora(ahora)
  if (delta === 0) return 'ahora'
  const abs = Math.abs(delta)
  const texto = abs >= 60 ? `${Math.floor(abs / 60)} h${abs % 60 ? ` ${abs % 60} min` : ''}` : `${abs} min`

  return delta > 0 ? `en ${texto}` : `hace ${texto}`
}

/** Minutos libres entre el fin de una cita y el inicio de la siguiente (0 si se empalman o no se pueden leer). */
export function huecoLibre(finAnterior: string | null | undefined, inicioSiguiente: string | null | undefined): number {
  const fin = minutosDelDia(finAnterior)
  const inicio = minutosDelDia(inicioSiguiente)
  if (fin === null || inicio === null) return 0

  return Math.max(0, inicio - fin)
}

export function textoHueco(minutos: number): string {
  return minutos >= 60 ? `${Math.floor(minutos / 60)} h${minutos % 60 ? ` ${minutos % 60} min` : ''}` : `${minutos} min`
}
