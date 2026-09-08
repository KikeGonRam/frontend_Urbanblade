<script setup lang="ts">
import { Bar, Doughnut } from 'vue-chartjs'
import { chartScale, UB_CATEGORICAL, fmtInt, inkRgba } from '~/utils/chartTheme'
import type { DashboardInsight } from '~/components/dashboard/AnalyticsInsights.vue'

interface BarberAppointment {
  id: string
  code: string
  estado: string
  hora_inicio: string
  hora_fin: string
  cliente: string
  servicio: string
  isNext: boolean
}

interface BarberPending {
  id: string
  code: string
  fecha: string
  hora_inicio: string
  cliente: string
  servicio: string
}

interface BarberoData {
  todayLabel: string
  kpis: { appointments_today: number, appointments_month: number, income_month: number, tips_month: number, rating: number }
  performanceChart: { labels: string[], values: number[] }
  servicesChart: { labels: string[], values: number[] }
  barberToday: BarberAppointment[]
  barberPending: BarberPending[]
  sparkHighlights: DashboardInsight[]
}

const props = defineProps<{ data: BarberoData, firstName: string }>()
const emit = defineEmits<{ refresh: [] }>()

const { apiFetch } = useApi()
const { confirm } = useConfirm()

const kpiCards = computed(() => [
  { label: 'Citas Hoy', val: props.data.kpis.appointments_today, text: 'text-gold' },
  { label: 'Por Aprobar', val: props.data.barberPending.length, text: 'text-amber-300' },
  { label: 'Ingresos Mes', val: `$${Number(props.data.kpis.income_month ?? 0).toLocaleString('es-MX', { maximumFractionDigits: 0 })}`, text: 'text-emerald-400' },
  { label: 'Propinas Mes', val: `$${Number(props.data.kpis.tips_month ?? 0).toLocaleString('es-MX', { maximumFractionDigits: 0 })}`, text: 'text-gold' },
  { label: 'Rating', val: props.data.kpis.rating, text: 'text-ink' },
])

const STATUS_STYLE: Record<string, [string, string]> = {
  completada: ['border-emerald-500/25 bg-emerald-500/10 text-emerald-300', 'Completada'],
  pendiente: ['border-amber-500/25 bg-amber-500/10 text-amber-300', 'Pendiente'],
  en_proceso: ['border-blue-500/25 bg-blue-500/10 text-blue-300', 'En proceso'],
  confirmada: ['border-gold/25 bg-gold/10 text-gold', 'Confirmada'],
  cancelada: ['border-red-500/25 bg-red-500/10 text-red-400', 'Cancelada'],
  no_asistio: ['border-ink/10 bg-ink/5 text-ink/40', 'No asistió'],
}

function statusStyle(estado: string) {
  return STATUS_STYLE[estado] ?? ['border-ink/10 bg-ink/5 text-ink/40', '—']
}

const actingOn = ref<string | null>(null)
const actionError = ref('')

async function setStatus(appt: BarberPending, estado: 'confirmada' | 'cancelada') {
  if (estado === 'cancelada') {
    const accepted = await confirm({
      title: 'Rechazar solicitud',
      message: '¿Rechazar esta solicitud de cita?',
      confirmText: 'Sí, rechazar',
      isDanger: true,
    })
    if (!accepted) return
  }

  actingOn.value = appt.id
  actionError.value = ''
  try {
    // Appointment usa HasPublicCode -> getRouteKeyName() = 'code', no 'id'
    // (ver .claude/skills/urbanblade-guardrails/SKILL.md en barber).
    await apiFetch(`/appointments/${appt.code}/status`, { method: 'PATCH', body: { estado } })
    emit('refresh')
  } catch (err: unknown) {
    actionError.value = (err as { data?: { message?: string } })?.data?.message ?? 'No se pudo actualizar la cita.'
  } finally {
    actingOn.value = null
  }
}

const hasPerformance = computed(() => (props.data.performanceChart.values ?? []).some((v) => v))
const performanceData = computed(() => ({
  labels: props.data.performanceChart.labels ?? [],
  datasets: [{
    label: 'Citas',
    data: props.data.performanceChart.values ?? [],
    backgroundColor: 'rgba(212,175,55,0.75)',
    hoverBackgroundColor: '#d4af37',
    borderRadius: 6,
    barThickness: 18,
  }],
}))
const performanceOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: { displayColors: false, callbacks: { label: (ctx: { parsed: { y: number } }) => `Citas: ${fmtInt(ctx.parsed.y)}` } },
  },
  scales: {
    y: { ...chartScale(), beginAtZero: true, ticks: { ...chartScale().ticks, precision: 0 } },
    x: chartScale(),
  },
}

const hasServices = computed(() => (props.data.servicesChart.values ?? []).some((v) => v))
const servicesData = computed(() => ({
  labels: props.data.servicesChart.labels ?? [],
  datasets: [{
    data: props.data.servicesChart.values ?? [],
    backgroundColor: UB_CATEGORICAL,
    borderColor: '#111111',
    borderWidth: 3,
    hoverOffset: 8,
  }],
}))
const servicesOptions = {
  responsive: true,
  maintainAspectRatio: false,
  cutout: '72%',
  plugins: {
    legend: {
      position: 'bottom' as const,
      labels: { color: inkRgba(0.45), usePointStyle: true, pointStyle: 'circle', padding: 14, font: { size: 10, weight: 'bold' as const } },
    },
    tooltip: { displayColors: true, callbacks: { label: (ctx: { label: string, parsed: number }) => `${ctx.label}: ${fmtInt(ctx.parsed)}` } },
  },
}
</script>

<template>
  <p v-if="actionError" role="alert" class="mb-4 text-sm text-red-400">{{ actionError }}</p>
  <div class="space-y-5">
    <DashboardHeader label="Profesional" color="text-amber-400" :today-label="data.todayLabel" />

    <section class="relative overflow-hidden rounded-2xl border border-ink/[0.06] bg-card p-6">
      <div class="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-gold/5 blur-3xl" />
      <div class="relative flex flex-col items-center gap-6 sm:flex-row">
        <div class="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-gold to-amber-600 text-black">
          <svg class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <p class="text-[9px] font-black uppercase tracking-[0.3em] text-ink/50">Bienvenido de vuelta</p>
          <h3 class="mt-0.5 text-xl font-black uppercase text-ink">
            Maestro <span class="text-gold">{{ firstName }}</span>
          </h3>
          <p class="mt-1 text-xs text-ink/40">
            Tienes <strong class="text-ink">{{ data.kpis.appointments_today }}</strong> servicio{{ data.kpis.appointments_today !== 1 ? 's' : '' }} hoy
            <template v-if="data.barberPending.length">
              · <strong class="text-amber-300">{{ data.barberPending.length }}</strong> por aprobar
            </template>.
          </p>
        </div>
      </div>
    </section>

    <section class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      <div v-for="kpi in kpiCards" :key="kpi.label" class="rounded-[8px] border border-ink/[0.06] bg-card p-5 text-center">
        <p class="mb-3 text-[9px] font-black uppercase tracking-[0.22em] text-ink/50">{{ kpi.label }}</p>
        <p class="text-2xl font-black" :class="kpi.text">{{ kpi.val }}</p>
      </div>
    </section>

    <DashboardAnalyticsInsights :insights="data.sparkHighlights" titulo="Tus oportunidades" />
    <DashboardAnalyticsCta
      titulo="Tu analítica personal"
      descripcion="Descubre a qué horas tienes más demanda y cómo le está yendo a tus publicaciones — solo tus datos, en lenguaje simple."
    />

    <section v-if="data.barberPending.length" class="rounded-2xl border border-amber-500/25 bg-amber-500/[0.04] p-5">
      <div class="mb-4 flex items-center gap-2">
        <svg class="h-4 w-4 text-amber-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h3 class="text-[11px] font-black uppercase tracking-widest text-amber-300">Esperando tu aprobación</h3>
        <span class="ml-auto text-[9px] font-black text-amber-300/70">
          {{ data.barberPending.length }} solicitud{{ data.barberPending.length !== 1 ? 'es' : '' }}
        </span>
      </div>
      <div class="space-y-2">
        <div v-for="appt in data.barberPending" :key="appt.id" class="flex flex-wrap items-center gap-3 rounded-xl border border-amber-500/10 bg-ink/[0.04] p-3">
          <div class="w-14 shrink-0 text-center">
            <p class="text-[11px] font-black text-ink">{{ appt.hora_inicio?.slice(0, 5) ?? '--:--' }}</p>
            <p class="text-[8px] font-bold text-ink/45">{{ appt.fecha }}</p>
          </div>
          <div class="min-w-0 flex-1">
            <p class="truncate text-xs font-black text-ink">{{ appt.cliente }}</p>
            <p class="truncate text-[9px] font-bold text-ink/40">{{ appt.servicio }}</p>
          </div>
          <div class="flex shrink-0 items-center gap-2">
            <button
              type="button"
              :disabled="actingOn === appt.id"
              class="rounded-lg bg-gold px-4 py-2 text-[9px] font-black uppercase tracking-widest text-black transition hover:bg-gold-dim focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-2 disabled:opacity-50"
              @click="setStatus(appt, 'confirmada')"
            >
              Aprobar
            </button>
            <button
              type="button"
              :disabled="actingOn === appt.id"
              class="px-2 text-[9px] font-black uppercase tracking-widest text-ink/40 transition hover:text-red-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-2 disabled:opacity-50"
              @click="setStatus(appt, 'cancelada')"
            >
              Rechazar
            </button>
          </div>
        </div>
      </div>
    </section>

    <section class="rounded-2xl border border-ink/[0.06] bg-card p-5">
      <div class="mb-5 flex items-center justify-between">
        <div>
          <p class="text-[9px] font-black uppercase tracking-[0.25em] text-ink/50">Agenda</p>
          <h3 class="mt-0.5 text-sm font-black uppercase text-ink">Citas de Hoy</h3>
        </div>
      </div>
      <div v-if="!data.barberToday.length" class="flex flex-col items-center justify-center rounded-xl border border-dashed border-ink/[0.06] py-12">
        <svg class="mb-2 h-8 w-8 text-ink/10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <p class="text-xs font-bold uppercase tracking-widest text-ink/45">Sin citas hoy</p>
      </div>
      <div v-else class="space-y-2">
        <div
          v-for="appt in data.barberToday"
          :key="appt.id"
          class="flex items-center gap-3 rounded-xl border p-3 transition-all"
          :class="appt.isNext ? 'border-gold/30 bg-gold/[0.04]' : 'border-ink/[0.05] hover:border-ink/10'"
        >
          <div class="w-12 shrink-0 text-center">
            <p class="text-[11px] font-black" :class="appt.isNext ? 'text-gold' : 'text-ink'">{{ appt.hora_inicio?.slice(0, 5) ?? '--:--' }}</p>
            <p class="text-[8px] font-bold text-ink/45">{{ appt.hora_fin?.slice(0, 5) }}</p>
          </div>
          <div class="h-7 w-px shrink-0 bg-ink/[0.06]" />
          <div class="min-w-0 flex-1">
            <p class="truncate text-xs font-black text-ink">
              {{ appt.cliente }}
              <span v-if="appt.isNext" class="ml-1 text-[8px] font-black uppercase tracking-wider text-gold">· Siguiente</span>
            </p>
            <p class="truncate text-[9px] font-bold text-ink/35">{{ appt.servicio }}</p>
          </div>
          <span class="shrink-0 rounded-full border px-2 py-0.5 text-[8px] font-black uppercase tracking-wider" :class="statusStyle(appt.estado)[0]">
            {{ statusStyle(appt.estado)[1] }}
          </span>
        </div>
      </div>
    </section>

    <section class="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <div class="rounded-2xl border border-ink/[0.06] bg-card p-5">
        <div class="mb-5">
          <p class="text-[9px] font-black uppercase tracking-[0.25em] text-ink/50">Últimos 7 días</p>
          <h3 class="mt-0.5 text-sm font-black uppercase text-ink">Productividad Semanal</h3>
        </div>
        <div v-if="hasPerformance" class="h-52">
          <Bar :data="performanceData" :options="performanceOptions" />
        </div>
        <div v-else class="flex h-52 items-center justify-center rounded-xl border border-dashed border-ink/[0.06]">
          <p class="text-xs font-bold uppercase tracking-widest text-ink/45">Sin datos suficientes</p>
        </div>
      </div>
      <div class="rounded-2xl border border-ink/[0.06] bg-card p-5">
        <div class="mb-5">
          <p class="text-[9px] font-black uppercase tracking-[0.25em] text-ink/50">Último año</p>
          <h3 class="mt-0.5 text-sm font-black uppercase text-ink">Top Especialidades</h3>
        </div>
        <div v-if="hasServices" class="h-52">
          <Doughnut :data="servicesData" :options="servicesOptions" />
        </div>
        <div v-else class="flex h-52 items-center justify-center rounded-xl border border-dashed border-ink/[0.06]">
          <p class="text-xs font-bold uppercase tracking-widest text-ink/45">Sin especialidades aún</p>
        </div>
      </div>
    </section>
  </div>
</template>
