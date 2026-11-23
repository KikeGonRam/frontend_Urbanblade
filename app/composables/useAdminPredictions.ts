import { fmtMoney } from "~/utils/chartTheme";

/*
 * Predicciones IA: a diferencia de la versión Inertia (que corre bajo
 * sesión web y necesita pedir un token puente vía /auth/get-api-token),
 * este frontend ya trae su propio Bearer token real desde el login —
 * llama los mismos 3 endpoints de /admin/predictions/* directo. Más
 * simple que el original, no una limitación.
 */
export interface AiInsight {
  status: string;
  message: string;
}

export const AI_STATUS_STYLE: Record<string, { cls: string; dot: string }> = {
  positive: {
    cls: "border-success/20 bg-success/[0.04]",
    dot: "bg-success",
  },
  warning: {
    cls: "border-warning/20 bg-warning/[0.04]",
    dot: "bg-warning",
  },
  neutral: { cls: "border-info/20 bg-info/[0.04]", dot: "bg-info" },
};

/** Carga las predicciones a 7 días al montar; `null` significa «cargando». */
export function useAdminPredictions() {
  const incomeForecast = ref<string | null>(null);
  const appointmentForecast = ref<number | string | null>(null);
  const aiConfidence = ref<string | null>(null);
  const aiInsights = ref<AiInsight[] | null>(null);
  /** La carga falló (red o servidor): distinto de «no hay historial para estimar». */
  const failed = ref(false);

  const { apiFetch } = useApi();

  onMounted(async () => {
    try {
      const [incomeRes, apptRes, insightsRes] = await Promise.all([
        apiFetch<{ data?: { predicted_income?: number } }>(
          "/admin/predictions/income/7",
        ),
        apiFetch<{ data?: { predicted_appointments?: number } }>(
          "/admin/predictions/appointments/7",
        ),
        apiFetch<{ data?: Record<string, AiInsight> }>(
          "/admin/predictions/insights",
        ),
      ]);

      // «—» y no «N/A» (inglés): la tarjeta explica debajo que aún no hay historial para estimar.
      incomeForecast.value = incomeRes.data?.predicted_income
        ? fmtMoney(incomeRes.data.predicted_income)
        : "—";
      appointmentForecast.value = apptRes.data?.predicted_appointments ?? "—";
      // La API no expone una confianza estadística validada; no inventar un porcentaje.
      aiConfidence.value = "Por validar";
      aiInsights.value = Object.values(insightsRes.data ?? {});
    } catch {
      failed.value = true;
      incomeForecast.value = "—";
      appointmentForecast.value = "—";
      aiConfidence.value = "—";
      aiInsights.value = [];
    }
  });

  return { incomeForecast, appointmentForecast, aiConfidence, aiInsights, failed };
}
