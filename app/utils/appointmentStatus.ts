/**
 * Etiqueta y tono de cada estado de cita (los 6 que acepta barber:
 * pendiente, confirmada, en_proceso, completada, cancelada, no_asistio).
 * Antes cada pantalla tenía su propio mapa y al del dashboard le faltaba
 * "confirmada", que salía como "—".
 */
export type BadgeTone = "neutral" | "gold" | "success" | "warning" | "danger" | "info";

export const APPOINTMENT_STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  pendiente: { label: "Pendiente", tone: "warning" },
  confirmada: { label: "Confirmada", tone: "info" },
  en_proceso: { label: "En proceso", tone: "gold" },
  completada: { label: "Completada", tone: "success" },
  cancelada: { label: "Cancelada", tone: "danger" },
  no_asistio: { label: "No asistió", tone: "neutral" },
};

/**
 * Clases de una cita en el calendario: el tono de su estado (los mismos tokens que las insignias, así cada tema usa sus
 * colores en lugar del color fijo del backend) y «apagada» si ya no va a ocurrir. Auditoría UX del 6-nov-2026.
 */
export function appointmentEventClasses(estado: string | null | undefined): string[] {
  const clases = ["ub-ev", `ub-ev--${appointmentStatus(estado).tone}`];
  if (estado === "cancelada" || estado === "no_asistio") clases.push("ub-ev--apagada");

  return clases;
}

export function appointmentStatus(estado: string | null | undefined): { label: string; tone: BadgeTone } {
  return APPOINTMENT_STATUS[estado ?? ""] ?? { label: estado || "Sin estado", tone: "neutral" };
}
