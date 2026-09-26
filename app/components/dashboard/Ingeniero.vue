<script setup lang="ts">
/*
 * Dashboard del rol ingeniero (solo lectura, ver
 * .claude/skills/engineer-dashboard-plan/SKILL.md) -- a diferencia de
 * Administrador.vue (agenda operativa, acciones, lista de citas con
 * nombres de clientes), este es literalmente "el dashboard de cada
 * módulo": una tarjeta por módulo con su KPI + una gráfica, nada de
 * listas operativas ni acciones de gestión. Los datos vienen de
 * DashboardController::ingenieroPayload() en barber, que reusa
 * adminMetrics() pero omite a propósito todayAppointments/
 * recentAppointments (nombres de clientes).
 */
import { Bar, Line } from "vue-chartjs";
import type { DashboardInsight } from "~/components/dashboard/AnalyticsInsights.vue";
import {
  chartAxisClean,
  chartScale,
  chartTooltip,
  fmtInt,
  fmtMoney,
  goldRgba,
  goldSeries,
} from "~/utils/chartTheme";
import { untilToday } from "~/utils/chartBuckets";
import { ensureChartjsRegistered } from "~/utils/registerChartjs";

ensureChartjsRegistered();

interface IngenieroData {
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
  };
  moduleTelemetry?: {
    window_days?: number;
    payments?: {
      verified_month?: number;
      pending_review?: number;
      rejected_month?: number;
      amount_month?: number;
    };
    orders?: {
      pending?: number;
      delivered_month?: number;
      cancelled_month?: number;
    };
    campaigns?: {
      scheduled?: number;
      sent_month?: number;
      recipients_month?: number;
      opens_month?: number;
      clicks_month?: number;
    };
    raffles?: {
      redeemable?: number;
      claimed_month?: number;
      expired_unclaimed?: number;
    };
    social?: {
      works_month?: number;
      reactions_month?: number;
      comments_month?: number;
      saves_month?: number;
    };
  };
  insights: Array<{ titulo: string; dato: string; detalle: string }>;
  sparkHighlights: DashboardInsight[];
}

interface SystemStatusSummary {
  database: { status: "up" | "down"; latency_ms: number | null };
  redis: { status: "up" | "down"; latency_ms: number | null };
  queue: { pending: number | null; failed: number | null };
  scheduled_tasks: Array<{ status: "success" | "failed" | "unknown" }>;
}

const props = defineProps<{ data: IngenieroData }>();
const { apiFetch } = useApi();
const { data: systemStatus, pending: systemPending } = await useAsyncData(
  "engineer-system-status",
  () => apiFetch<SystemStatusSummary>("/admin/system/status"),
  { lazy: true },
);

const systemHealth = computed(() => {
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

const ratioActiveClients = computed(() =>
  props.data.kpis.total_clients > 0
    ? Math.round(
        (props.data.kpis.active_clients / props.data.kpis.total_clients) * 100,
      )
    : 0,
);
const busyCount = computed(
  () => (props.data.kpis.barbers_status ?? []).filter((s) => s.is_busy).length,
);
const freeCount = computed(
  () => (props.data.kpis.barbers_status ?? []).filter((s) => !s.is_busy).length,
);
const moduleTelemetry = computed(() => ({
  windowDays: props.data.moduleTelemetry?.window_days ?? 0,
  payments: {
    verified: props.data.moduleTelemetry?.payments?.verified_month ?? 0,
    pending: props.data.moduleTelemetry?.payments?.pending_review ?? 0,
    rejected: props.data.moduleTelemetry?.payments?.rejected_month ?? 0,
    amount: props.data.moduleTelemetry?.payments?.amount_month ?? 0,
  },
  orders: {
    pending: props.data.moduleTelemetry?.orders?.pending ?? 0,
    delivered: props.data.moduleTelemetry?.orders?.delivered_month ?? 0,
    cancelled: props.data.moduleTelemetry?.orders?.cancelled_month ?? 0,
  },
  campaigns: {
    scheduled: props.data.moduleTelemetry?.campaigns?.scheduled ?? 0,
    sent: props.data.moduleTelemetry?.campaigns?.sent_month ?? 0,
    recipients: props.data.moduleTelemetry?.campaigns?.recipients_month ?? 0,
    opens: props.data.moduleTelemetry?.campaigns?.opens_month ?? 0,
    clicks: props.data.moduleTelemetry?.campaigns?.clicks_month ?? 0,
  },
  raffles: {
    redeemable: props.data.moduleTelemetry?.raffles?.redeemable ?? 0,
    claimed: props.data.moduleTelemetry?.raffles?.claimed_month ?? 0,
    expired: props.data.moduleTelemetry?.raffles?.expired_unclaimed ?? 0,
  },
  social: {
    works: props.data.moduleTelemetry?.social?.works_month ?? 0,
    reactions: props.data.moduleTelemetry?.social?.reactions_month ?? 0,
    comments: props.data.moduleTelemetry?.social?.comments_month ?? 0,
    saves: props.data.moduleTelemetry?.social?.saves_month ?? 0,
  },
}));

const hasAppointmentTrend = computed(() =>
  appointmentTrend.value.values.some((v) => v),
);
const appointmentTrend = computed(() =>
  untilToday(props.data.clientTrends.labels ?? [], props.data.clientTrends.values ?? []),
);
const appointmentTrendData = computed(() => ({
  labels: appointmentTrend.value.labels,
  datasets: [
    {
      label: "Citas",
      data: appointmentTrend.value.values,
      borderColor: goldRgba(0.95),
      backgroundColor: goldRgba(0.1),
      borderWidth: 2.5,
      fill: true,
      cubicInterpolationMode: "monotone" as const,
      pointRadius: 2.5,
      pointHoverRadius: 5,
      pointBackgroundColor: goldRgba(1),
      pointBorderColor: goldRgba(1),
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

const hasIncome = computed(() =>
  (props.data.incomeChart.values ?? []).some((v) => v),
);
const incomeData = computed(() => ({
  labels: props.data.incomeChart.labels ?? [],
  datasets: [
    {
      label: "Ingresos ($)",
      data: props.data.incomeChart.values ?? [],
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

const hasServices = computed(() =>
  (props.data.servicesChart.values ?? []).some((v) => v),
);
const servicesSorted = computed(() =>
  (props.data.servicesChart.labels ?? [])
    .map((label, i) => ({ label, value: props.data.servicesChart.values?.[i] ?? 0 }))
    .sort((x, y) => y.value - x.value),
);
const servicesData = computed(() => ({
  labels: servicesSorted.value.map((s) => s.label),
  datasets: [
    {
      label: "Citas",
      data: servicesSorted.value.map((s) => s.value),
      backgroundColor: goldSeries(servicesSorted.value.length),
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
    (props.data.barberPerformance.appointments ?? []).some((v) => v) ||
    (props.data.barberPerformance.revenue ?? []).some((v) => v),
);
const barberData = computed(() => ({
  labels: props.data.barberPerformance.labels ?? [],
  datasets: [
    {
      label: "Citas",
      data: props.data.barberPerformance.appointments ?? [],
      backgroundColor: goldRgba(0.85),
      hoverBackgroundColor: goldRgba(1),
      borderRadius: 6,
      maxBarThickness: 24,
    },
  ],
}));
const barberOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      ...chartTooltip(),
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
    x: chartAxisClean(),
  },
};
</script>

<template>
  <div class="space-y-5">
    <DashboardHeader
      label="Ingeniería"
      color="text-gold"
      :today-label="data.todayLabel"
    >
      <span
        class="flex min-h-10 items-center gap-1.5 rounded-xl border border-ink/[0.08] bg-ink/[0.03] px-3 py-2 text-xs font-black uppercase tracking-widest text-ink/40"
      >
        <svg
          class="h-3 w-3"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
          />
        </svg>
        Solo lectura
      </span>
    </DashboardHeader>

    <section
      class="overflow-hidden rounded-2xl border border-ink/[0.08] bg-card p-5 sm:p-6"
      aria-label="Resumen técnico"
    >
      <div
        class="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between"
      >
        <div class="flex items-start gap-3">
          <span
            class="mt-1 h-3 w-3 shrink-0 rounded-full"
            :class="systemHealth.dot"
          />
          <div>
            <p
              class="text-[10px] font-black uppercase tracking-[0.2em] text-ink/45"
            >
              Centro de observabilidad
            </p>
            <h2 class="mt-1 text-xl font-black text-ink">
              Infraestructura
              <span :class="systemHealth.tone">{{ systemHealth.label }}</span>
            </h2>
            <p class="mt-1 text-sm text-muted">{{ systemHealth.detail }}</p>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div
            class="rounded-xl border border-ink/[0.06] bg-ink/[0.03] px-3 py-2"
          >
            <p
              class="text-xs font-medium text-muted"
            >
              MongoDB
            </p>
            <p
              class="mt-1 text-sm font-black"
              :class="
                systemStatus?.database.status === 'down'
                  ? 'text-danger'
                  : 'text-success'
              "
            >
              {{ systemStatus?.database.latency_ms ?? "—"
              }}<small
                v-if="systemStatus?.database.latency_ms !== null"
                class="ml-0.5 text-xs"
                >ms</small
              >
            </p>
          </div>
          <div
            class="rounded-xl border border-ink/[0.06] bg-ink/[0.03] px-3 py-2"
          >
            <p
              class="text-xs font-medium text-muted"
            >
              Redis
            </p>
            <p
              class="mt-1 text-sm font-black"
              :class="
                systemStatus?.redis.status === 'down'
                  ? 'text-danger'
                  : 'text-success'
              "
            >
              {{ systemStatus?.redis.latency_ms ?? "—"
              }}<small
                v-if="systemStatus?.redis.latency_ms !== null"
                class="ml-0.5 text-xs"
                >ms</small
              >
            </p>
          </div>
          <div
            class="rounded-xl border border-ink/[0.06] bg-ink/[0.03] px-3 py-2"
          >
            <p
              class="text-xs font-medium text-muted"
            >
              En cola
            </p>
            <p class="mt-1 text-sm font-black text-ink">
              {{ systemStatus?.queue.pending ?? "—" }}
            </p>
          </div>
          <NuxtLink
            to="/system"
            class="rounded-xl border border-gold/20 bg-gold/[0.06] px-3 py-2 transition hover:border-gold/50 hover:bg-gold/[0.1] focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-2"
            ><p
              class="text-[11px] font-black uppercase tracking-widest text-gold/70"
            >
              Detalle
            </p>
            <p class="mt-1 text-sm font-black text-gold">Monitor →</p></NuxtLink
          >
        </div>
      </div>
    </section>

    <p class="px-1 text-xs leading-relaxed text-muted">
      Comportamiento agregado de cada módulo del negocio, sin datos operativos
      de clientes individuales. Para el detalle completo, usa
      <NuxtLink to="/reports" class="text-gold hover:underline"
        >Reportes</NuxtLink
      >,
      <NuxtLink to="/logs" class="text-gold hover:underline">Logs</NuxtLink> o
      el
      <NuxtLink to="/system" class="text-gold hover:underline"
        >estado del servidor</NuxtLink
      >.
    </p>

    <div class="flex items-center gap-3 px-1 pt-1">
      <h2 class="text-lg font-semibold text-ink">Módulos del negocio</h2>
      <span class="h-px flex-1 bg-ink/[0.06]" />
    </div>

    <section class="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <!-- Módulo Citas -->
      <div class="ub-rise rounded-2xl border border-line bg-card p-5">
        <div class="mb-4 flex items-center justify-between">
          <div>
            <h3 class="text-base font-semibold text-ink">Citas</h3>
          </div>
          <div class="text-right">
            <p class="text-2xl font-semibold leading-none text-ink">
              {{ data.kpis.appointments_today }}
            </p>
            <p class="text-xs font-bold uppercase text-ink/40">hoy</p>
          </div>
        </div>
        <div v-if="hasAppointmentTrend" class="h-36">
          <Line
            :data="appointmentTrendData"
            :options="lineOptionsFor((v) => `${fmtInt(v)} citas`)"
          />
        </div>
        <div
          v-else
          class="flex h-36 items-center justify-center rounded-xl border border-dashed border-ink/[0.06]"
        >
          <p class="text-xs font-bold uppercase tracking-widest text-ink/45">
            Sin datos aún
          </p>
        </div>
        <div
          class="mt-3 flex items-center gap-2 text-xs font-black text-ink/50"
        >
          <span>Sem {{ data.kpis.appointments_week }}</span
          ><span>·</span><span>Mes {{ data.kpis.appointments_month }}</span>
          <span
            v-if="data.kpis.appointment_growth != 0"
            class="ml-auto"
            :class="
              data.kpis.appointment_growth >= 0
                ? 'text-success'
                : 'text-danger'
            "
          >
            {{ data.kpis.appointment_growth >= 0 ? "▲" : "▼"
            }}{{ Math.abs(data.kpis.appointment_growth) }}%
          </span>
        </div>
      </div>

      <!-- Módulo Ingresos -->
      <div class="ub-rise rounded-2xl border border-line bg-card p-5">
        <div class="mb-4 flex items-center justify-between">
          <div>
            <h3 class="text-base font-semibold text-ink">Ingresos</h3>
          </div>
          <div class="text-right">
            <p class="text-2xl font-semibold leading-none text-ink">
              {{ fmtMoney(data.kpis.income_today) }}
            </p>
            <p class="text-xs font-bold uppercase text-ink/40">hoy</p>
          </div>
        </div>
        <div v-if="hasIncome" class="h-36">
          <Line
            :data="incomeData"
            :options="lineOptionsFor((v) => fmtMoney(v))"
          />
        </div>
        <div
          v-else
          class="flex h-36 items-center justify-center rounded-xl border border-dashed border-ink/[0.06]"
        >
          <p class="text-xs font-bold uppercase tracking-widest text-ink/45">
            Sin datos aún
          </p>
        </div>
        <div
          class="mt-3 flex items-center gap-2 text-xs font-black text-ink/50"
        >
          <span>Sem {{ fmtMoney(data.kpis.income_week) }}</span
          ><span>·</span><span>Mes {{ fmtMoney(data.kpis.income_month) }}</span>
          <span
            v-if="data.kpis.income_growth != 0"
            class="ml-auto"
            :class="
              data.kpis.income_growth >= 0 ? 'text-success' : 'text-danger'
            "
          >
            {{ data.kpis.income_growth >= 0 ? "▲" : "▼"
            }}{{ Math.abs(data.kpis.income_growth) }}%
          </span>
        </div>
      </div>

      <!-- Módulo Servicios -->
      <div class="ub-rise rounded-2xl border border-line bg-card p-5">
        <div class="mb-4">
          <h3 class="text-base font-semibold text-ink">Servicios</h3>
        </div>
        <div v-if="hasServices" class="h-40">
          <Bar :data="servicesData" :options="servicesOptions" />
        </div>
        <div
          v-else
          class="flex h-40 items-center justify-center rounded-xl border border-dashed border-ink/[0.06]"
        >
          <p class="text-xs font-bold uppercase tracking-widest text-ink/45">
            Sin servicios registrados
          </p>
        </div>
      </div>

      <!-- Módulo Barberos -->
      <div class="ub-rise rounded-2xl border border-line bg-card p-5">
        <div class="mb-4 flex items-center justify-between">
          <div>
            <h3 class="text-base font-semibold text-ink">Barberos</h3>
          </div>
          <div class="flex gap-2 text-xs font-black uppercase">
            <span
              class="rounded-full border border-danger/20 bg-danger/[0.06] px-2 py-1 text-danger"
              >{{ busyCount }} ocupados</span
            >
            <span
              class="rounded-full border border-success/20 bg-success/[0.06] px-2 py-1 text-success"
              >{{ freeCount }} libres</span
            >
          </div>
        </div>
        <div v-if="hasBarberPerformance" class="h-32">
          <Bar :data="barberData" :options="barberOptions" />
        </div>
        <div
          v-else
          class="flex h-32 items-center justify-center rounded-xl border border-dashed border-ink/[0.06]"
        >
          <p class="text-xs font-bold uppercase tracking-widest text-ink/45">
            Sin datos de desempeño
          </p>
        </div>
        <p
          v-if="data.kpis.top_barber_name"
          class="mt-3 text-[10px] font-bold text-ink/50"
        >
          Top del mes:
          <span class="text-gold">{{ data.kpis.top_barber_name }}</span> ({{
            data.kpis.top_barber_total
          }}
          citas)
        </p>
      </div>

      <!-- Módulo Clientes -->
      <div class="ub-rise rounded-2xl border border-line bg-card p-5">
        <div class="mb-4 flex items-center justify-between">
          <div>
            <h3 class="text-base font-semibold text-ink">Clientes</h3>
          </div>
          <p class="text-2xl font-semibold leading-none text-ink">
            {{ data.kpis.active_clients }}
          </p>
        </div>
        <div class="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-ink/5">
          <div
            class="h-full rounded-full bg-info"
            :style="{ width: `${ratioActiveClients}%` }"
          />
        </div>
        <div
          class="mt-2 flex items-center gap-2 text-xs font-black text-ink/50"
        >
          <span class="text-info/80"
            >{{ ratioActiveClients }}% activos</span
          >
          <span>de {{ data.kpis.total_clients }} totales</span>
        </div>
        <div class="mt-4 grid grid-cols-2 gap-3">
          <div
            class="rounded-xl border border-ink/[0.05] bg-ink/[0.02] p-3 text-center"
          >
            <p class="text-lg font-semibold text-ink">
              {{ data.kpis.new_clients }}
            </p>
            <p class="text-[11px] font-black uppercase text-ink/45">Nuevos</p>
          </div>
          <div
            class="rounded-xl border border-ink/[0.05] bg-ink/[0.02] p-3 text-center"
          >
            <p class="text-lg font-semibold text-ink">
              {{ data.kpis.retention_rate.toFixed(1) }}%
            </p>
            <p class="text-[11px] font-black uppercase text-ink/45">Retención</p>
          </div>
        </div>
      </div>

      <!-- Módulo Inventario: el dashboard ya entrega este indicador agregado. -->
      <div class="ub-rise rounded-2xl border border-line bg-card p-5">
        <div class="mb-4 flex items-center justify-between">
          <div>
            <h3 class="text-base font-semibold text-ink">Inventario</h3>
          </div>
          <span
            class="rounded-full border px-2 py-1 text-xs font-black uppercase"
            :class="
              data.kpis.low_stock_count > 0
                ? 'border-warning/25 bg-warning/[0.06] text-warning'
                : 'border-success/25 bg-success/[0.06] text-success'
            "
            >{{ data.kpis.low_stock_count > 0 ? "Atención" : "Estable" }}</span
          >
        </div>
        <div
          class="flex items-end justify-between gap-4 rounded-xl border border-ink/[0.05] bg-ink/[0.02] p-4"
        >
          <div>
            <p
              class="text-3xl font-black"
              :class="
                data.kpis.low_stock_count > 0
                  ? 'text-warning'
                  : 'text-success'
              "
            >
              {{ data.kpis.low_stock_count }}
            </p>
            <p
              class="mt-1 text-xs font-black uppercase tracking-widest text-ink/45"
            >
              productos con stock bajo
            </p>
          </div>
          <svg
            class="h-9 w-9 shrink-0"
            :class="
              data.kpis.low_stock_count > 0
                ? 'text-warning'
                : 'text-success'
            "
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="1.5"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4M4 6v12a2 2 0 0 0 2 2h14v-4M18 12a2 2 0 0 0-2 2c0 1.1.9 2 2 2h4v-4h-4z"
            />
          </svg>
        </div>
        <p class="mt-3 text-[10px] leading-relaxed text-ink/50">
          Indicador agregado; el detalle de productos permanece fuera de este
          rol.
        </p>
      </div>

      <!-- Cobertura agregada de módulos operativos, sin abrir sus pantallas ni datos individuales. -->
      <div class="ub-rise rounded-2xl border border-line bg-card p-5">
        <div class="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 class="text-base font-semibold text-ink">Pagos</h3>
          </div>
          <span
            class="rounded-full border px-2 py-1 text-xs font-black uppercase"
            :class="
              moduleTelemetry.payments.pending > 0
                ? 'border-warning/25 bg-warning/[0.06] text-warning'
                : 'border-success/25 bg-success/[0.06] text-success'
            "
            >{{
              moduleTelemetry.payments.pending > 0 ? "Revisión" : "Al día"
            }}</span
          >
        </div>
        <p class="text-2xl font-semibold text-ink">
          {{ fmtMoney(moduleTelemetry.payments.amount) }}
        </p>
        <p class="text-xs font-black uppercase tracking-widest text-ink/45">
          recaudado en la ventana
        </p>
        <div class="mt-4 grid grid-cols-3 gap-2 text-center">
          <div class="rounded-lg bg-ink/[0.03] p-2">
            <p class="text-sm font-black text-success">
              {{ moduleTelemetry.payments.verified }}
            </p>
            <p class="text-[11px] font-black uppercase text-ink/45">
              Verificados
            </p>
          </div>
          <div class="rounded-lg bg-ink/[0.03] p-2">
            <p class="text-sm font-black text-warning">
              {{ moduleTelemetry.payments.pending }}
            </p>
            <p class="text-[11px] font-black uppercase text-ink/45">
              Pendientes
            </p>
          </div>
          <div class="rounded-lg bg-ink/[0.03] p-2">
            <p class="text-sm font-black text-danger">
              {{ moduleTelemetry.payments.rejected }}
            </p>
            <p class="text-[11px] font-black uppercase text-ink/45">
              Rechazados
            </p>
          </div>
        </div>
      </div>

      <div class="ub-rise rounded-2xl border border-line bg-card p-5">
        <div class="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 class="text-base font-semibold text-ink">Pedidos</h3>
          </div>
          <span
            class="rounded-full border px-2 py-1 text-xs font-black uppercase"
            :class="
              moduleTelemetry.orders.pending > 0
                ? 'border-warning/25 bg-warning/[0.06] text-warning'
                : 'border-success/25 bg-success/[0.06] text-success'
            "
            >{{ moduleTelemetry.orders.pending }} en espera</span
          >
        </div>
        <div class="grid grid-cols-3 gap-3 text-center">
          <div class="rounded-xl border border-ink/[0.05] bg-ink/[0.02] p-3">
            <p class="text-lg font-semibold text-warning">
              {{ moduleTelemetry.orders.pending }}
            </p>
            <p class="text-[11px] font-black uppercase text-ink/45">
              Pendientes
            </p>
          </div>
          <div class="rounded-xl border border-ink/[0.05] bg-ink/[0.02] p-3">
            <p class="text-lg font-semibold text-ink">
              {{ moduleTelemetry.orders.delivered }}
            </p>
            <p class="text-[11px] font-black uppercase text-ink/45">
              Entregados
            </p>
          </div>
          <div class="rounded-xl border border-ink/[0.05] bg-ink/[0.02] p-3">
            <p class="text-lg font-semibold text-danger">
              {{ moduleTelemetry.orders.cancelled }}
            </p>
            <p class="text-[11px] font-black uppercase text-ink/45">
              Cancelados
            </p>
          </div>
        </div>
      </div>

      <div class="ub-rise rounded-2xl border border-line bg-card p-5">
        <div class="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 class="text-base font-semibold text-ink">Campañas</h3>
          </div>
          <span class="text-xs font-black uppercase text-ink/40"
            >{{ moduleTelemetry.campaigns.scheduled }} programadas</span
          >
        </div>
        <div class="grid grid-cols-3 gap-2 text-center">
          <div class="rounded-lg bg-ink/[0.03] p-2">
            <p class="text-base font-semibold text-ink">
              {{ moduleTelemetry.campaigns.sent }}
            </p>
            <p class="text-[11px] font-black uppercase text-ink/45">Enviadas</p>
          </div>
          <div class="rounded-lg bg-ink/[0.03] p-2">
            <p class="text-base font-semibold text-ink">
              {{ moduleTelemetry.campaigns.opens }}
            </p>
            <p class="text-[11px] font-black uppercase text-ink/45">Aperturas</p>
          </div>
          <div class="rounded-lg bg-ink/[0.03] p-2">
            <p class="text-base font-semibold text-ink">
              {{ moduleTelemetry.campaigns.clicks }}
            </p>
            <p class="text-[11px] font-black uppercase text-ink/45">Clics</p>
          </div>
        </div>
        <p class="mt-3 text-[10px] text-ink/50">
          {{ fmtInt(moduleTelemetry.campaigns.recipients) }} destinatarios
          acumulados en la ventana.
        </p>
      </div>

      <div class="ub-rise rounded-2xl border border-line bg-card p-5">
        <div class="mb-4">
          <h3 class="text-base font-semibold text-ink">Sorteos</h3>
        </div>
        <div class="grid grid-cols-3 gap-2 text-center">
          <div class="rounded-lg bg-ink/[0.03] p-2">
            <p class="text-base font-semibold text-ink">
              {{ moduleTelemetry.raffles.redeemable }}
            </p>
            <p class="text-[11px] font-black uppercase text-ink/45">Vigentes</p>
          </div>
          <div class="rounded-lg bg-ink/[0.03] p-2">
            <p class="text-base font-semibold text-ink">
              {{ moduleTelemetry.raffles.claimed }}
            </p>
            <p class="text-[11px] font-black uppercase text-ink/45">Canjeados</p>
          </div>
          <div class="rounded-lg bg-ink/[0.03] p-2">
            <p class="text-base font-semibold text-danger">
              {{ moduleTelemetry.raffles.expired }}
            </p>
            <p class="text-[11px] font-black uppercase text-ink/45">Vencidos</p>
          </div>
        </div>
      </div>

      <div class="ub-rise rounded-2xl border border-line bg-card p-5">
        <div class="mb-4">
          <h3 class="text-base font-semibold text-ink">Muro</h3>
          <p class="mt-0.5 text-sm text-muted">Telemetría social</p>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div class="rounded-lg bg-ink/[0.03] p-2.5">
            <p class="text-base font-semibold text-ink">
              {{ moduleTelemetry.social.works }}
            </p>
            <p class="text-[11px] font-black uppercase text-ink/45">
              Publicaciones
            </p>
          </div>
          <div class="rounded-lg bg-ink/[0.03] p-2.5">
            <p class="text-base font-semibold text-ink">
              {{ moduleTelemetry.social.reactions }}
            </p>
            <p class="text-[11px] font-black uppercase text-ink/45">
              Reacciones
            </p>
          </div>
          <div class="rounded-lg bg-ink/[0.03] p-2.5">
            <p class="text-base font-semibold text-ink">
              {{ moduleTelemetry.social.comments }}
            </p>
            <p class="text-[11px] font-black uppercase text-ink/45">
              Comentarios
            </p>
          </div>
          <div class="rounded-lg bg-ink/[0.03] p-2.5">
            <p class="text-base font-semibold text-ink">
              {{ moduleTelemetry.social.saves }}
            </p>
            <p class="text-[11px] font-black uppercase text-ink/45">Guardados</p>
          </div>
        </div>
        <p class="mt-3 text-[10px] leading-relaxed text-ink/50">
          Sólo comportamiento agregado; el feed y sus acciones siguen fuera de
          este rol.
        </p>
      </div>

      <!-- Módulo Chatbot -->
      <div class="ub-rise rounded-2xl border border-line bg-card p-5">
        <div class="mb-4">
          <h3 class="text-base font-semibold text-ink">Bladebot</h3>
          <p class="text-xs font-bold text-ink/40">
            Últimos {{ data.chatbotTelemetry.window_days ?? 7 }} días
          </p>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div class="rounded-xl border border-ink/[0.05] bg-ink/[0.02] p-3">
            <p
              class="mb-1 text-[11px] font-black uppercase tracking-wider text-ink/50"
            >
              Consultas
            </p>
            <p class="text-lg font-semibold text-ink">
              {{ data.chatbotTelemetry.total_requests ?? 0 }}
            </p>
          </div>
          <div class="rounded-xl border border-ink/[0.05] bg-ink/[0.02] p-3">
            <p
              class="mb-1 text-[11px] font-black uppercase tracking-wider text-ink/50"
            >
              Con error
            </p>
            <p class="text-lg font-semibold text-danger">
              {{ (data.chatbotTelemetry.error_rate_pct ?? 0).toFixed(1) }}%
            </p>
          </div>
          <div class="rounded-xl border border-ink/[0.05] bg-ink/[0.02] p-3">
            <p
              class="mb-1 text-[11px] font-black uppercase tracking-wider text-ink/50"
            >
              Respuesta promedio
            </p>
            <p class="text-lg font-semibold text-ink">
              {{ ((data.chatbotTelemetry.avg_latency_ms ?? 0) / 1000).toFixed(1) }} s
            </p>
          </div>
          <div class="rounded-xl border border-ink/[0.05] bg-ink/[0.02] p-3">
            <p
              class="mb-1 text-[11px] font-black uppercase tracking-wider text-ink/50"
            >
              Costo estimado
            </p>
            <p class="text-lg font-semibold text-ink">
              ${{ (data.chatbotTelemetry.estimated_cost_usd ?? 0).toFixed(4) }}
            </p>
          </div>
        </div>
      </div>
    </section>

    <DashboardAnalyticsInsights :simple="data.insights" :insights="data.sparkHighlights" />
  </div>
</template>
