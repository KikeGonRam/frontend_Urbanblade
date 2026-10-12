/** No confundir un pago registrado con pago resuelto: la autoridad es pago_resuelto. */
export function clientAppointmentHint(estado: string, paymentResolved?: boolean | null): string | undefined {
  if (estado === 'confirmada') {
    if (paymentResolved === true) return 'Cita aprobada y pago resuelto. Te esperamos a la hora de tu cita.'
    if (paymentResolved === false) return 'Cita aprobada. Resuelve el pago antes del servicio; consulta las opciones aquí o en recepción.'
    return 'Cita aprobada. Consulta el estado de tu pago en tus comprobantes o en recepción.'
  }
  if (estado === 'pendiente') return 'Esperando que tu barbero apruebe la cita. Te avisamos en cuanto la confirme.'
  if (estado === 'en_proceso') return 'Tu servicio está en curso.'
  if (estado === 'no_asistio') return 'No registramos tu asistencia. Si hay un cargo pendiente, págalo en la barbería para volver a reservar.'
  return undefined
}
