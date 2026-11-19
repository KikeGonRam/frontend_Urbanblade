import type { SystemStatusSummary } from "~/types/dashboard";

export interface EngineerSystemHealth {
  label: string;
  detail: string;
  dot: string;
  tone: string;
}

/**
 * Estado del monitor técnico (GET /admin/system/status) y su lectura resumida.
 * `ready` se espera en el setup del componente para conservar la carga en SSR como antes.
 */
export function useEngineerSystemStatus() {
  const { apiFetch } = useApi();
  const state = useAsyncData(
    "engineer-system-status",
    () => apiFetch<SystemStatusSummary>("/admin/system/status"),
    { lazy: true },
  );
  const systemStatus = state.data;
  const systemPending = state.pending;

  const systemHealth = computed<EngineerSystemHealth>(() => {
    if (!systemStatus.value)
      return {
        label: systemPending.value ? "Comprobando" : "Sin respuesta",
        detail: "El monitor técnico no respondió todavía.",
        dot: "bg-muted",
        tone: "text-muted",
      };

    const failedJobs = systemStatus.value.queue.failed ?? 0;
    const failedTasks = systemStatus.value.scheduled_tasks.filter(
      (task) => task.status === "failed",
    ).length;
    const unavailable =
      systemStatus.value.database.status === "down" ||
      systemStatus.value.redis.status === "down";

    if (unavailable)
      return {
        label: "Crítico",
        detail: "Una dependencia de infraestructura no responde.",
        dot: "bg-danger",
        tone: "text-danger",
      };
    if (failedJobs > 0 || failedTasks > 0)
      return {
        label: "Atención",
        detail: `${failedJobs} jobs y ${failedTasks} tareas requieren revisión.`,
        dot: "bg-warning",
        tone: "text-warning",
      };

    return {
      label: "Estable",
      detail: "Infraestructura y tareas programadas saludables.",
      dot: "bg-success",
      tone: "text-success",
    };
  });

  return { systemStatus, systemPending, systemHealth, ready: state };
}
