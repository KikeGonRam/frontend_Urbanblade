import type { IngenieroData } from "~/types/dashboard";
import { chartAxisClean, chartScale, chartSeries, chartTooltip, fmtInt } from "~/utils/chartTheme";

/** Servicios (barras horizontales) y ranking de barberos de los módulos del ingeniero. */
export function useEngineerServiceBarberData(getData: () => IngenieroData) {
  const hasServices = computed(() => (getData().servicesChart.values ?? []).some((v) => v));
  const servicesSorted = computed(() =>
    (getData().servicesChart.labels ?? [])
      .map((label, i) => ({ label, value: getData().servicesChart.values?.[i] ?? 0 }))
      .sort((x, y) => y.value - x.value),
  );
  const servicesData = computed(() => ({
    labels: servicesSorted.value.map((s) => s.label),
    datasets: [
      {
        label: "Citas",
        data: servicesSorted.value.map((s) => s.value),
        backgroundColor: chartSeries(servicesSorted.value.length),
        borderRadius: 6,
        maxBarThickness: 18,
      },
    ],
  }));
  const servicesOptions = {
    indexAxis: "y" as const,
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { ...chartTooltip(), callbacks: { label: (ctx: { parsed: { x: number } }) => `${fmtInt(ctx.parsed.x)} citas` } },
    },
    scales: {
      x: { ...chartScale(), beginAtZero: true, ticks: { ...chartScale().ticks, precision: 0, maxTicksLimit: 4 } },
      y: chartAxisClean(),
    },
  };

  const hasBarberPerformance = computed(
    () =>
      (getData().barberPerformance.appointments ?? []).some((v) => v) ||
      (getData().barberPerformance.revenue ?? []).some((v) => v),
  );
  // Lista con barras (nombres completos, sin etiquetas giradas); dados de baja en gris.
  const barberRanking = computed(() => {
    const perf = getData().barberPerformance;

    return (perf.labels ?? []).map((label, i) => ({
      label,
      value: perf.appointments?.[i] ?? 0,
      display: `${fmtInt(perf.appointments?.[i] ?? 0)} citas`,
      muted: label === "Barberos dados de baja",
    }));
  });

  return { hasServices, servicesData, servicesOptions, hasBarberPerformance, barberRanking };
}
