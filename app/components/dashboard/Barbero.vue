<script setup lang="ts">
import { Bar } from "vue-chartjs";
import type { DashboardInsight } from "~/components/dashboard/AnalyticsInsights.vue";
import { appointmentStatus } from "~/utils/appointmentStatus";
import {
  chartAxisClean,
  chartScale,
  chartTooltip,
  fmtInt,
  fmtMoney,
  goldRgba,
  goldSeries,
} from "~/utils/chartTheme";
import { ensureChartjsRegistered } from "~/utils/registerChartjs";

ensureChartjsRegistered();

interface BarberAppointment {
  id: string;
  code: string;
  estado: string;
  hora_inicio: string;
  hora_fin: string;
  cliente: string;
  servicio: string;
  isNext: boolean;
}

interface BarberPending {
  id: string;
  code: string;
  fecha: string;
  hora_inicio: string;
  cliente: string;
  servicio: string;
}

interface BarberoData {
  todayLabel: string;
  kpis: {
    appointments_today: number;
    appointments_month: number;
    income_month: number;
    tips_month: number;
    rating: number;
  };
  performanceChart: { labels: string[]; values: number[] };
  servicesChart: { labels: string[]; values: number[] };
  barberToday: BarberAppointment[];
  barberPending: BarberPending[];
  sparkHighlights: DashboardInsight[];
}

const props = defineProps<{ data: BarberoData; firstName: string }>();
const emit = defineEmits<{ refresh: [] }>();

const { apiFetch } = useApi();
const { confirm } = useConfirm();

const kpiCards = computed(() => [
  { label: "Citas de hoy", value: fmtInt(props.data.kpis.appointments_today), hint: `${fmtInt(props.data.kpis.appointments_month)} este mes` },
  { label: "Por aprobar", value: fmtInt(props.data.barberPending.length), hint: "Solicitudes nuevas" },
  { label: "Ingresos del mes", value: fmtMoney(props.data.kpis.income_month), hint: "Servicios cobrados" },
  { label: "Propinas del mes", value: fmtMoney(props.data.kpis.tips_month), hint: "Directo para ti" },
  { label: "Calificación", value: props.data.kpis.rating ? `${Number(props.data.kpis.rating).toFixed(1)} ★` : "—", hint: "Promedio de reseñas" },
]);

const actingOn = ref<string | null>(null);
const actionError = ref("");

async function setStatus(
  appt: BarberPending,
  estado: "confirmada" | "cancelada",
) {
  if (estado === "cancelada") {
    const accepted = await confirm({
      title: "Rechazar solicitud",
      message: "¿Rechazar esta solicitud de cita?",
      confirmText: "Sí, rechazar",
      isDanger: true,
    });
    if (!accepted) return;
  }

  actingOn.value = appt.id;
  actionError.value = "";
  try {
    // Appointment usa HasPublicCode -> getRouteKeyName() = 'code', no 'id'
    // (ver .claude/skills/urbanblade-guardrails/SKILL.md en barber).
    await apiFetch(`/appointments/${appt.code}/status`, {
      method: "PATCH",
      body: { estado },
    });
    emit("refresh");
  } catch (err: unknown) {
    actionError.value =
      (err as { data?: { message?: string } })?.data?.message ??
      "No se pudo actualizar la cita.";
  } finally {
    actingOn.value = null;
  }
}

// barber manda el día con Carbon::format('D') (en inglés); aquí se muestra en español.
const DAY_ES: Record<string, string> = { Mon: "Lun", Tue: "Mar", Wed: "Mié", Thu: "Jue", Fri: "Vie", Sat: "Sáb", Sun: "Dom" };

const hasPerformance = computed(() =>
  (props.data.performanceChart.values ?? []).some((v) => v),
);
const performanceData = computed(() => {
  const values = props.data.performanceChart.values ?? [];

  return {
    labels: (props.data.performanceChart.labels ?? []).map((l) => DAY_ES[l] ?? l),
    datasets: [
      {
        label: "Citas",
        data: values,
        // Hoy (el último día) en oro pleno.
        backgroundColor: values.map((_, i) => goldRgba(i === values.length - 1 ? 0.95 : 0.4)),
        hoverBackgroundColor: goldRgba(1),
        borderRadius: 6,
        maxBarThickness: 32,
      },
    ],
  };
});
const performanceOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      ...chartTooltip(),
      callbacks: {
        label: (ctx: { parsed: { y: number } }) =>
          `${fmtInt(ctx.parsed.y)} cita${ctx.parsed.y === 1 ? "" : "s"}`,
      },
    },
  },
  scales: {
    y: { ...chartScale(), beginAtZero: true, ticks: { ...chartScale().ticks, precision: 0, maxTicksLimit: 5 } },
    x: chartAxisClean(),
  },
};

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
</script>

<template>
  <div class="space-y-5">
    <DashboardHeader
      label="Profesional"
      color="text-gold"
      :today-label="data.todayLabel"
    />

    <p class="text-sm text-muted">
      Hola, <span class="font-semibold text-ink">{{ firstName }}</span>. Tienes
      <strong class="text-ink">{{ data.kpis.appointments_today }}</strong>
      servicio{{ data.kpis.appointments_today !== 1 ? "s" : "" }} hoy<template v-if="data.barberPending.length">
        y <strong class="text-warning">{{ data.barberPending.length }}</strong>
        por aprobar</template>.
    </p>

    <p v-if="actionError" role="alert" class="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
      {{ actionError }}
    </p>

    <section class="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5" aria-label="Resumen">
      <UiStatCard
        v-for="kpi in kpiCards"
        :key="kpi.label"
        :label="kpi.label"
        :value="kpi.value"
        :hint="kpi.hint"
      />
    </section>

    <section
      v-if="data.barberPending.length"
      class="ub-rise rounded-2xl border border-warning/30 bg-warning/5 p-5"
      aria-labelledby="barber-pending"
    >
      <header class="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 id="barber-pending" class="text-base font-semibold text-ink">Esperando tu aprobación</h3>
          <p class="mt-0.5 text-sm text-muted">
            {{ data.barberPending.length }} solicitud{{ data.barberPending.length !== 1 ? "es" : "" }} de cita
          </p>
        </div>
        <UiBadge tone="warning">Por aprobar</UiBadge>
      </header>
      <ul class="divide-y divide-line">
        <li
          v-for="appt in data.barberPending"
          :key="appt.id"
          class="flex flex-wrap items-center gap-3 py-3"
        >
          <div class="w-20 shrink-0">
            <p class="text-sm font-semibold tabular-nums text-ink">{{ appt.hora_inicio?.slice(0, 5) ?? "--:--" }}</p>
            <p class="text-xs text-muted">{{ appt.fecha }}</p>
          </div>
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-semibold text-ink">{{ appt.cliente }}</p>
            <p class="truncate text-xs text-muted">{{ appt.servicio }}</p>
          </div>
          <div class="flex shrink-0 items-center gap-2">
            <button
              type="button"
              :disabled="actingOn === appt.id"
              class="min-h-10 rounded-lg bg-gold px-4 text-sm font-semibold text-black transition-colors hover:bg-gold-dim focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold disabled:opacity-50"
              @click="setStatus(appt, 'confirmada')"
            >
              Aprobar
            </button>
            <button
              type="button"
              :disabled="actingOn === appt.id"
              class="min-h-10 rounded-lg border border-line px-4 text-sm font-semibold text-muted transition-colors hover:border-danger/40 hover:text-danger focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold disabled:opacity-50"
              @click="setStatus(appt, 'cancelada')"
            >
              Rechazar
            </button>
          </div>
        </li>
      </ul>
    </section>

    <section class="ub-rise rounded-2xl border border-line bg-card p-5" aria-labelledby="barber-today">
      <header class="mb-3 flex items-center justify-between">
        <div>
          <h3 id="barber-today" class="text-base font-semibold text-ink">Tu agenda de hoy</h3>
          <p class="mt-0.5 text-sm text-muted">En orden de llegada</p>
        </div>
        <NuxtLink to="/appointments" class="text-sm font-semibold text-gold hover:underline">Ver todas</NuxtLink>
      </header>
      <p
        v-if="!data.barberToday.length"
        class="rounded-xl border border-dashed border-line py-10 text-center text-sm text-muted"
      >
        No tienes citas hoy.
      </p>
      <ul v-else class="divide-y divide-line">
        <li
          v-for="appt in data.barberToday"
          :key="appt.id"
          class="flex items-center gap-3 py-3"
          :class="appt.isNext ? '-mx-3 rounded-xl bg-gold/10 px-3' : ''"
        >
          <div class="w-16 shrink-0">
            <p class="text-sm font-semibold tabular-nums" :class="appt.isNext ? 'text-gold' : 'text-ink'">
              {{ appt.hora_inicio?.slice(0, 5) ?? "--:--" }}
            </p>
            <p class="text-xs tabular-nums text-muted">{{ appt.hora_fin?.slice(0, 5) }}</p>
          </div>
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-semibold text-ink">
              {{ appt.cliente }}
              <span v-if="appt.isNext" class="ml-1 text-xs font-semibold text-gold">· Siguiente</span>
            </p>
            <p class="truncate text-xs text-muted">{{ appt.servicio }}</p>
          </div>
          <UiBadge :tone="appointmentStatus(appt.estado).tone" class="shrink-0">
            {{ appointmentStatus(appt.estado).label }}
          </UiBadge>
        </li>
      </ul>
    </section>

    <section class="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <UiChartCard
        title="Tu semana"
        subtitle="Citas de los últimos 7 días"
        :empty="!hasPerformance"
        empty-text="Todavía no hay citas esta semana."
        height="h-56"
      >
        <Bar :data="performanceData" :options="performanceOptions" />
      </UiChartCard>
      <UiChartCard
        title="Tus servicios más pedidos"
        subtitle="Último año"
        :empty="!hasServices"
        empty-text="Todavía no hay servicios registrados."
        height="h-56"
      >
        <Bar :data="servicesData" :options="servicesOptions" />
      </UiChartCard>
    </section>

    <DashboardAnalyticsInsights :insights="data.sparkHighlights" titulo="Tus oportunidades" show-link />
  </div>
</template>
