import type { IngenieroData } from "~/types/dashboard";
import { untilToday } from "~/utils/chartBuckets";
import { chartAxisClean, chartColor, chartScale, chartTooltip, goldRgba } from "~/utils/chartTheme";

/** Líneas de citas e ingresos de los módulos «Citas» e «Ingresos» del ingeniero. */
export function useEngineerTrendCharts(getData: () => IngenieroData) {
  const appointmentTrend = computed(() =>
    untilToday(getData().clientTrends.labels ?? [], getData().clientTrends.values ?? []),
  );
  const hasAppointmentTrend = computed(() => appointmentTrend.value.values.some((v) => v));
  const appointmentTrendData = computed(() => ({
    labels: appointmentTrend.value.labels,
    datasets: [
      {
        label: "Citas",
        data: appointmentTrend.value.values,
        borderColor: chartColor(1, 0.95),
        backgroundColor: chartColor(1, 0.1),
        borderWidth: 2.5,
        fill: true,
        // Conteo de citas (valores enteros): línea recta entre puntos, sin curva que sugiera valores intermedios.
        tension: 0,
        pointRadius: 2.5,
        pointHoverRadius: 5,
        pointBackgroundColor: chartColor(1, 1),
        pointBorderColor: chartColor(1, 1),
        pointBorderWidth: 2,
      },
    ],
  }));
  const lineOptionsFor = (formatter: (v: number) => string) => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: { intersect: false, mode: "index" as const },
    plugins: {
      legend: { display: false },
      tooltip: {
        ...chartTooltip(),
        callbacks: {
          label: (ctx: { parsed: { y: number } }) => formatter(ctx.parsed.y),
        },
      },
    },
    scales: {
      y: {
        ...chartScale(),
        beginAtZero: true,
        ticks: { ...chartScale().ticks, precision: 0 },
      },
      x: chartAxisClean(),
    },
  });

  const hasIncome = computed(() => (getData().incomeChart.values ?? []).some((v) => v));
  const incomeData = computed(() => ({
    labels: getData().incomeChart.labels ?? [],
    datasets: [
      {
        label: "Ingresos ($)",
        data: getData().incomeChart.values ?? [],
        borderColor: goldRgba(0.95),
        backgroundColor: goldRgba(0.1),
        borderWidth: 2.5,
        fill: true,
        tension: 0.35,
        pointRadius: 2.5,
        pointHoverRadius: 5,
        pointBackgroundColor: goldRgba(1),
        pointBorderColor: goldRgba(1),
        pointBorderWidth: 2,
      },
    ],
  }));

  return { hasAppointmentTrend, appointmentTrendData, lineOptionsFor, hasIncome, incomeData };
}
