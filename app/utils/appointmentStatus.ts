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

export function appointmentStatus(estado: string | null | undefined): { label: string; tone: BadgeTone } {
  return APPOINTMENT_STATUS[estado ?? ""] ?? { label: estado || "Sin estado", tone: "neutral" };
}
