<script setup lang="ts">
import { Bar, Doughnut, Line } from "vue-chartjs";
import type { DashboardInsight } from "~/components/dashboard/AnalyticsInsights.vue";
import {
  chartScale,
  fmtInt,
  fmtMoney,
  inkRgba,
  UB_CATEGORICAL,
} from "~/utils/chartTheme";
import { ensureChartjsRegistered } from "~/utils/registerChartjs";

ensureChartjsRegistered();

interface AdminData {
  todayLabel: string;
  kpis: {
    appointments_today: number;
    appointments_week: number;
    appointments_month: number;
    appointment_growth: number;
    income_today: number;
    income_week: number;
    income_month: number;
    income_growth: number;
    top_barber_name: string | null;
    top_barber_total: number;
    new_clients: number;
    recurring_clients: number;
    total_clients: number;
    active_clients: number;
    retention_rate: number;
    low_stock_count: number;
    barbers_status: Array<{ name: string; is_busy: boolean; progress: number }>;
  };
  incomeChart: { labels: string[]; values: number[] };
  servicesChart: { labels: string[]; values: number[] };
  barberPerformance: {
    labels: string[];
    appointments: number[];
    revenue: number[];
  };
  clientTrends: { labels: string[]; values: number[] };
  chatbotTelemetry: {
    window_days?: number;
    total_requests?: number;
    error_rate_pct?: number;
    avg_latency_ms?: number;
    estimated_cost_usd?: number;
    top_sources?: Record<string, number>;
  };
  todayAppointments: Array<{
    id: string;
    estado: string;
    hora_inicio: string;
    hora_fin: string;
    cliente: string;
    servicio: string;
    barbero: string;
  }>;
  recentAppointments: Array<{
    id: string;
    estado: string;
    hora_inicio: string;
    fecha: string;
    cliente: string;
    barberoInicial: string;
    cliente_avatar_url?: string | null;
  }>;
  insights: Array<{ titulo: string; dato: string; detalle: string }>;
  sparkHighlights: DashboardInsight[];
}

const props = defineProps<{ data: AdminData }>();

const STATUS_STYLE: Record<
  string,
  { cls: string; dot: string; label: string }
> = {
  completada: {
    cls: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
    dot: "bg-emerald-400",
    label: "Completada",
  },
  pendiente: {
    cls: "border-amber-500/25 bg-amber-500/10 text-amber-300",
    dot: "bg-amber-400",
    label: "Pendiente",
  },
  en_proceso: {
    cls: "border-blue-500/25 bg-blue-500/10 text-blue-300",
    dot: "bg-blue-400",
    label: "En proceso",
  },
  cancelada: {
    cls: "border-red-500/25 bg-red-500/10 text-red-400",
    dot: "bg-red-400",
    label: "Cancelada",
  },
};
function statusStyle(estado: string) {
  return (
    STATUS_STYLE[estado] ?? {
      cls: "border-ink/10 bg-ink/5 text-ink/40",
      dot: "bg-ink/30",
      label: "—",
    }
  );
}

// Puerto directo de la función PHP $adminSparkline de dashboard.blade.php — aritmética pura.
function sparklinePath(values: number[], w = 80, h = 22): string {
  const vals = (values ?? []).filter((v) => v !== null && v !== undefined);
  if (vals.length < 2) return "";

  const max = Math.max(...vals) || 1;
  const min = Math.min(...vals);
  const rng = max - min || 1;
  const step = w / (vals.length - 1);
  const pts = vals.map(
    (v, i) =>
      `${(i * step).toFixed(2)},${(h - ((v - min) / rng) * h).toFixed(2)}`,
  );

  return `M ${pts.join(" L ")}`;
}

const incomeSpark = computed(() =>
  sparklinePath(props.data.incomeChart.values),
);
const ratioActiveClients = computed(() =>
  props.data.kpis.total_clients > 0
    ? Math.round(
        (props.data.kpis.active_clients / props.data.kpis.total_clients) * 100,
      )
    : 0,
);

const busyStatuses = computed(() =>
  (props.data.kpis.barbers_status ?? []).filter((s) => s.is_busy),
);
const freeStatuses = computed(() =>
  (props.data.kpis.barbers_status ?? []).filter((s) => !s.is_busy),
);
const showFree = ref(false);

const activeTab = ref("activity");
const TABS = [
  { id: "activity", label: "Actividad" },
  { id: "stations", label: "Estaciones" },
  { id: "topbarber", label: "Top Mes" },
];

// Recuerda si el panel de analítica avanzada estaba abierto — misma clave de
// localStorage ('adminAnalytics') que la versión Inertia/Blade.
const analyticsOpen = ref(false);
onMounted(() => {
  try {
    analyticsOpen.value = localStorage.getItem("adminAnalytics") === "true";
  } catch {
    analyticsOpen.value = false;
  }
});
function toggleAnalytics() {
  analyticsOpen.value = !analyticsOpen.value;
  try {
    localStorage.setItem("adminAnalytics", String(analyticsOpen.value));
  } catch {
    // localStorage puede fallar en modo privado — solo se pierde el "recordar".
  }
}

const hasIncome = computed(() =>
  (props.data.incomeChart.values ?? []).some((v) => v),
);
const incomeData = computed(() => ({
  labels: props.data.incomeChart.labels ?? [],
  datasets: [
    {
      label: "Ingresos ($)",
      data: props.data.incomeChart.values ?? [],
      borderColor: "#34d399",
      backgroundColor: (context: {
        chart: {
          ctx: CanvasRenderingContext2D;
          chartArea?: { top: number; bottom: number };
        };
      }) => {
        const { ctx, chartArea } = context.chart;
        if (!chartArea) return "rgba(52,211,153,0.05)";
        const gradient = ctx.createLinearGradient(
          0,
          chartArea.top,
          0,
          chartArea.bottom,
        );
        gradient.addColorStop(0, "rgba(52,211,153,0.24)");
        gradient.addColorStop(1, "rgba(52,211,153,0.01)");

        return gradient;
      },
      borderWidth: 2.5,
      fill: true,
      tension: 0.35,
      pointRadius: 3,
      pointHoverRadius: 6,
      pointBackgroundColor: "#0d0d0d",
      pointBorderColor: "#34d399",
      pointBorderWidth: 2,
    },
  ],
}));
const incomeOptions = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: { intersect: false, mode: "index" as const },
  plugins: {
    legend: { display: false },
    tooltip: {
      displayColors: false,
      callbacks: {
        label: (ctx: { parsed: { y: number } }) =>
          `Ingresos: ${fmtMoney(ctx.parsed.y)}`,
      },
    },
  },
  scales: {
    y: {
      ...chartScale(),
      beginAtZero: true,
      ticks: { ...chartScale().ticks, callback: (v: number) => fmtMoney(v) },
    },
    x: chartScale(),
  },
};

const hasServices = computed(() =>
  (props.data.servicesChart.values ?? []).some((v) => v),
);
const servicesData = computed(() => ({
  labels: props.data.servicesChart.labels ?? [],
  datasets: [
    {
      data: props.data.servicesChart.values ?? [],
      backgroundColor: UB_CATEGORICAL,
      borderColor: "#111111",
      borderWidth: 3,
      hoverOffset: 10,
    },
  ],
}));
const servicesOptions = {
  responsive: true,
  maintainAspectRatio: false,
  cutout: "72%",
  plugins: {
    legend: {
      position: "bottom" as const,
      labels: {
        color: inkRgba(0.45),
        usePointStyle: true,
        pointStyle: "circle",
        padding: 16,
        font: { size: 10, weight: "bold" as const },
      },
    },
    tooltip: {
      displayColors: true,
      callbacks: {
        label: (ctx: { label: string; parsed: number }) =>
          `${ctx.label}: ${fmtInt(ctx.parsed)}`,
      },
    },
  },
};

const hasBarberPerformance = computed(
  () =>
    (props.data.barberPerformance.appointments ?? []).some((v) => v) ||
    (props.data.barberPerformance.revenue ?? []).some((v) => v),
);
const barberCitasData = computed(() => ({
  labels: props.data.barberPerformance.labels ?? [],
  datasets: [
    {
      label: "Citas",
      data: props.data.barberPerformance.appointments ?? [],
      backgroundColor: "rgba(59,130,246,0.75)",
      hoverBackgroundColor: "#3b82f6",
      borderRadius: 4,
      barThickness: 18,
    },
  ],
}));
const barberCitasOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      displayColors: false,
      callbacks: {
        label: (ctx: { parsed: { y: number } }) =>
          `Citas: ${fmtInt(ctx.parsed.y)}`,
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
const barberIngresosData = computed(() => ({
  labels: props.data.barberPerformance.labels ?? [],
  datasets: [
    {
      label: "Ingresos ($)",
      data: props.data.barberPerformance.revenue ?? [],
      backgroundColor: "rgba(16,185,129,0.75)",
      hoverBackgroundColor: "#10b981",
      borderRadius: 4,
      barThickness: 18,
    },
  ],
}));
const barberIngresosOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      displayColors: false,
      callbacks: {
        label: (ctx: { parsed: { y: number } }) =>
          `Ingresos: ${fmtMoney(ctx.parsed.y)}`,
      },
    },
  },
  scales: {
    y: {
      ...chartScale(),
      beginAtZero: true,
      ticks: { ...chartScale().ticks, callback: (v: number) => fmtMoney(v) },
    },
    x: chartScale(),
  },
};

const hasClientTrends = computed(() =>
  (props.data.clientTrends.values ?? []).some((v) => v),
);
const clientTrendsData = computed(() => ({
  labels: props.data.clientTrends.labels ?? [],
  datasets: [
    {
      label: "Citas Completadas",
      data: props.data.clientTrends.values ?? [],
      borderColor: "#c084fc",
      backgroundColor: "rgba(192,132,252,0.1)",
      borderWidth: 2.5,
      fill: true,
      cubicInterpolationMode: "monotone" as const,
      pointRadius: 3,
      pointHoverRadius: 6,
      pointBackgroundColor: "#0d0d0d",
      pointBorderColor: "#c084fc",
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
      displayColors: false,
      callbacks: {
        label: (ctx: { parsed: { y: number } }) =>
          `${fmtInt(ctx.parsed.y)} cita${ctx.parsed.y === 1 ? "" : "s"}`,
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

/*
 * Predicciones IA: a diferencia de la versión Inertia (que corre bajo
 * sesión web y necesita pedir un token puente vía /auth/get-api-token),
 * este frontend ya trae su propio Bearer token real desde el login —
 * llama los mismos 3 endpoints de /admin/predictions/* directo. Más
 * simple que el original, no una limitación.
 */
interface AiInsight {
  status: string;
  message: string;
}
const incomeForecast = ref<string | null>(null);
const appointmentForecast = ref<number | string | null>(null);
const aiConfidence = ref<string | null>(null);
const aiInsights = ref<AiInsight[] | null>(null);
const AI_STATUS_STYLE: Record<string, { cls: string; dot: string }> = {
  positive: {
    cls: "border-emerald-500/20 bg-emerald-500/[0.04]",
    dot: "bg-emerald-400",
  },
  warning: {
    cls: "border-amber-500/20 bg-amber-500/[0.04]",
    dot: "bg-amber-400",
  },
  neutral: { cls: "border-blue-500/20 bg-blue-500/[0.04]", dot: "bg-blue-400" },
};

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

    incomeForecast.value = incomeRes.data?.predicted_income
      ? fmtMoney(incomeRes.data.predicted_income)
      : "N/A";
    appointmentForecast.value = apptRes.data?.predicted_appointments ?? "N/A";
    // La API no expone una confianza estadística validada; no inventar un porcentaje.
    aiConfidence.value = "No validada";
    aiInsights.value = Object.values(insightsRes.data ?? {});
  } catch {
    incomeForecast.value = "—";
    appointmentForecast.value = "—";
    aiConfidence.value = "—";
    aiInsights.value = [];
  }
});
</script>

<template>
  <div class="space-y-5">
    <DashboardHeader
      label="Administrativo"
      color="text-gold"
      :today-label="data.todayLabel"
    />

    <!--
      Antes eran 4 tiles deshabilitados con badge "Próx." estático -- se
      escribieron antes de que /appointments, /clients, /payments y /reports
      existieran y nadie los actualizó al terminarse esas páginas (mismo
      bug que DashboardAnalyticsCta, corregido el mismo día). Ya son enlaces
      reales a las páginas correspondientes.
    -->
    <section class="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <NuxtLink
        v-for="a in [
          { label: 'Nueva Cita', to: '/appointments' },
          { label: 'Nuevo Cliente', to: '/clients' },
          { label: 'Cobrar', to: '/payments' },
          { label: 'Reportes', to: '/reports' },
        ]"
        :key="a.label"
        :to="a.to"
        class="flex items-center gap-3 rounded-[8px] border border-ink/[0.06] bg-card px-4 py-3.5 transition hover:border-gold/30"
      >
        <span class="text-[11px] font-black uppercase tracking-wide text-ink">{{
          a.label
        }}</span>
        <svg class="ml-auto h-3.5 w-3.5 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
        </svg>
      </NuxtLink>
    </section>

    <div class="flex items-center gap-3 px-1 pt-1">
      <span class="text-[10px] font-black uppercase tracking-[0.22em] text-gold"
        >Resumen</span
      >
      <span class="h-px flex-1 bg-ink/[0.06]" />
    </div>

    <section class="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <div
        class="relative overflow-hidden rounded-2xl border border-ink/[0.06] bg-card p-5"
      >
        <div
          class="absolute left-0 top-0 h-0.5 w-full bg-gradient-to-r from-blue-500/60 to-transparent"
        />
        <div class="mb-4 flex items-start justify-between">
          <p
            class="text-[9px] font-black uppercase tracking-[0.25em] text-ink/35"
          >
            Citas Hoy
          </p>
          <div
            class="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10"
          >
            <svg
              class="h-3.5 w-3.5 text-blue-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
        </div>
        <p class="text-3xl font-black leading-none text-ink">
          {{ data.kpis.appointments_today }}
        </p>
        <div
          class="mt-3 flex items-center gap-2 text-[9px] font-black text-ink/50"
        >
          <span class="text-blue-400/80"
            >Sem {{ data.kpis.appointments_week }}</span
          >
          <span>·</span>
          <span>Mes {{ data.kpis.appointments_month }}</span>
          <span
            v-if="data.kpis.appointment_growth != 0"
            class="ml-auto"
            :class="
              data.kpis.appointment_growth >= 0
                ? 'text-emerald-400'
                : 'text-red-400'
            "
          >
            {{ data.kpis.appointment_growth >= 0 ? "▲" : "▼"
            }}{{ Math.abs(data.kpis.appointment_growth) }}%
          </span>
        </div>
      </div>

      <div
        class="relative overflow-hidden rounded-2xl border border-ink/[0.06] bg-card p-5"
      >
        <div
          class="absolute left-0 top-0 h-0.5 w-full bg-gradient-to-r from-emerald-500/60 to-transparent"
        />
        <div class="mb-4 flex items-start justify-between">
          <p
            class="text-[9px] font-black uppercase tracking-[0.25em] text-ink/35"
          >
            Ingresos Hoy
          </p>
          <div
            class="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10"
          >
            <svg
              class="h-3.5 w-3.5 text-emerald-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
        </div>
        <p class="text-3xl font-black leading-none text-emerald-400">
          ${{
            Number(data.kpis.income_today).toLocaleString("es-MX", {
              maximumFractionDigits: 0,
            })
          }}
        </p>
        <svg
          v-if="incomeSpark"
          viewBox="0 0 80 22"
          class="my-2 h-5 w-full"
          preserveAspectRatio="none"
        >
          <path
            :d="incomeSpark"
            fill="none"
            stroke="rgba(52,211,153,0.45)"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        <div v-else class="my-2 h-5" />
        <div class="flex items-center gap-2 text-[9px] font-black text-ink/50">
          <span class="text-emerald-400/80"
            >Sem ${{
              Number(data.kpis.income_week).toLocaleString("es-MX", {
                maximumFractionDigits: 0,
              })
            }}</span
          >
          <span>·</span>
          <span
            >Mes ${{
              Number(data.kpis.income_month).toLocaleString("es-MX", {
                maximumFractionDigits: 0,
              })
            }}</span
          >
          <span
            v-if="data.kpis.income_growth != 0"
            class="ml-auto"
            :class="
              data.kpis.income_growth >= 0 ? 'text-emerald-400' : 'text-red-400'
            "
          >
            {{ data.kpis.income_growth >= 0 ? "▲" : "▼"
            }}{{ Math.abs(data.kpis.income_growth) }}%
          </span>
        </div>
      </div>

      <div
        class="relative overflow-hidden rounded-2xl border border-ink/[0.06] bg-card p-5"
      >
        <div
          class="absolute left-0 top-0 h-0.5 w-full bg-gradient-to-r from-cyan-500/60 to-transparent"
        />
        <div class="mb-4 flex items-start justify-between">
          <p
            class="text-[9px] font-black uppercase tracking-[0.25em] text-ink/35"
          >
            Clientes
          </p>
          <div
            class="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/10"
          >
            <svg
              class="h-3.5 w-3.5 text-cyan-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </div>
        </div>
        <p class="text-3xl font-black leading-none text-ink">
          {{ data.kpis.active_clients }}
        </p>
        <div class="mt-3 h-1 w-full overflow-hidden rounded-full bg-ink/5">
          <div
            class="h-full rounded-full bg-cyan-400"
            :style="{ width: `${ratioActiveClients}%` }"
          />
        </div>
        <div
          class="mt-2 flex items-center gap-2 text-[9px] font-black text-ink/50"
        >
          <span class="text-cyan-400/80"
            >{{ ratioActiveClients }}% activos</span
          >
          <span>de {{ data.kpis.total_clients }} totales</span>
        </div>
      </div>

      <div
        class="relative overflow-hidden rounded-2xl border border-ink/[0.06] bg-card p-5"
      >
        <div
          class="absolute left-0 top-0 h-0.5 w-full bg-gradient-to-r from-purple-500/60 to-transparent"
        />
        <div class="mb-4 flex items-start justify-between">
          <p
            class="text-[9px] font-black uppercase tracking-[0.25em] text-ink/35"
          >
            Retención
          </p>
          <div
            class="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-500/10"
          >
            <svg
              class="h-3.5 w-3.5 text-purple-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
          </div>
        </div>
        <p class="text-3xl font-black leading-none text-purple-400">
          {{ data.kpis.retention_rate.toFixed(1)
          }}<span class="text-lg text-ink/40">%</span>
        </p>
        <div class="mt-3 h-1 w-full overflow-hidden rounded-full bg-ink/5">
          <div
            class="h-full rounded-full bg-purple-400"
            :style="{ width: `${Math.min(100, data.kpis.retention_rate)}%` }"
          />
        </div>
        <div
          class="mt-2 flex items-center gap-2 text-[9px] font-black text-ink/50"
        >
          <span class="text-purple-400/80"
            >{{ data.kpis.recurring_clients }} recurrentes</span
          >
          <span
            v-if="(data.kpis.low_stock_count ?? 0) > 0"
            class="ml-auto flex items-center gap-1 text-amber-400/80"
          >
            <svg
              class="h-3 w-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
              />
            </svg>
            {{ data.kpis.low_stock_count }} stock bajo
          </span>
        </div>
      </div>
    </section>

    <section
      v-if="data.insights.length"
      aria-label="Insights del análisis de datos"
    >
      <div class="mb-3 flex items-center gap-2 px-1">
        <svg
          class="h-4 w-4 text-gold"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0013 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
          />
        </svg>
        <h3 class="text-[11px] font-black uppercase tracking-widest text-gold">
          Insights del análisis de datos
        </h3>
        <span class="text-[9px] text-muted">· UrbanBlade Analytics</span>
      </div>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <article
          v-for="(insight, i) in data.insights"
          :key="`${insight.titulo ?? ''}-${i}`"
          class="rounded-2xl border border-gold/15 bg-gold/[0.03] p-4"
        >
          <p
            class="text-[9px] font-black uppercase tracking-widest text-gold/70"
          >
            {{ insight.titulo }}
          </p>
          <p class="mt-1 text-2xl font-black text-ink">{{ insight.dato }}</p>
          <p class="mt-1.5 text-[11px] leading-snug text-muted">
            {{ insight.detalle }}
          </p>
        </article>
      </div>
    </section>

    <DashboardAnalyticsInsights
      :insights="data.sparkHighlights"
      titulo="Prioridades detectadas"
    />
    <DashboardAnalyticsCta
      titulo="Analítica avanzada completa"
      descripcion="Preparación de datos, predicciones (supervisado), patrones ocultos (no supervisado) y gráficas — todo explicado en lenguaje simple, con datos reales de tu barbería."
    />

    <div class="flex items-center gap-3 px-1 pt-2">
      <span class="text-[10px] font-black uppercase tracking-[0.22em] text-gold"
        >Operación de hoy</span
      >
      <span class="h-px flex-1 bg-ink/[0.06]" />
    </div>

    <section class="grid grid-cols-1 gap-5 lg:grid-cols-12">
      <div
        class="rounded-2xl border border-ink/[0.06] bg-card p-5 lg:col-span-7"
      >
        <div class="mb-5 flex items-center justify-between">
          <div>
            <p
              class="text-[9px] font-black uppercase tracking-[0.25em] text-ink/50"
            >
              Agenda
            </p>
            <h3 class="mt-0.5 text-sm font-black uppercase text-ink">
              Citas de Hoy
            </h3>
          </div>
        </div>

        <div
          v-if="!data.todayAppointments.length"
          class="flex flex-col items-center justify-center rounded-xl border border-dashed border-ink/[0.06] py-12"
        >
          <svg
            class="mb-2 h-8 w-8 text-ink/10"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.2"
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <p class="text-xs font-bold uppercase tracking-widest text-ink/45">
            Sin citas hoy
          </p>
        </div>
        <div v-else class="space-y-2">
          <div
            v-for="appt in data.todayAppointments"
            :key="appt.id"
            class="flex items-center gap-3 rounded-xl border border-ink/[0.05] p-3 transition-all hover:border-ink/10 hover:bg-ink/[0.02]"
          >
            <div class="w-10 shrink-0 text-center">
              <p class="text-[11px] font-black text-ink">
                {{ appt.hora_inicio?.slice(0, 5) ?? "--:--" }}
              </p>
              <p class="text-[8px] font-bold text-ink/45">
                {{ appt.hora_fin?.slice(0, 5) }}
              </p>
            </div>
            <div class="h-7 w-px shrink-0 bg-ink/[0.06]" />
            <div class="min-w-0 flex-1">
              <p class="truncate text-xs font-black text-ink">
                {{ appt.cliente }}
              </p>
              <p class="truncate text-[9px] font-bold text-ink/35">
                {{ appt.servicio }} · {{ appt.barbero }}
              </p>
            </div>
            <span
              class="flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[8px] font-black uppercase tracking-wider"
              :class="statusStyle(appt.estado).cls"
            >
              <span
                class="h-1.5 w-1.5 rounded-full"
                :class="statusStyle(appt.estado).dot"
              />
              {{ statusStyle(appt.estado).label }}
            </span>
          </div>
        </div>
      </div>

      <div class="lg:col-span-5">
        <div
          class="flex h-full flex-col overflow-hidden rounded-2xl border border-ink/[0.06] bg-card"
        >
          <div class="flex border-b border-ink/[0.06]">
            <button
              v-for="tab in TABS"
              :key="tab.id"
              type="button"
              class="flex-1 py-3 text-[9px] font-black uppercase tracking-[0.2em] transition-all"
              :class="
                activeTab === tab.id
                  ? '-mb-px border-b-2 border-gold text-gold'
                  : 'text-ink/50 hover:text-ink/60'
              "
              @click="activeTab = tab.id"
            >
              {{ tab.label }}
            </button>
          </div>

          <div class="flex-1 p-5">
            <div v-if="activeTab === 'activity'" class="space-y-3">
              <div
                v-for="appt in data.recentAppointments.slice(0, 6)"
                :key="appt.id"
                class="flex items-center gap-3"
              >
                <UiAvatar :src="appt.cliente_avatar_url" :name="appt.cliente" />
                <div class="min-w-0 flex-1">
                  <p class="truncate text-[11px] font-bold text-ink">
                    {{ appt.cliente }}
                  </p>
                  <p class="truncate text-[9px] text-ink/50">
                    {{ appt.fecha }} · {{ appt.hora_inicio?.slice(0, 5) }}
                  </p>
                </div>
                <span
                  class="shrink-0 rounded-full border px-2 py-0.5 text-[8px] font-black uppercase"
                  :class="statusStyle(appt.estado).cls"
                  >{{ statusStyle(appt.estado).label }}</span
                >
              </div>
              <p
                v-if="!data.recentAppointments.length"
                class="py-8 text-center text-xs italic text-ink/45"
              >
                Sin actividad reciente
              </p>
            </div>

            <div v-else-if="activeTab === 'stations'">
              <div class="mb-4 flex items-center justify-between">
                <p
                  class="text-[9px] font-black uppercase tracking-[0.25em] text-ink/50"
                >
                  Ocupación en tiempo real
                </p>
                <span
                  class="flex items-center gap-1 text-[8px] font-black uppercase text-emerald-400"
                >
                  <span
                    class="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400"
                  />Live
                </span>
              </div>
              <template v-if="(data.kpis.barbers_status ?? []).length">
                <div class="mb-4 flex gap-3">
                  <div
                    class="flex-1 rounded-xl border border-red-500/20 bg-red-500/[0.04] p-3 text-center"
                  >
                    <p class="text-lg font-black text-red-400">
                      {{ busyStatuses.length }}
                    </p>
                    <p class="text-[8px] font-black uppercase text-red-400/80">
                      Ocupados
                    </p>
                  </div>
                  <div
                    class="flex-1 rounded-xl border border-emerald-500/15 bg-emerald-500/[0.04] p-3 text-center"
                  >
                    <p class="text-lg font-black text-emerald-400">
                      {{ freeStatuses.length }}
                    </p>
                    <p
                      class="text-[8px] font-black uppercase text-emerald-400/80"
                    >
                      Libres
                    </p>
                  </div>
                </div>

                <div v-if="busyStatuses.length" class="grid grid-cols-2 gap-3">
                  <div
                    v-for="st in busyStatuses"
                    :key="st.name"
                    class="rounded-xl border border-red-500/20 bg-red-500/[0.04] p-3 text-center"
                  >
                    <div class="relative mb-2 inline-flex">
                      <div
                        class="flex h-9 w-9 items-center justify-center rounded-lg border border-ink/[0.08] bg-ink/[0.05] text-[11px] font-black text-gold"
                      >
                        {{ st.name.slice(0, 2).toUpperCase() }}
                      </div>
                      <span
                        class="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#111] bg-red-500"
                      />
                    </div>
                    <p class="truncate text-[10px] font-black text-ink">
                      {{ st.name.split(" ")[0] }}
                    </p>
                    <p class="text-[8px] font-black uppercase text-red-400">
                      Ocupado
                    </p>
                    <div
                      class="mt-1.5 h-0.5 w-full overflow-hidden rounded-full bg-ink/5"
                    >
                      <div
                        class="h-full rounded-full bg-gold"
                        :style="{ width: `${st.progress}%` }"
                      />
                    </div>
                  </div>
                </div>
                <p v-else class="py-4 text-center text-xs italic text-ink/45">
                  Nadie está atendiendo ahora mismo.
                </p>

                <template v-if="freeStatuses.length">
                  <button
                    type="button"
                    class="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-ink/[0.06] bg-ink/[0.02] py-2.5 text-[9px] font-black uppercase tracking-widest text-ink/50 transition hover:text-ink/70"
                    @click="showFree = !showFree"
                  >
                    <span>{{
                      showFree
                        ? "Ocultar libres"
                        : `Ver ${freeStatuses.length} libres`
                    }}</span>
                    <svg
                      class="h-3 w-3 transition-transform"
                      :class="showFree ? 'rotate-180' : ''"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>
                  <div v-if="showFree" class="mt-3 grid grid-cols-2 gap-3">
                    <div
                      v-for="st in freeStatuses"
                      :key="st.name"
                      class="rounded-xl border border-emerald-500/15 bg-emerald-500/[0.04] p-3 text-center"
                    >
                      <div class="relative mb-2 inline-flex">
                        <div
                          class="flex h-9 w-9 items-center justify-center rounded-lg border border-ink/[0.08] bg-ink/[0.05] text-[11px] font-black text-gold"
                        >
                          {{ st.name.slice(0, 2).toUpperCase() }}
                        </div>
                        <span
                          class="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#111] bg-emerald-500"
                        />
                      </div>
                      <p class="truncate text-[10px] font-black text-ink">
                        {{ st.name.split(" ")[0] }}
                      </p>
                      <p
                        class="text-[8px] font-black uppercase text-emerald-400"
                      >
                        Libre
                      </p>
                    </div>
                  </div>
                </template>
              </template>
              <p v-else class="py-8 text-center text-xs italic text-ink/45">
                Sin barberos activos
              </p>
            </div>

            <div v-else-if="activeTab === 'topbarber'">
              <div
                v-if="data.kpis.top_barber_name"
                class="flex flex-col items-center py-4 text-center"
              >
                <div
                  class="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl border border-gold/20 bg-gradient-to-br from-gold/20 to-gold/5 text-2xl font-black text-gold"
                >
                  {{ data.kpis.top_barber_name.slice(0, 2).toUpperCase() }}
                </div>
                <p class="text-base font-black uppercase text-ink">
                  {{ data.kpis.top_barber_name }}
                </p>
                <p
                  class="mt-0.5 text-[9px] font-bold uppercase tracking-widest text-ink/50"
                >
                  Mejor del mes
                </p>
                <div
                  class="mt-3 inline-flex items-center gap-2 rounded-xl border border-gold/15 bg-gold/[0.06] px-4 py-2"
                >
                  <svg
                    class="h-3.5 w-3.5 text-gold"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  <p class="text-sm font-black text-gold">
                    {{ data.kpis.top_barber_total }}
                  </p>
                  <p
                    class="text-[9px] font-bold uppercase tracking-wider text-ink/50"
                  >
                    citas
                  </p>
                </div>
              </div>
              <p v-else class="py-8 text-center text-xs italic text-ink/45">
                Sin datos este mes
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="space-y-5">
      <button
        type="button"
        class="flex w-full items-center gap-3 rounded-2xl border border-ink/[0.06] bg-card px-5 py-4 transition-all hover:border-ink/12"
        :aria-expanded="analyticsOpen"
        @click="toggleAnalytics"
      >
        <svg
          class="h-4 w-4 shrink-0 text-gold transition-transform duration-200"
          :class="analyticsOpen ? 'rotate-90' : ''"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2.5"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M9 5l7 7-7 7"
          />
        </svg>
        <div class="text-left">
          <p class="text-[11px] font-black uppercase tracking-widest text-ink">
            Analítica avanzada
          </p>
          <p class="text-[9px] font-bold text-ink/45">
            4 gráficas · predicciones IA · telemetría chatbot
          </p>
        </div>
        <span
          class="ml-auto text-[9px] font-black uppercase tracking-widest text-gold/70"
          >{{ analyticsOpen ? "Ocultar" : "Ver" }}</span
        >
      </button>

      <div v-if="analyticsOpen" class="space-y-5">
        <section class="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div class="rounded-2xl border border-ink/[0.06] bg-card p-5">
            <div class="mb-5 flex items-center justify-between">
              <div>
                <p
                  class="text-[9px] font-black uppercase tracking-[0.25em] text-ink/50"
                >
                  Últimas 8 semanas
                </p>
                <h3 class="mt-0.5 text-sm font-black uppercase text-ink">
                  Tendencia de Ingresos
                </h3>
              </div>
              <div
                class="h-2 w-2 rounded-full bg-emerald-400"
                title="Ingresos ($)"
              />
            </div>
            <div v-if="hasIncome" class="h-52">
              <Line :data="incomeData" :options="incomeOptions" />
            </div>
            <div
              v-else
              class="flex h-52 items-center justify-center rounded-xl border border-dashed border-ink/[0.06]"
            >
              <p
                class="text-xs font-bold uppercase tracking-widest text-ink/45"
              >
                Sin ingresos aún
              </p>
            </div>
          </div>

          <div class="rounded-2xl border border-ink/[0.06] bg-card p-5">
            <div class="mb-5">
              <p
                class="text-[9px] font-black uppercase tracking-[0.25em] text-ink/50"
              >
                Distribución
              </p>
              <h3 class="mt-0.5 text-sm font-black uppercase text-ink">
                Demanda de Servicios
              </h3>
            </div>
            <div v-if="hasServices" class="h-52">
              <Doughnut :data="servicesData" :options="servicesOptions" />
            </div>
            <div
              v-else
              class="flex h-52 items-center justify-center rounded-xl border border-dashed border-ink/[0.06]"
            >
              <p
                class="text-xs font-bold uppercase tracking-widest text-ink/45"
              >
                Sin servicios registrados
              </p>
            </div>
          </div>

          <div class="rounded-2xl border border-ink/[0.06] bg-card p-5">
            <div class="mb-5 flex items-center justify-between">
              <div>
                <p
                  class="text-[9px] font-black uppercase tracking-[0.25em] text-ink/50"
                >
                  Este mes
                </p>
                <h3 class="mt-0.5 text-sm font-black uppercase text-ink">
                  Desempeño Barberos
                </h3>
              </div>
              <div
                class="flex gap-3 text-[8px] font-black uppercase text-ink/45"
              >
                <span class="flex items-center gap-1"
                  ><span class="h-2 w-2 rounded-sm bg-blue-500" />Citas</span
                >
                <span class="flex items-center gap-1"
                  ><span
                    class="h-2 w-2 rounded-sm bg-emerald-500"
                  />Ingresos</span
                >
              </div>
            </div>
            <div
              v-if="hasBarberPerformance"
              class="grid h-52 grid-cols-2 gap-4"
            >
              <div class="min-w-0">
                <Bar :data="barberCitasData" :options="barberCitasOptions" />
              </div>
              <div class="min-w-0">
                <Bar
                  :data="barberIngresosData"
                  :options="barberIngresosOptions"
                />
              </div>
            </div>
            <div
              v-else
              class="flex h-52 items-center justify-center rounded-xl border border-dashed border-ink/[0.06]"
            >
              <p
                class="text-xs font-bold uppercase tracking-widest text-ink/45"
              >
                Sin datos de desempeño
              </p>
            </div>
          </div>

          <div class="rounded-2xl border border-ink/[0.06] bg-card p-5">
            <div class="mb-5 flex items-center justify-between">
              <div>
                <p
                  class="text-[9px] font-black uppercase tracking-[0.25em] text-ink/50"
                >
                  Mes actual
                </p>
                <h3 class="mt-0.5 text-sm font-black uppercase text-ink">
                  Tendencia de Clientes
                </h3>
              </div>
              <div class="h-2 w-2 rounded-full bg-purple-400" />
            </div>
            <div v-if="hasClientTrends" class="h-52">
              <Line :data="clientTrendsData" :options="clientTrendsOptions" />
            </div>
            <div
              v-else
              class="flex h-52 items-center justify-center rounded-xl border border-dashed border-ink/[0.06]"
            >
              <p
                class="text-xs font-bold uppercase tracking-widest text-ink/45"
              >
                Sin datos de tendencias
              </p>
            </div>
          </div>
        </section>

        <section class="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <div
            class="rounded-2xl border border-ink/[0.06] bg-card p-5 lg:col-span-5"
          >
            <div class="mb-5">
              <p
                class="text-[9px] font-black uppercase tracking-[0.25em] text-ink/50"
              >
                Próximos 7 días
              </p>
              <h3
                class="mt-0.5 flex items-center gap-2 text-sm font-black uppercase text-ink"
              >
                Predicciones IA
                <span
                  class="rounded-full border border-indigo-500/30 bg-indigo-500/10 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest text-indigo-400"
                  >Beta</span
                >
              </h3>
            </div>

            <div class="mb-5 grid grid-cols-3 gap-3">
              <div
                class="rounded-[8px] border border-ink/[0.05] bg-ink/[0.02] p-3 text-center"
              >
                <p
                  class="mb-2 text-[8px] font-black uppercase tracking-wider text-ink/50"
                >
                  Ingresos Est.
                </p>
                <p class="text-lg font-black text-emerald-400">
                  <span
                    v-if="incomeForecast === null"
                    class="inline-block h-1 w-8 animate-pulse rounded bg-emerald-500/25"
                  />
                  <template v-else>{{ incomeForecast }}</template>
                </p>
              </div>
              <div
                class="rounded-[8px] border border-ink/[0.05] bg-ink/[0.02] p-3 text-center"
              >
                <p
                  class="mb-2 text-[8px] font-black uppercase tracking-wider text-ink/50"
                >
                  Citas Est.
                </p>
                <p class="text-lg font-black text-blue-400">
                  <span
                    v-if="appointmentForecast === null"
                    class="inline-block h-1 w-8 animate-pulse rounded bg-blue-500/25"
                  />
                  <template v-else>{{ appointmentForecast }}</template>
                </p>
              </div>
              <div
                class="rounded-[8px] border border-ink/[0.05] bg-ink/[0.02] p-3 text-center"
              >
                <p
                  class="mb-2 text-[8px] font-black uppercase tracking-wider text-ink/50"
                >
                  Confianza
                </p>
                <p class="text-lg font-black text-indigo-400">
                  <span
                    v-if="aiConfidence === null"
                    class="inline-block h-1 w-8 animate-pulse rounded bg-indigo-500/25"
                  />
                  <template v-else>{{ aiConfidence }}</template>
                </p>
              </div>
            </div>

            <div>
              <p
                class="mb-3 text-[9px] font-black uppercase tracking-[0.2em] text-ink/45"
              >
                Insights
              </p>
              <div class="space-y-2">
                <div
                  v-if="aiInsights === null"
                  class="flex animate-pulse items-start gap-2 rounded-xl border border-ink/[0.05] bg-ink/[0.02] p-3"
                >
                  <div
                    class="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400"
                  />
                  <p class="text-[10px] text-ink/45">Cargando análisis...</p>
                </div>
                <p
                  v-else-if="!aiInsights.length"
                  class="text-[10px] italic text-ink/45"
                >
                  Sin insights disponibles.
                </p>
                <div
                  v-for="insight in aiInsights ?? []"
                  :key="`${insight.status}-${insight.message}`"
                  class="flex items-start gap-2 rounded-xl border p-3"
                  :class="
                    (AI_STATUS_STYLE[insight.status] ?? AI_STATUS_STYLE.neutral)
                      .cls
                  "
                >
                  <div
                    class="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                    :class="
                      (
                        AI_STATUS_STYLE[insight.status] ??
                        AI_STATUS_STYLE.neutral
                      ).dot
                    "
                  />
                  <p class="text-[10px] text-ink/60">{{ insight.message }}</p>
                </div>
              </div>
            </div>
          </div>

          <div
            class="rounded-2xl border border-ink/[0.06] bg-card p-5 lg:col-span-7"
          >
            <div class="mb-5 flex items-center justify-between">
              <div>
                <p
                  class="text-[9px] font-black uppercase tracking-[0.25em] text-ink/50"
                >
                  Últimos {{ data.chatbotTelemetry.window_days ?? 7 }} días
                </p>
                <h3
                  class="mt-0.5 flex items-center gap-2 text-sm font-black uppercase text-ink"
                >
                  Telemetría Chatbot
                  <span
                    class="flex items-center gap-1 text-[8px] font-black uppercase text-emerald-400"
                  >
                    <span
                      class="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400"
                    />OK
                  </span>
                </h3>
              </div>
            </div>

            <div class="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div
                class="rounded-[8px] border border-ink/[0.05] bg-ink/[0.02] p-3"
              >
                <p
                  class="mb-1.5 text-[8px] font-black uppercase tracking-wider text-ink/50"
                >
                  Eventos
                </p>
                <p class="text-lg font-black text-blue-400">
                  {{ data.chatbotTelemetry.total_requests ?? 0 }}
                </p>
              </div>
              <div
                class="rounded-[8px] border border-ink/[0.05] bg-ink/[0.02] p-3"
              >
                <p
                  class="mb-1.5 text-[8px] font-black uppercase tracking-wider text-ink/50"
                >
                  Error Rate
                </p>
                <p class="text-lg font-black text-red-400">
                  {{ (data.chatbotTelemetry.error_rate_pct ?? 0).toFixed(1) }}%
                </p>
              </div>
              <div
                class="rounded-[8px] border border-ink/[0.05] bg-ink/[0.02] p-3"
              >
                <p
                  class="mb-1.5 text-[8px] font-black uppercase tracking-wider text-ink/50"
                >
                  Latencia Prom.
                </p>
                <p class="text-lg font-black text-sky-400">
                  {{ data.chatbotTelemetry.avg_latency_ms ?? 0 }}ms
                </p>
              </div>
              <div
                class="rounded-[8px] border border-ink/[0.05] bg-ink/[0.02] p-3"
              >
                <p
                  class="mb-1.5 text-[8px] font-black uppercase tracking-wider text-ink/50"
                >
                  Costo Est.
                </p>
                <p class="text-lg font-black text-emerald-400">
                  ${{
                    (data.chatbotTelemetry.estimated_cost_usd ?? 0).toFixed(4)
                  }}
                </p>
              </div>
            </div>

            <div
              v-if="
                data.chatbotTelemetry.top_sources &&
                Object.keys(data.chatbotTelemetry.top_sources).length
              "
            >
              <p
                class="mb-3 text-[9px] font-black uppercase tracking-[0.2em] text-ink/45"
              >
                Top Fuentes
              </p>
              <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div
                  v-for="(count, source) in data.chatbotTelemetry.top_sources"
                  :key="source"
                  class="flex items-center justify-between rounded-xl border border-ink/[0.05] bg-ink/[0.02] px-3 py-2"
                >
                  <span
                    class="truncate text-[9px] font-bold uppercase text-ink"
                    >{{ String(source).replace(/_/g, " ") }}</span
                  >
                  <span class="ml-2 shrink-0 text-[9px] font-black text-gold">{{
                    count
                  }}</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </section>
  </div>
</template>
