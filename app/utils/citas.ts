/*
 * Una cita de un día futuro todavía no ocurre: no se puede completar ni marcar «no asistió».
 * (Cobrar sí sigue disponible: el anticipo o depósito se paga antes del día de la cita.)
 */
const DESTINOS_DEL_DIA = ['completada', 'no_asistio']

function hoyLocal(ahora: Date): string {
  const mes = String(ahora.getMonth() + 1).padStart(2, '0')
  const dia = String(ahora.getDate()).padStart(2, '0')

  return `${ahora.getFullYear()}-${mes}-${dia}`
}

export function esCitaFutura(fecha: string | null | undefined, ahora: Date = new Date()): boolean {
  return !!fecha && fecha.slice(0, 10) > hoyLocal(ahora)
}

/** Texto que explica por qué la acción está bloqueada por la fecha, o '' si se puede usar. */
export function motivoBloqueoPorFecha(fecha: string | null | undefined, destino: string, ahora: Date = new Date()): string {
  if (DESTINOS_DEL_DIA.includes(destino) && esCitaFutura(fecha, ahora)) {
    return 'La cita es de un día futuro: podrás usar esta acción cuando llegue la fecha.'
  }

  return ''
}
