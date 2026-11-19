import type { AdminData } from "~/types/dashboard";
import {
  chartAxisClean,
  chartColor,
  chartScale,
  chartSeries,
  chartTooltip,
  fmtInt,
  fmtMoney,
  goldRgba,
  tokenRgba,
} from "~/utils/chartTheme";

/** Series y opciones de «Ingresos por semana» y «Servicios más pedidos» del administrador. */
export function useAdminRevenueCharts(getData: () => AdminData) {
  const hasIncome = computed(() => (getData().incomeChart.values ?? []).some((v) => v));
  const incomeTrend = computed(() => {
    const vals = (getData().incomeChart.values ?? []).map(Number);

    return vals.map((_, i) => {
      const win = vals.slice(Math.max(0, i - 2), i + 1);

      return Math.round(win.reduce((sum, v) => sum + v, 0) / win.length);
    });
  });
  const incomeData = computed(() => ({
    labels: getData().incomeChart.labels ?? [],
    datasets: [
      {
        type: "bar" as const,
        label: "Ingresos",
        data: getData().incomeChart.values ?? [],
        // La semana en curso en oro; las anteriores en verde si subieron contra la semana previa y en rojo si bajaron.
        backgroundColor: (getData().incomeChart.values ?? []).map((v, i, all) =>
          i === all.length - 1 ? chartColor(0, 0.95) : i === 0 || v >= all[i - 1]! ? chartColor(2, 0.8) : chartColor(4, 0.8),
        ),
        hoverBackgroundColor: goldRgba(1),
        borderRadius: 6,
        maxBarThickness: 36,
        order: 2,
      },
      {
        type: "line" as const,
        label: "Tendencia",
        data: incomeTrend.value,
        borderColor: tokenRgba("ink", 0.75),
        borderDash: [6, 4],
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4,
        cubicInterpolationMode: "monotone" as const,
        order: 1,
      },
    ],
  }));
  const incomeOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        ...chartTooltip(),
        callbacks: {
          title: (items: { label: string }[]) => `Semana del ${items[0]?.label ?? ""}`,
          label: (ctx: { dataset: { label?: string }; parsed: { y: number } }) => `${ctx.dataset.label}: ${fmtMoney(ctx.parsed.y)}`,
        },
      },
    },
    scales: {
      y: {
        ...chartScale(),
        beginAtZero: true,
        ticks: { ...chartScale().ticks, maxTicksLimit: 5, callback: (v: number) => fmtMoney(v) },
      },
      x: chartAxisClean(),
    },
  };

  const hasServices = computed(() => (getData().servicesChart.values ?? []).some((v) => v));
  // Barras horizontales ordenadas (se leen mejor que la dona de 6 colores de antes).
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
        maxBarThickness: 22,
      },
    ],
  }));
  const servicesOptions = {
    indexAxis: "y" as const,
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        ...chartTooltip(),
        callbacks: { label: (ctx: { parsed: { x: number } }) => `${fmtInt(ctx.parsed.x)} citas` },
      },
    },
    scales: {
      x: { ...chartScale(), beginAtZero: true, ticks: { ...chartScale().ticks, precision: 0, maxTicksLimit: 5 } },
      y: chartAxisClean(),
    },
  };

  return { hasIncome, incomeData, incomeOptions, hasServices, servicesData, servicesOptions };
}
