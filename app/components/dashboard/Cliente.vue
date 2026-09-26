<script setup lang="ts">
import { Bar } from "vue-chartjs";
import type { DashboardInsight } from "~/components/dashboard/AnalyticsInsights.vue";
import { appointmentStatus } from "~/utils/appointmentStatus";
import { chartAxisClean, chartScale, chartTooltip, fmtInt, goldRgba } from "~/utils/chartTheme";
import { ensureChartjsRegistered } from "~/utils/registerChartjs";

ensureChartjsRegistered();

interface NextAppointment {
  id: string;
  fecha: string;
  hora_inicio: string;
  estado: string;
  service: { nombre: string } | null;
  barber: { user: { name: string } | null } | null;
  day: string;
  monthShort: string;
  dateLong: string;
  canManage: boolean;
}

interface ClienteData {
  todayLabel: string;
  kpis: {
    total_appointments: number;
    completed_appointments: number;
    completion_rate: number;
    cancellation_rate: number;
    favorite_barber: string;
    membership_status: string;
  };
  nextAppointment: NextAppointment | null;
  visitChart: { labels: string[]; values: number[] };
  loyalty: {
    nivel: string;
    nivelLabel: string;
    puntos: number;
    discountPct: number;
    nextNivel: string | null;
    nextNivelLabel: string | null;
    citasFaltan: number;
    progressPct: number;
    recentTransactions: Array<{ descripcion: string; puntos: number }>;
    wonRaffle: {
      mes: string;
      premio: string;
      isExpired: boolean;
      venceEn: string;
    } | null;
  };
  member: {
    number: string;
    since: string;
    qr: string | null;
    downloadUrl: string | null;
  };
  recommendation: { valorDestacado: string; mensaje: string } | null;
  // El backend no manda este campo para cliente (a diferencia de recepción/
  // barbero) — el equivalente para este rol es `recommendation`. Opcional
  // aquí a propósito, mismo criterio que el default de Vue en la versión
  // Inertia (Cliente.vue: `sparkHighlights: { default: () => [] }`).
  sparkHighlights?: DashboardInsight[];
}

const props = defineProps<{
  data: ClienteData;
  firstName: string;
  fullName: string;
}>();

const safeProgress = computed(() =>
  Math.max(0, Math.min(100, Number(props.data.loyalty.progressPct) || 0)),
);

const summaryCards = computed(() => {
  const k = props.data.kpis;
  const completion = Number(k.completion_rate ?? 0);
  const cancellation = Number(k.cancellation_rate ?? 0);

  return [
    { label: "Visitas", value: fmtInt(k.total_appointments), hint: `${fmtInt(k.completed_appointments)} completadas`, progress: null },
    { label: "Asistencia", value: `${completion.toFixed(0)}%`, hint: "Citas a las que llegaste", progress: completion },
    {
      label: "Cancelaciones",
      value: `${cancellation.toFixed(0)}%`,
      hint: cancellation <= 20 ? "Dentro de lo normal" : "Cancela con tiempo para no perder beneficios",
      progress: cancellation,
    },
    {
      label: "Puntos",
      value: fmtInt(props.data.loyalty.puntos),
      hint: props.data.loyalty.nextNivel ? `Rumbo a ${props.data.loyalty.nextNivelLabel}` : "Nivel máximo",
      progress: props.data.loyalty.nextNivel ? safeProgress.value : null,
    },
  ];
});

const benefits = computed(() => {
  const nivel = props.data.loyalty.nivel;
  const isVipOrAbove = ["vip", "leyenda"].includes(nivel);
  const isRegularOrAbove = ["regular", "vip", "leyenda"].includes(nivel);
  const discountPct = props.data.loyalty.discountPct;

  return [
    {
      active: discountPct > 0,
      label: discountPct > 0 ? `${discountPct}% descuento` : "Sin descuento",
      icon: "M7 7h.01M17 17h.01M19 5l-14 14M9.5 7a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0zm10 10a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z",
    },
    {
      active: isVipOrAbove,
      label: isVipOrAbove ? "Sorteo mensual" : "Requiere VIP",
      icon: "M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4 2 2 0 010 4zm14 0a2 2 0 110-4 2 2 0 010 4z",
    },
    {
      active: isRegularOrAbove,
      label: isRegularOrAbove ? "Reserva prio." : "Requiere Regular",
      icon: "M13 10V3L4 14h7v7l9-11h-7z",
    },
    {
      active: nivel === "leyenda",
      label: nivel === "leyenda" ? "Prod. gratis/mes" : "Requiere Leyenda",
      icon: "M20 12v10H4V12M22 7H2v5h20V7zM12 22V7m0 0a2 2 0 10-4 0m4 0a2 2 0 114 0",
    },
  ];
});

const visitValues = computed(() =>
  (props.data.visitChart.values ?? []).map(Number),
);
const visitLabels = computed(() => props.data.visitChart.labels ?? []);
const hasVisits = computed(() => visitValues.value.some((v) => v));
const visitTotal6 = computed(() =>
  visitValues.value.reduce((a, b) => a + b, 0),
);
const visitPeak = computed(() => {
  const peak = Math.max(0, ...visitValues.value);
  if (peak === 0) return "—";

  return visitLabels.value[visitValues.value.indexOf(peak)] ?? "—";
});

const visitChartData = computed(() => ({
  labels: visitLabels.value,
  datasets: [
    {
      label: "Visitas",
      data: visitValues.value,
      backgroundColor: visitValues.value.map((_, i, all) => goldRgba(i === all.length - 1 ? 0.95 : 0.4)),
      hoverBackgroundColor: goldRgba(1),
      borderRadius: 6,
      maxBarThickness: 36,
    },
  ],
}));

const visitChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      ...chartTooltip(),
      callbacks: {
        label: (ctx: { parsed: { y: number } }) => `${ctx.parsed.y} visita${ctx.parsed.y === 1 ? "" : "s"}`,
      },
    },
  },
  scales: {
    y: { ...chartScale(), beginAtZero: true, ticks: { ...chartScale().ticks, precision: 0, maxTicksLimit: 4 } },
    x: chartAxisClean(),
  },
};
</script>

<template>
  <div class="space-y-5">
    <DashboardHeader
      label="Personal"
      color="text-gold"
      :today-label="data.todayLabel"
    />

    <section class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <p class="text-sm text-muted">
        Hola, <span class="font-semibold text-ink">{{ firstName }}</span>. Aquí están tu próxima cita, tus puntos y tus beneficios.
      </p>
      <nav class="flex flex-wrap gap-2" aria-label="Accesos rápidos">
        <NuxtLink to="/my/appointments" class="ui-btn min-h-10 px-4 text-sm">Reservar</NuxtLink>
        <NuxtLink
          v-for="a in [{ label: 'Mis citas', to: '/my/appointments' }, { label: 'Barberos', to: '/barbers' }, { label: 'Tienda', to: '/store' }]"
          :key="a.label"
          :to="a.to"
          class="inline-flex min-h-10 items-center rounded-xl border border-line px-4 text-sm font-semibold text-ink transition-colors hover:border-gold/40"
        >
          {{ a.label }}
        </NuxtLink>
      </nav>
    </section>

    <section class="grid grid-cols-1 gap-4 xl:grid-cols-12">
      <article
        class="ub-rise overflow-hidden rounded-2xl border bg-card xl:col-span-7"
        :class="data.nextAppointment ? 'border-gold/40' : 'border-dashed border-line'"
        aria-label="Tu próxima cita"
      >
        <div v-if="data.nextAppointment" class="grid md:grid-cols-[170px_1fr]">
          <div class="flex items-center justify-center gap-5 bg-gold p-5 text-black md:flex-col md:gap-2">
            <div class="text-center">
              <p class="text-xs font-semibold opacity-70">Próxima cita</p>
              <p class="text-4xl font-bold leading-none">{{ data.nextAppointment.day }}</p>
              <p class="text-sm font-semibold uppercase opacity-80">{{ data.nextAppointment.monthShort }}</p>
            </div>
            <p class="text-2xl font-bold tabular-nums">{{ data.nextAppointment.hora_inicio?.slice(0, 5) }}</p>
          </div>
          <div class="flex flex-col justify-center gap-3 p-6">
            <UiBadge :tone="appointmentStatus(data.nextAppointment.estado).tone" class="self-start">
              {{ appointmentStatus(data.nextAppointment.estado).label }}
            </UiBadge>
            <div>
              <h3 class="text-2xl font-semibold leading-tight text-ink">
                {{ data.nextAppointment.service?.nombre ?? "Servicio" }}
              </h3>
              <p class="mt-1 text-sm text-muted">
                Con <span class="font-semibold text-ink">{{ data.nextAppointment.barber?.user?.name ?? "tu barbero" }}</span>
                · {{ data.nextAppointment.dateLong }}
              </p>
            </div>
            <NuxtLink to="/my/appointments" class="self-start text-sm font-semibold text-gold hover:underline">
              Ver o cambiar mi cita →
            </NuxtLink>
          </div>
        </div>
        <div v-else class="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 class="text-lg font-semibold text-ink">No tienes citas próximas</h3>
            <p class="mt-1 text-sm text-muted">Reserva tu siguiente visita y mantén tu estilo.</p>
          </div>
          <NuxtLink to="/my/appointments" class="ui-btn min-h-10 shrink-0 px-5 text-sm">Reservar</NuxtLink>
        </div>
      </article>

      <article class="ub-rise rounded-2xl border border-line bg-card p-6 xl:col-span-5" aria-label="Recomendación para ti">
        <div class="flex items-center gap-2">
          <span class="flex h-8 w-8 items-center justify-center rounded-lg bg-gold/10 text-gold" aria-hidden="true">
            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
          </span>
          <p class="text-sm font-medium text-muted">Recomendación para ti</p>
        </div>
        <template v-if="data.recommendation">
          <p class="mt-3 text-xl font-semibold leading-tight text-ink">{{ data.recommendation.valorDestacado }}</p>
          <p class="mt-2 line-clamp-3 text-sm leading-relaxed text-muted">{{ data.recommendation.mensaje }}</p>
        </template>
        <template v-else>
          <p class="mt-3 text-lg font-semibold text-ink">Aún conocemos poco de tus gustos</p>
          <p class="mt-2 text-sm leading-relaxed text-muted">
            Con algunas visitas más te sugeriremos servicios y productos según tu historial.
          </p>
        </template>
      </article>
    </section>

    <section class="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="Tu resumen">
      <UiStatCard
        v-for="card in summaryCards"
        :key="card.label"
        :label="card.label"
        :value="card.value"
        :hint="card.hint"
        :progress="card.progress"
      />
    </section>

    <section class="grid grid-cols-1 gap-4 lg:grid-cols-12">
      <UiChartCard
        class="self-start lg:col-span-7"
        title="Tus visitas"
        subtitle="Últimos 6 meses"
        :empty="!hasVisits"
        empty-text="Después de tus primeras visitas verás aquí tu historial por mes."
      >
        <template #action>
          <div class="text-right">
            <p class="text-sm font-semibold text-ink">{{ visitTotal6 }} visitas</p>
            <p class="text-xs text-muted">Mejor mes: {{ visitPeak }}</p>
          </div>
        </template>
        <Bar :data="visitChartData" :options="visitChartOptions" />
      </UiChartCard>

      <div class="space-y-4 lg:col-span-5">
        <DashboardMembershipCard
          :nivel="data.loyalty.nivel"
          :label="data.loyalty.nivelLabel"
          :puntos="data.loyalty.puntos"
          :nombre="fullName"
          :numero="data.member.number"
          :desde="data.member.since"
          :qr="data.member.qr"
          :download-url="data.member.downloadUrl"
        />

        <section class="ub-rise space-y-4 rounded-2xl border border-line bg-card p-5" aria-labelledby="cliente-lealtad">
          <div class="flex items-center gap-4">
            <div
              class="grid h-16 w-16 shrink-0 place-items-center rounded-full"
              :style="{ background: `conic-gradient(var(--gold) ${Math.round(safeProgress)}%, rgb(var(--ink-rgb) / 0.1) 0)` }"
              role="img"
              :aria-label="`${Math.round(safeProgress)}% hacia el siguiente nivel`"
            >
              <span class="grid h-12 w-12 place-items-center rounded-full bg-card text-sm font-semibold tabular-nums text-ink">
                {{ Math.round(safeProgress) }}%
              </span>
            </div>
            <div class="min-w-0">
              <h3 id="cliente-lealtad" class="text-base font-semibold text-ink">Nivel {{ data.loyalty.nivelLabel }}</h3>
              <p v-if="data.loyalty.nextNivel" class="mt-0.5 text-sm text-muted">
                {{ data.loyalty.citasFaltan > 0
                  ? `Te faltan ${data.loyalty.citasFaltan} visita${data.loyalty.citasFaltan !== 1 ? "s" : ""} para ${data.loyalty.nextNivelLabel}`
                  : `Listo para subir a ${data.loyalty.nextNivelLabel}` }}
              </p>
              <p v-else class="mt-0.5 text-sm text-muted">Tienes el nivel máximo. Sigue sumando beneficios.</p>
            </div>
          </div>

          <ul class="grid grid-cols-2 gap-2" aria-label="Beneficios de tu nivel">
            <li
              v-for="ben in benefits"
              :key="ben.label"
              class="flex items-center gap-2 rounded-xl border p-2.5 text-sm"
              :class="ben.active ? 'border-gold/30 bg-gold/10 text-gold' : 'border-line text-muted'"
            >
              <svg class="h-4 w-4 shrink-0" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" :d="ben.icon" />
              </svg>
              <span class="leading-tight">{{ ben.label }}</span>
            </li>
          </ul>

          <div v-if="data.loyalty.recentTransactions.length">
            <p class="mb-2 text-sm font-medium text-muted">Últimos movimientos</p>
            <ul class="space-y-1.5">
              <li
                v-for="(tx, i) in data.loyalty.recentTransactions.slice(0, 4)"
                :key="`${tx.descripcion ?? ''}-${tx.puntos}-${i}`"
                class="flex items-center justify-between gap-2 text-sm"
              >
                <span class="truncate text-muted">{{ tx.descripcion }}</span>
                <span class="shrink-0 font-semibold tabular-nums" :class="tx.puntos > 0 ? 'text-success' : 'text-danger'">
                  {{ tx.puntos > 0 ? "+" : "" }}{{ tx.puntos }} pts
                </span>
              </li>
            </ul>
          </div>

          <div
            v-if="data.loyalty.wonRaffle"
            class="rounded-xl border p-3 text-sm"
            :class="data.loyalty.wonRaffle.isExpired ? 'border-line' : 'border-gold/30 bg-gold/10'"
          >
            <p class="font-semibold text-ink">Ganaste el sorteo de {{ data.loyalty.wonRaffle.mes }}</p>
            <p class="text-muted">{{ data.loyalty.wonRaffle.premio }}</p>
            <p v-if="data.loyalty.wonRaffle.isExpired" class="mt-1 text-danger">
              Caducó el {{ data.loyalty.wonRaffle.venceEn }} sin reclamarse
            </p>
            <p v-else class="mt-1 text-success">
              Válido hasta {{ data.loyalty.wonRaffle.venceEn }}: coméntalo en tu próxima cita
            </p>
          </div>
        </section>
      </div>
    </section>

    <DashboardAnalyticsInsights :insights="data.sparkHighlights ?? []" titulo="Tus oportunidades" />
  </div>
</template>
