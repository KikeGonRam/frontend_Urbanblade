import type { AdminData } from "~/types/dashboard";
import { fmtInt, fmtMoney } from "~/utils/chartTheme";

/*
 * Periodo de las tarjetas de citas e ingresos: el servidor ya manda hoy, semana y mes; la variación
 * es contra el mes pasado y por eso se muestra igual en los tres.
 */
export type Periodo = "hoy" | "semana" | "mes";

export const PERIODOS = [
  { value: "hoy", label: "Hoy", icon: "clock" },
  { value: "semana", label: "Semana" },
  { value: "mes", label: "Mes" },
];

export const CITAS_LABEL: Record<Periodo, string> = {
  hoy: "Citas de hoy",
  semana: "Citas de la semana",
  mes: "Citas del mes",
};
export const INGRESOS_LABEL: Record<Periodo, string> = {
  hoy: "Ingresos de hoy",
  semana: "Ingresos de la semana",
  mes: "Ingresos del mes",
};

/** KPIs del administrador: valores por periodo, textos de apoyo y proporción de clientes activos. */
export function useAdminKpis(getData: () => AdminData) {
  const periodo = ref<Periodo>("hoy");

  const citasPorPeriodo = computed<Record<Periodo, number>>(() => ({
    hoy: getData().kpis.appointments_today,
    semana: getData().kpis.appointments_week,
    mes: getData().kpis.appointments_month,
  }));
  const ingresosPorPeriodo = computed<Record<Periodo, number>>(() => ({
    hoy: getData().kpis.income_today,
    semana: getData().kpis.income_week,
    mes: getData().kpis.income_month,
  }));
  const citasHint = computed(
    () => `${fmtInt(getData().kpis.appointments_week)} esta semana · ${fmtInt(getData().kpis.appointments_month)} este mes`,
  );
  const ingresosHint = computed(
    () => `Pagos registrados: ${fmtMoney(getData().kpis.income_week)} esta semana · ${fmtMoney(getData().kpis.income_month)} este mes`,
  );
  const ratioActiveClients = computed(() =>
    getData().kpis.total_clients > 0
      ? Math.round((getData().kpis.active_clients / getData().kpis.total_clients) * 100)
      : 0,
  );

  return { periodo, citasPorPeriodo, ingresosPorPeriodo, citasHint, ingresosHint, ratioActiveClients };
}
