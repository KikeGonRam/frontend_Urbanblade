import type { AdminData } from "~/types/dashboard";
import { untilToday } from "~/utils/chartBuckets";
import {
  chartAxisClean,
  chartColor,
  chartScale,
  chartTooltip,
  fmtInt,
  fmtMoney,
  goldRgba,
  tokenRgba,
} from "~/utils/chartTheme";

/** Desempeño por barbero, citas completadas del mes y base de clientes del administrador. */
export function useAdminPerformanceCharts(getData: () => AdminData) {
  const barberRanking = computed(() => {
    const perf = getData().barberPerformance;

    return (perf.labels ?? [])
      .map((label, i) => ({
        label,
        value: perf.appointments?.[i] ?? 0,
        display: `${fmtInt(perf.appointments?.[i] ?? 0)} citas`,
        detail: fmtMoney(perf.revenue?.[i] ?? 0),
        muted: label === "Barberos dados de baja",
      }))
      .filter((r) => r.value > 0);
  });

  const barberCombo = computed(() => {
    const perf = getData().barberPerformance;

    return (perf.labels ?? [])
      .map((label, i) => ({ label, revenue: perf.revenue?.[i] ?? 0, appointments: perf.appointments?.[i] ?? 0 }))
      .filter((r) => r.revenue > 0 || r.appointments > 0);
  });
  const hasBarberCombo = computed(() => barberCombo.value.length > 0);
  const barberComboData = computed(() => ({
    labels: barberCombo.value.map((r) => r.label),
    datasets: [
      {
        type: "bar" as const,
        label: "Ingresos",
        data: barberCombo.value.map((r) => r.revenue),
        backgroundColor: goldRgba(0.85),
        borderRadius: 6,
        maxBarThickness: 40,
        yAxisID: "y",
        order: 2,
      },
      {
        type: "line" as const,
        label: "Citas completadas",
        data: barberCombo.value.map((r) => r.appointments),
        borderColor: chartColor(2, 1),
        backgroundColor: chartColor(2, 1),
        borderWidth: 2.5,
        pointRadius: 4,
        pointHoverRadius: 6,
        yAxisID: "y1",
        order: 1,
      },
    ],
  }));
  const barberComboOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index" as const, intersect: false },
    plugins: {
      legend: { display: true, position: "top" as const, align: "end" as const, labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true } },
      tooltip: {
        ...chartTooltip(),
        displayColors: true,
        callbacks: {
          label: (ctx: { dataset: { label?: string }; parsed: { y: number } }) =>
            ctx.dataset.label === "Ingresos" ? `Ingresos: ${fmtMoney(ctx.parsed.y)}` : `Citas completadas: ${fmtInt(ctx.parsed.y)}`,
        },
      },
    },
    scales: {
      y: { ...chartScale(), beginAtZero: true, position: "left" as const, ticks: { ...chartScale().ticks, maxTicksLimit: 5, callback: (v: number | string) => fmtMoney(Number(v)) } },
      y1: { ...chartScale(), beginAtZero: true, position: "right" as const, grid: { display: false }, ticks: { ...chartScale().ticks, precision: 0, maxTicksLimit: 5 } },
      x: chartAxisClean(),
    },
  };

  const clientBase = computed(() => {
    const k = getData().kpis;
    const inactive = Math.max(0, k.total_clients - k.active_clients);

    return [
      { label: "Activos", value: k.active_clients, color: tokenRgba("success", 0.9) },
      { label: "Inactivos", value: inactive, color: tokenRgba("ink", 0.25) },
    ];
  });

  const clientTrendsUntilToday = computed(() =>
    untilToday(getData().clientTrends.labels ?? [], getData().clientTrends.values ?? []),
  );
  const hasClientTrends = computed(() => clientTrendsUntilToday.value.values.some((v) => v));
  const clientTrendsData = computed(() => ({
    labels: clientTrendsUntilToday.value.labels,
    datasets: [
      {
        label: "Citas completadas",
        data: clientTrendsUntilToday.value.values,
        borderColor: chartColor(1, 0.95),
        backgroundColor: chartColor(1, 0.1),
        borderWidth: 2.5,
        fill: true,
        // Conteo de citas (valores enteros): línea recta entre puntos; la curva sugería valores intermedios que no existen.
        tension: 0,
        pointRadius: 3,
        pointHoverRadius: 6,
        pointBackgroundColor: chartColor(1, 1),
        pointBorderColor: chartColor(1, 1),
        pointBorderWidth: 2,
      },
    ],
  }));
  const clientTrendsOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { intersect: false, mode: "index" as const },
    plugins: {
      legend: { display: false },
      tooltip: {
        ...chartTooltip(),
        callbacks: {
          label: (ctx: { parsed: { y: number } }) => `${fmtInt(ctx.parsed.y)} cita${ctx.parsed.y === 1 ? "" : "s"}`,
        },
      },
    },
    scales: {
      y: {
        ...chartScale(),
        beginAtZero: true,
        ticks: { ...chartScale().ticks, precision: 0 },
      },
      x: chartScale(),
    },
  };

  return {
    barberRanking,
    hasBarberCombo,
    barberComboData,
    barberComboOptions,
    clientBase,
    hasClientTrends,
    clientTrendsData,
    clientTrendsOptions,
  };
}
