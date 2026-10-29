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

// Cuenta regresiva a la próxima cita. Se calcula en el cliente (después de montar) para que el
// servidor y el navegador no discrepen en el texto por unos segundos de diferencia.
const now = ref<Date | null>(null);
onMounted(() => {
  now.value = new Date();
  const timer = setInterval(() => { now.value = new Date(); }, 60000);
  onBeforeUnmount(() => clearInterval(timer));
});
const countdown = computed(() => {
  const appt = props.data.nextAppointment;
  if (!appt || !now.value) return "";
  const at = new Date(`${String(appt.fecha).slice(0, 10)}T${appt.hora_inicio?.slice(0, 5) ?? "00:00"}:00`);
  const minutes = Math.round((at.getTime() - now.value.getTime()) / 60000);
  if (Number.isNaN(minutes)) return "";
  if (minutes <= 0) return "Es hoy: ya es tu hora";
  if (minutes < 60) return `Faltan ${minutes} minutos`;
  if (minutes < 24 * 60) return `Faltan ${Math.floor(minutes / 60)} h ${minutes % 60} min`;
  const days = Math.round(minutes / (24 * 60));

  return days === 1 ? "Es mañana" : `Faltan ${days} días`;
});

const quickLinks = [
  { label: "Reservar", to: "/my/appointments", icon: "M8 7V3m8 4V3M5 11h14M5 5h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2zm7 8v4m-2-2h4" },
  { label: "Tienda", to: "/store", icon: "M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" },
  { label: "Recibos", to: "/my/invoices", icon: "M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" },
];

const summaryCards = computed(() => {
  const k = props.data.kpis;
  const completion = Number(k.completion_rate ?? 0);

  return [
    { label: "Visitas", value: fmtInt(k.total_appointments), hint: `${fmtInt(k.completed_appointments)} completadas` },
    { label: "Asistencia", value: `${completion.toFixed(0)}%`, hint: "Citas a las que llegaste" },
    {
      label: "Tu barbero",
      value: k.favorite_barber && k.favorite_barber !== "—" ? k.favorite_barber.split(" ")[0] : "—",
      hint: k.favorite_barber && k.favorite_barber !== "—" ? "Con quien más reservas" : "Aún sin favorito",
    },
    {
      label: "Puntos",
      value: fmtInt(props.data.loyalty.puntos),
      hint: props.data.loyalty.nextNivel ? `Rumbo a ${props.data.loyalty.nextNivelLabel}` : "Nivel máximo",
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
      label: isRegularOrAbove ? "Reserva prioritaria" : "Requiere Regular",
      icon: "M13 10V3L4 14h7v7l9-11h-7z",
    },
    {
      active: nivel === "leyenda",
      label: nivel === "leyenda" ? "Producto gratis al mes" : "Requiere Leyenda",
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
    <header class="flex items-center justify-between gap-4">
      <div>
        <p class="text-xs font-semibold uppercase tracking-[0.18em] text-muted">{{ data.todayLabel }}</p>
        <h1 class="mt-1 text-2xl font-semibold text-ink">Hola, <span class="text-gold">{{ firstName }}</span></h1>
      </div>
      <NuxtLink to="/my/appointments" class="ui-btn hidden min-h-11 shrink-0 px-5 text-sm sm:inline-flex">Reservar cita</NuxtLink>
    </header>

    <section class="grid grid-cols-1 gap-4 xl:grid-cols-12">
      <article
        class="ub-rise rounded-2xl border bg-card p-6 xl:col-span-8"
        :class="data.nextAppointment ? 'border-gold' : 'border-dashed border-line'"
        aria-label="Tu próxima cita"
      >
        <template v-if="data.nextAppointment">
          <div class="flex items-start justify-between gap-3">
            <p class="text-xs font-bold uppercase tracking-[0.18em] text-gold">Tu próxima cita</p>
            <UiBadge :tone="appointmentStatus(data.nextAppointment.estado).tone">
              {{ appointmentStatus(data.nextAppointment.estado).label }}
            </UiBadge>
          </div>
          <p class="mt-3 text-4xl font-semibold leading-none tracking-tight text-ink sm:text-5xl">
            {{ data.nextAppointment.day }} <span class="uppercase">{{ data.nextAppointment.monthShort }}</span>
            <span class="text-gold"> · {{ data.nextAppointment.hora_inicio?.slice(0, 5) }}</span>
          </p>
          <p class="mt-3 text-base text-muted">
            {{ data.nextAppointment.service?.nombre ?? "Servicio" }} con
            <span class="font-semibold text-ink">{{ data.nextAppointment.barber?.user?.name ?? "tu barbero" }}</span>
          </p>
          <p class="mt-0.5 text-sm text-muted">{{ data.nextAppointment.dateLong }}</p>
          <p v-if="countdown" class="mt-4 inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-3 py-1.5 text-sm font-semibold text-gold" role="status">
            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            {{ countdown }}
          </p>
          <div class="mt-5 flex flex-wrap gap-2">
            <NuxtLink to="/my/appointments" class="ui-btn min-h-11 px-5 text-sm">Ver o cambiar mi cita</NuxtLink>
            <NuxtLink to="/barbers" class="inline-flex min-h-11 items-center rounded-xl border border-line px-5 text-sm font-semibold text-ink transition-colors hover:border-gold/40">Nuestros barberos</NuxtLink>
          </div>
        </template>
        <div v-else class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 class="text-xl font-semibold text-ink">No tienes citas próximas</h3>
            <p class="mt-1 text-sm text-muted">Reserva tu siguiente visita y mantén tu estilo.</p>
          </div>
          <NuxtLink to="/my/appointments" class="ui-btn min-h-11 shrink-0 px-5 text-sm">Reservar cita</NuxtLink>
        </div>
      </article>

      <article class="ub-rise flex flex-col justify-between rounded-2xl border border-line bg-card p-6 xl:col-span-4" aria-label="Tu nivel">
        <div>
          <p class="text-xs font-bold uppercase tracking-[0.18em] text-muted">Tu nivel</p>
          <p class="mt-2 text-2xl font-semibold text-ink">{{ data.loyalty.nivelLabel }}</p>
          <p class="mt-1 text-sm text-muted">
            <template v-if="data.loyalty.nextNivel">
              {{ data.loyalty.citasFaltan > 0
                ? `Te faltan ${data.loyalty.citasFaltan} visita${data.loyalty.citasFaltan !== 1 ? "s" : ""} para ${data.loyalty.nextNivelLabel}`
                : `Listo para subir a ${data.loyalty.nextNivelLabel}` }}
            </template>
            <template v-else>Tienes el nivel máximo.</template>
          </p>
        </div>
        <div class="mt-5">
          <div class="flex items-center justify-between text-xs font-semibold text-muted">
            <span>{{ fmtInt(data.loyalty.puntos) }} puntos</span>
            <span class="tabular-nums text-gold">{{ Math.round(safeProgress) }}%</span>
          </div>
          <div class="mt-2 h-2 overflow-hidden rounded-full bg-ink/10" role="progressbar" :aria-valuenow="Math.round(safeProgress)" aria-valuemin="0" aria-valuemax="100" aria-label="Progreso al siguiente nivel">
            <div class="h-full rounded-full bg-gold transition-[width] duration-700" :style="{ width: `${safeProgress}%` }" />
          </div>
        </div>
      </article>
    </section>

    <nav class="grid grid-cols-3 gap-3" aria-label="Accesos rápidos">
      <NuxtLink
        v-for="l in quickLinks"
        :key="l.to"
        :to="l.to"
        class="ub-rise flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl border border-line bg-card px-2 py-4 text-center text-sm font-semibold text-ink transition-colors hover:border-gold/50"
      >
        <svg class="h-6 w-6 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" :d="l.icon" /></svg>
        {{ l.label }}
      </NuxtLink>
    </nav>

    <section class="ub-rise grid grid-cols-2 divide-line rounded-2xl border border-line bg-card sm:grid-cols-4 sm:divide-x" aria-label="Tu resumen">
      <div v-for="card in summaryCards" :key="card.label" class="p-4">
        <p class="text-xs font-bold uppercase tracking-wide text-muted">{{ card.label }}</p>
        <p class="mt-1 text-xl font-semibold tabular-nums text-ink">{{ card.value }}</p>
        <p class="text-xs text-muted">{{ card.hint }}</p>
      </div>
    </section>

    <article v-if="data.recommendation" class="ub-rise flex items-start gap-3 rounded-2xl border border-gold/30 bg-gold/10 p-4" aria-label="Recomendación para ti">
      <span class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gold/20 text-gold" aria-hidden="true">
        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
      </span>
      <div class="min-w-0">
        <p class="text-sm font-semibold text-ink">{{ data.recommendation.valorDestacado }}</p>
        <p class="mt-0.5 line-clamp-2 text-sm text-muted">{{ data.recommendation.mensaje }}</p>
      </div>
    </article>

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

        <section class="ub-rise space-y-4 rounded-2xl border border-line bg-card p-5" aria-labelledby="cliente-beneficios">
          <h3 id="cliente-beneficios" class="text-base font-semibold text-ink">Beneficios de tu nivel</h3>
          <ul class="grid grid-cols-2 gap-2">
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

          <nav class="grid grid-cols-2 gap-2" aria-label="Tus beneficios y compras">
            <NuxtLink
              v-for="l in [{ label: 'Membresía', to: '/membership' }, { label: 'Paquetes', to: '/packages' }, { label: 'Gift Cards', to: '/gift-cards' }, { label: 'Referidos', to: '/referrals' }]"
              :key="l.to"
              :to="l.to"
              class="flex min-h-11 items-center justify-between rounded-xl border border-line px-3 text-sm font-semibold text-ink transition-colors hover:border-gold/40"
            >
              {{ l.label }}
              <span class="text-gold" aria-hidden="true">→</span>
            </NuxtLink>
          </nav>

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
