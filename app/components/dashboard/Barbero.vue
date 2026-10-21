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
  chartSeries,
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

// Avance del día: citas terminadas sobre las de hoy (sin contar canceladas ni inasistencias).
const activeToday = computed(() => props.data.barberToday.filter((a) => !["cancelada", "no_asistio"].includes(a.estado)));
const doneToday = computed(() => activeToday.value.filter((a) => a.estado === "completada").length);
const dayPct = computed(() => (activeToday.value.length ? doneToday.value / activeToday.value.length : 0));
const RING = 2 * Math.PI * 22;

const kpiCards = computed(() => [
  { label: "Ingresos del mes", value: fmtMoney(props.data.kpis.income_month), hint: "Servicios cobrados" },
  { label: "Propinas del mes", value: fmtMoney(props.data.kpis.tips_month), hint: "Directo para ti" },
  { label: "Citas del mes", value: fmtInt(props.data.kpis.appointments_month), hint: `${fmtInt(props.data.kpis.appointments_today)} hoy` },
  { label: "Calificación", value: props.data.kpis.rating ? `${Number(props.data.kpis.rating).toFixed(1)} ★` : "—", hint: "Promedio de reseñas" },
]);

const actingOn = ref<string | null>(null);
const actionError = ref("");
const ticket = ref<ServiceTicket | null>(null);

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

// Acción de un toque sobre una cita de hoy: sigue el flujo lineal confirmada → en proceso → completada.
// Al terminar, el backend devuelve el ticket del servicio y se muestra igual que en la agenda.
async function advance(appt: BarberAppointment, estado: "en_proceso" | "completada" | "no_asistio") {
  if (estado === "no_asistio") {
    const accepted = await confirm({
      title: "Marcar como no asistió",
      message: `${appt.cliente} no llegó. Se le generará un cargo por inasistencia (se cobra a su tarjeta guardada o queda como adeudo en recepción). ¿Continuar?`,
      confirmText: "No asistió",
      isDanger: true,
    });
    if (!accepted) return;
  }

  actingOn.value = appt.id;
  actionError.value = "";
  try {
    const res = await apiFetch<{ ticket?: ServiceTicket | null }>(`/appointments/${appt.code}/status`, {
      method: "PATCH",
      body: { estado },
    });
    // El panel se desmonta mientras recarga, así que con ticket la recarga espera a que se cierre.
    if (estado === "completada" && res?.ticket) ticket.value = res.ticket;
    else emit("refresh");
  } catch (err: unknown) {
    actionError.value =
      (err as { data?: { message?: string } })?.data?.message ??
      "No se pudo actualizar la cita.";
  } finally {
    actingOn.value = null;
  }
}

function closeTicket() {
  ticket.value = null;
  emit("refresh");
}

// Color del borde izquierdo de cada cita según su estado: de un vistazo se ve qué está en curso y qué sigue.
const EDGE: Record<string, string> = {
  en_proceso: "border-l-success",
  confirmada: "border-l-gold",
  pendiente: "border-l-warning",
  completada: "border-l-line",
  cancelada: "border-l-line",
  no_asistio: "border-l-line",
};

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
</script>

<template>
  <div class="space-y-5">
    <header class="flex items-center justify-between gap-4">
      <div>
        <p class="text-xs font-semibold uppercase tracking-[0.18em] text-muted">{{ data.todayLabel }}</p>
        <h2 class="mt-1 text-2xl font-semibold text-ink">Buen día, <span class="text-gold">{{ firstName }}</span></h2>
        <p class="mt-1 text-sm text-muted">
          <template v-if="activeToday.length">
            {{ doneToday === activeToday.length ? "Terminaste todas las citas de hoy." : `Llevas ${doneToday} de ${activeToday.length} citas de hoy.` }}
          </template>
          <template v-else>Hoy no tienes citas agendadas.</template>
          <template v-if="data.barberPending.length"> Hay <strong class="text-warning">{{ data.barberPending.length }}</strong> por aprobar.</template>
        </p>
      </div>
      <svg class="h-16 w-16 shrink-0" viewBox="0 0 54 54" role="img" :aria-label="`${doneToday} de ${activeToday.length} citas terminadas`">
        <circle cx="27" cy="27" r="22" fill="none" stroke="rgb(var(--ink-rgb) / 0.12)" stroke-width="6" />
        <circle
          cx="27" cy="27" r="22" fill="none" stroke="var(--gold)" stroke-width="6" stroke-linecap="round"
          :stroke-dasharray="`${(dayPct * RING).toFixed(1)} ${RING.toFixed(1)}`" transform="rotate(-90 27 27)"
          style="transition: stroke-dasharray 700ms cubic-bezier(0.22, 1, 0.36, 1)"
        />
        <text x="27" y="31" text-anchor="middle" font-size="12" font-weight="600" fill="var(--ink)">{{ doneToday }}/{{ activeToday.length }}</text>
      </svg>
    </header>

    <p v-if="actionError" role="alert" class="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
      {{ actionError }}
    </p>

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
              class="min-h-11 rounded-xl bg-gold px-4 text-sm font-semibold text-black transition-colors hover:bg-gold-dim focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold disabled:opacity-50"
              @click="setStatus(appt, 'confirmada')"
            >
              Aprobar
            </button>
            <button
              type="button"
              :disabled="actingOn === appt.id"
              class="min-h-11 rounded-xl border border-line px-4 text-sm font-semibold text-muted transition-colors hover:border-danger/40 hover:text-danger focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold disabled:opacity-50"
              @click="setStatus(appt, 'cancelada')"
            >
              Rechazar
            </button>
          </div>
        </li>
      </ul>
    </section>

    <section aria-labelledby="barber-today">
      <header class="mb-3 flex items-center justify-between">
        <div>
          <h3 id="barber-today" class="text-base font-semibold text-ink">Tu agenda de hoy</h3>
          <p class="mt-0.5 text-sm text-muted">Toca el botón de cada cita para avanzarla</p>
        </div>
        <NuxtLink to="/barber/agenda" class="text-sm font-semibold text-gold hover:underline">Ver mi agenda</NuxtLink>
      </header>
      <p
        v-if="!data.barberToday.length"
        class="rounded-2xl border border-dashed border-line py-10 text-center text-sm text-muted"
      >
        No tienes citas hoy. Disfruta el descanso.
      </p>
      <ul v-else class="space-y-3">
        <li
          v-for="appt in data.barberToday"
          :key="appt.id"
          class="ub-rise rounded-2xl border border-l-[5px] border-line bg-card p-4"
          :class="[EDGE[appt.estado] ?? 'border-l-line', ['completada', 'cancelada', 'no_asistio'].includes(appt.estado) ? 'opacity-70' : '']"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="truncate text-base font-semibold text-ink">
                <span class="tabular-nums" :class="appt.isNext || appt.estado === 'en_proceso' ? 'text-gold' : ''">{{ appt.hora_inicio?.slice(0, 5) ?? "--:--" }}</span>
                · {{ appt.cliente }}
              </p>
              <p class="truncate text-sm text-muted">{{ appt.servicio }} · hasta {{ appt.hora_fin?.slice(0, 5) }}</p>
            </div>
            <UiBadge :tone="appointmentStatus(appt.estado).tone" class="shrink-0">
              {{ appt.isNext && appt.estado === "confirmada" ? "Siguiente" : appointmentStatus(appt.estado).label }}
            </UiBadge>
          </div>
          <div v-if="['confirmada', 'en_proceso'].includes(appt.estado)" class="mt-3 flex flex-wrap gap-2">
            <button
              v-if="appt.estado === 'confirmada'"
              type="button"
              :disabled="actingOn === appt.id"
              class="min-h-11 rounded-xl bg-gold px-4 text-sm font-semibold text-black transition-colors hover:bg-gold-dim focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold disabled:opacity-50"
              @click="advance(appt, 'en_proceso')"
            >
              Iniciar servicio
            </button>
            <button
              v-else
              type="button"
              :disabled="actingOn === appt.id"
              class="min-h-11 rounded-xl bg-success px-4 text-sm font-semibold text-black transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold disabled:opacity-50"
              @click="advance(appt, 'completada')"
            >
              Terminar servicio
            </button>
            <button
              v-if="appt.estado === 'confirmada'"
              type="button"
              :disabled="actingOn === appt.id"
              class="min-h-11 rounded-xl border border-line px-4 text-sm font-semibold text-muted transition-colors hover:border-danger/40 hover:text-danger focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold disabled:opacity-50"
              @click="advance(appt, 'no_asistio')"
            >
              No asistió
            </button>
          </div>
        </li>
      </ul>
    </section>

    <section class="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="Tu mes">
      <div v-for="kpi in kpiCards" :key="kpi.label" class="ub-rise rounded-2xl border border-line bg-card p-4">
        <p class="text-[11px] font-bold uppercase tracking-wide text-muted">{{ kpi.label }}</p>
        <p class="mt-1 text-xl font-semibold tabular-nums text-ink">{{ kpi.value }}</p>
        <p class="text-xs text-muted">{{ kpi.hint }}</p>
      </div>
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

    <DashboardAnalyticsInsights :insights="data.sparkHighlights" titulo="Tus oportunidades" />

    <UiServiceTicketModal v-if="ticket" :ticket="ticket" @close="closeTicket" />
  </div>
</template>
