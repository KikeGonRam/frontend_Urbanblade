<script setup lang="ts">
import { Line } from 'vue-chartjs'
import { chartScale, inkRgba } from '~/utils/chartTheme'
import type { DashboardInsight } from '~/components/dashboard/AnalyticsInsights.vue'

interface NextAppointment {
  id: string
  fecha: string
  hora_inicio: string
  estado: string
  service: { nombre: string } | null
  barber: { user: { name: string } | null } | null
  day: string
  monthShort: string
  dateLong: string
  canManage: boolean
}

interface ClienteData {
  todayLabel: string
  kpis: {
    total_appointments: number
    completed_appointments: number
    completion_rate: number
    cancellation_rate: number
    favorite_barber: string
    membership_status: string
  }
  nextAppointment: NextAppointment | null
  visitChart: { labels: string[], values: number[] }
  loyalty: {
    nivel: string
    nivelLabel: string
    puntos: number
    discountPct: number
    nextNivel: string | null
    nextNivelLabel: string | null
    citasFaltan: number
    progressPct: number
    recentTransactions: Array<{ descripcion: string, puntos: number }>
    wonRaffle: { mes: string, premio: string, isExpired: boolean, venceEn: string } | null
  }
  member: { number: string, since: string, qr: string | null, downloadUrl: string | null }
  recommendation: { valorDestacado: string, mensaje: string } | null
  // El backend no manda este campo para cliente (a diferencia de recepción/
  // barbero) — el equivalente para este rol es `recommendation`. Opcional
  // aquí a propósito, mismo criterio que el default de Vue en la versión
  // Inertia (Cliente.vue: `sparkHighlights: { default: () => [] }`).
  sparkHighlights?: DashboardInsight[]
}

const props = defineProps<{ data: ClienteData, firstName: string, fullName: string }>()

const safeProgress = computed(() => Math.max(0, Math.min(100, Number(props.data.loyalty.progressPct) || 0)))

// 'nuevo' usa el tono de texto del tema (--ink) en vez de blanco fijo: el
// original asumía fondo siempre oscuro, pero aquí "libreta" es un tema
// claro real donde blanco al 50% es casi invisible.
const LEVEL_COLOR: Record<string, string> = { nuevo: inkRgba(0.5), regular: '#60a5fa', vip: '#d4af37', leyenda: '#e879f9' }
const levelColor = computed(() => LEVEL_COLOR[props.data.loyalty.nivel] ?? '#d4af37')

const summaryCards = computed(() => {
  const k = props.data.kpis
  const completion = Number(k.completion_rate ?? 0)
  const cancellation = Number(k.cancellation_rate ?? 0)

  return [
    { label: 'Visitas', value: k.total_appointments, caption: `${k.completed_appointments} completadas`, accent: '#d4af37', progress: completion },
    { label: 'Cumplimiento', value: `${completion.toFixed(1)}%`, caption: 'Historial confiable', accent: '#34d399', progress: completion },
    { label: 'Cancelación', value: `${cancellation.toFixed(1)}%`, caption: cancellation <= 20 ? 'Dentro de rango' : 'Revisar hábitos', accent: cancellation <= 20 ? '#f59e0b' : '#f87171', progress: cancellation },
    { label: 'Puntos', value: Number(props.data.loyalty.puntos).toLocaleString(), caption: props.data.loyalty.nextNivel ? `Meta: ${props.data.loyalty.nextNivelLabel}` : 'Nivel máximo', accent: LEVEL_COLOR[props.data.loyalty.nivel] ?? '#d4af37', progress: safeProgress.value },
  ]
})

const benefits = computed(() => {
  const nivel = props.data.loyalty.nivel
  const isVipOrAbove = ['vip', 'leyenda'].includes(nivel)
  const isRegularOrAbove = ['regular', 'vip', 'leyenda'].includes(nivel)
  const discountPct = props.data.loyalty.discountPct

  return [
    { active: discountPct > 0, label: discountPct > 0 ? `${discountPct}% descuento` : 'Sin descuento', icon: 'M7 7h.01M17 17h.01M19 5l-14 14M9.5 7a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0zm10 10a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z' },
    { active: isVipOrAbove, label: isVipOrAbove ? 'Sorteo mensual' : 'Requiere VIP', icon: 'M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4 2 2 0 010 4zm14 0a2 2 0 110-4 2 2 0 010 4z' },
    { active: isRegularOrAbove, label: isRegularOrAbove ? 'Reserva prio.' : 'Requiere Regular', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
    { active: nivel === 'leyenda', label: nivel === 'leyenda' ? 'Prod. gratis/mes' : 'Requiere Leyenda', icon: 'M20 12v10H4V12M22 7H2v5h20V7zM12 22V7m0 0a2 2 0 10-4 0m4 0a2 2 0 114 0' },
  ]
})

const visitValues = computed(() => (props.data.visitChart.values ?? []).map(Number))
const visitLabels = computed(() => props.data.visitChart.labels ?? [])
const hasVisits = computed(() => visitValues.value.some((v) => v))
const visitTotal6 = computed(() => visitValues.value.reduce((a, b) => a + b, 0))
const visitPeak = computed(() => {
  const peak = Math.max(0, ...visitValues.value)
  if (peak === 0) return '—'

  return visitLabels.value[visitValues.value.indexOf(peak)] ?? '—'
})

function goldGradient(context: { chart: { ctx: CanvasRenderingContext2D, chartArea?: { top: number, bottom: number } } }) {
  const { ctx, chartArea } = context.chart
  if (!chartArea) return 'rgba(212,175,55,0.1)'

  const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom)
  gradient.addColorStop(0, 'rgba(212,175,55,0.28)')
  gradient.addColorStop(1, 'rgba(212,175,55,0.01)')

  return gradient
}

const visitChartData = computed(() => ({
  labels: visitLabels.value,
  datasets: [{
    label: 'Visitas',
    data: visitValues.value,
    borderColor: '#d4af37',
    backgroundColor: goldGradient,
    borderWidth: 3,
    fill: true,
    tension: 0.42,
    pointRadius: 4,
    pointHoverRadius: 7,
    pointBackgroundColor: '#0d0d0d',
    pointBorderColor: '#d4af37',
    pointBorderWidth: 2,
  }],
}))

const visitChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: { intersect: false, mode: 'index' as const },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: 'rgba(13,13,13,0.96)',
      borderColor: 'rgba(212,175,55,0.28)',
      borderWidth: 1,
      padding: 12,
      callbacks: { label: (ctx: { parsed: { y: number } }) => `${ctx.parsed.y} visita${ctx.parsed.y === 1 ? '' : 's'}` },
    },
  },
  scales: {
    y: { ...chartScale(), beginAtZero: true, ticks: { ...chartScale().ticks, stepSize: 1 } },
    x: chartScale(),
  },
}
</script>

<template>
  <div class="space-y-5">
    <DashboardHeader label="Personal" color="text-gold" :today-label="data.todayLabel" />

    <section class="relative overflow-hidden rounded-[28px] border border-ink/[0.08] bg-card p-5 sm:p-6">
      <div class="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-gold/10 blur-3xl" />
      <div class="pointer-events-none absolute bottom-0 -left-24 h-56 w-56 rounded-full bg-sky-500/10 blur-3xl" />
      <div class="relative grid gap-6 xl:grid-cols-[1fr_360px] xl:items-center">
        <div class="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div class="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-gold to-amber-600 text-black shadow-[0_18px_50px_rgba(212,175,55,0.18)]">
            <svg class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div class="min-w-0">
            <p class="text-[9px] font-black uppercase tracking-[0.32em] text-gold/70">Tu panel personal</p>
            <h3 class="mt-1 text-2xl font-black uppercase leading-tight text-ink sm:text-3xl">
              Hola, <span class="text-gold">{{ firstName }}</span>
            </h3>
            <p class="mt-2 max-w-2xl text-sm text-ink/50">
              Reserva, revisa tu próxima visita, consulta tus puntos y encuentra productos
              recomendados sin perderte entre pantallas.
            </p>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2 opacity-50 sm:flex sm:flex-wrap xl:justify-end">
          <span class="cursor-not-allowed rounded-xl border border-ink/10 bg-ink/[0.04] px-4 py-3 text-center text-[10px] font-black uppercase tracking-widest text-ink/40" title="Próximamente">Reservar</span>
          <span class="cursor-not-allowed rounded-xl border border-ink/10 bg-ink/[0.04] px-4 py-3 text-center text-[10px] font-black uppercase tracking-widest text-ink/40" title="Próximamente">Mis citas</span>
          <span class="cursor-not-allowed rounded-xl border border-ink/10 bg-ink/[0.04] px-4 py-3 text-center text-[10px] font-black uppercase tracking-widest text-ink/40" title="Próximamente">Barberos</span>
          <span class="cursor-not-allowed rounded-xl border border-ink/10 bg-ink/[0.04] px-4 py-3 text-center text-[10px] font-black uppercase tracking-widest text-ink/40" title="Próximamente">Tienda</span>
        </div>
      </div>
    </section>

    <section class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <article v-for="card in summaryCards" :key="card.label" class="relative overflow-hidden rounded-2xl border border-ink/[0.08] bg-card p-5">
        <div class="absolute inset-x-0 top-0 h-0.5 opacity-80" :style="{ background: `linear-gradient(90deg, ${card.accent}, transparent)` }" />
        <div class="mb-4 flex items-start justify-between gap-3">
          <div>
            <p class="text-[9px] font-black uppercase tracking-[0.25em] text-ink/40">{{ card.label }}</p>
            <p class="mt-2 truncate text-3xl font-black leading-none text-ink">{{ card.value }}</p>
          </div>
          <span class="h-2.5 w-2.5 rounded-full shadow-[0_0_18px_currentColor]" :style="{ color: card.accent, background: card.accent }" />
        </div>
        <div class="h-1.5 overflow-hidden rounded-full bg-ink/[0.06]">
          <div class="h-full rounded-full transition-all duration-700" :style="{ width: `${Math.max(2, Math.min(100, card.progress))}%`, background: card.accent }" />
        </div>
        <p class="mt-3 text-[11px] font-bold text-ink/45">{{ card.caption }}</p>
      </article>
    </section>

    <section class="grid grid-cols-1 gap-5 xl:grid-cols-12">
      <article
        class="relative overflow-hidden rounded-2xl border bg-card xl:col-span-7"
        :class="data.nextAppointment ? 'border-gold/25' : 'border-dashed border-gold/20'"
      >
        <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(212,175,55,0.13),transparent_36%)]" />
        <div v-if="data.nextAppointment" class="relative grid gap-0 md:grid-cols-[180px_1fr]">
          <div class="flex flex-row items-center gap-4 border-b border-ink/[0.06] bg-gradient-to-br from-gold to-amber-600 p-5 text-black md:flex-col md:justify-center md:border-b-0 md:border-r md:border-black/10">
            <div class="text-center">
              <p class="text-[8px] font-black uppercase tracking-[0.22em] opacity-60">Próxima cita</p>
              <p class="mt-1 text-4xl font-black leading-none">{{ data.nextAppointment.day }}</p>
              <p class="text-xs font-black uppercase opacity-70">{{ data.nextAppointment.monthShort }}</p>
            </div>
            <div class="h-10 w-px bg-black/15 md:h-px md:w-20" />
            <p class="text-2xl font-black">{{ data.nextAppointment.hora_inicio?.slice(0, 5) }}</p>
          </div>
          <div class="p-6">
            <div class="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div class="min-w-0">
                <p class="text-[9px] font-black uppercase tracking-[0.25em] text-gold/70">Agenda confirmable</p>
                <h3 class="mt-2 text-2xl font-black uppercase leading-tight text-ink">{{ data.nextAppointment.service?.nombre ?? 'Servicio' }}</h3>
                <p class="mt-1 text-sm font-bold text-ink/45">
                  Con <span class="text-gold">{{ data.nextAppointment.barber?.user?.name ?? 'Maestro UrbanBlade' }}</span>
                </p>
                <div class="mt-4 flex flex-wrap gap-2">
                  <span class="rounded-full border border-ink/10 bg-ink/[0.04] px-3 py-1 text-[9px] font-black uppercase tracking-widest text-ink/55">{{ data.nextAppointment.dateLong }}</span>
                  <span class="rounded-full border border-emerald-500/20 bg-emerald-500/[0.05] px-3 py-1 text-[9px] font-black uppercase tracking-widest text-emerald-300">{{ data.nextAppointment.estado ?? 'pendiente' }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="relative flex flex-col gap-4 p-7 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p class="text-[9px] font-black uppercase tracking-[0.28em] text-gold/70">Agenda libre</p>
            <h3 class="mt-1 text-xl font-black uppercase text-ink">Sin citas próximas</h3>
            <p class="mt-1 text-sm text-ink/45">Reserva tu siguiente visita y mantén tu estilo impecable.</p>
          </div>
        </div>
      </article>

      <a
        v-if="data.recommendation"
        href="#"
        class="group pointer-events-none relative overflow-hidden rounded-2xl border border-sky-500/20 bg-sky-500/[0.04] p-6 xl:col-span-5"
      >
        <div class="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-sky-400/10 blur-3xl" />
        <div class="relative flex items-start gap-4">
          <div class="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-sky-400/20 bg-sky-500/10 text-sky-300">
            <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-[9px] font-black uppercase tracking-widest text-sky-300/80">Sugerencia inteligente</p>
            <p class="mt-1 text-xl font-black leading-tight text-ink">{{ data.recommendation.valorDestacado }}</p>
            <p class="mt-2 line-clamp-3 text-xs leading-relaxed text-ink/50">{{ data.recommendation.mensaje }}</p>
          </div>
        </div>
      </a>
      <article v-else class="rounded-2xl border border-ink/[0.08] bg-card p-6 xl:col-span-5">
        <p class="text-[9px] font-black uppercase tracking-widest text-ink/40">Recomendaciones</p>
        <p class="mt-2 text-lg font-black text-ink">Aún no hay patrón suficiente</p>
        <p class="mt-2 text-xs leading-relaxed text-ink/45">
          Cuando tengas más visitas, el sistema podrá sugerirte servicios y productos acordes a tu historial.
        </p>
      </article>
    </section>

    <DashboardAnalyticsInsights :insights="data.sparkHighlights ?? []" titulo="Tus oportunidades" />

    <section class="grid grid-cols-1 gap-5 lg:grid-cols-12">
      <div class="rounded-2xl border border-ink/[0.08] bg-card p-5 lg:col-span-7">
        <div class="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p class="text-[9px] font-black uppercase tracking-[0.25em] text-ink/50">Últimos 6 meses</p>
            <h3 class="mt-0.5 text-lg font-black uppercase text-ink">Ritmo de visitas</h3>
            <p class="mt-1 text-xs text-ink/45">Visualiza cuándo vienes más y qué tan constante es tu historial.</p>
          </div>
          <div class="grid grid-cols-2 gap-2 text-right sm:min-w-56">
            <div class="rounded-xl border border-ink/[0.06] bg-ink/[0.03] px-3 py-2">
              <p class="text-[8px] font-black uppercase tracking-widest text-ink/35">Periodo</p>
              <p class="mt-0.5 text-sm font-black text-gold">{{ visitTotal6 }} visitas</p>
            </div>
            <div class="rounded-xl border border-ink/[0.06] bg-ink/[0.03] px-3 py-2">
              <p class="text-[8px] font-black uppercase tracking-widest text-ink/35">Mejor mes</p>
              <p class="mt-0.5 text-sm font-black text-ink">{{ visitPeak }}</p>
            </div>
          </div>
        </div>
        <div v-if="hasVisits" class="h-64">
          <Line :data="visitChartData" :options="visitChartOptions" />
        </div>
        <div v-else class="flex h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-ink/[0.08] bg-ink/[0.02] text-center">
          <p class="text-xs font-black uppercase tracking-widest text-ink/45">Sin historial aún</p>
          <p class="mt-2 max-w-xs text-xs text-ink/35">Después de tus primeras visitas, aquí aparecerá tu tendencia mensual.</p>
        </div>
      </div>

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

        <div class="space-y-4 rounded-2xl border border-ink/[0.08] bg-card p-5">
          <div class="grid grid-cols-[86px_1fr] items-center gap-4 rounded-2xl border border-ink/[0.06] bg-ink/[0.025] p-4">
            <div class="grid h-20 w-20 place-items-center rounded-full" :style="{ background: `conic-gradient(${levelColor} ${Math.round(safeProgress)}%, ${inkRgba(0.08)} 0)` }">
              <div class="grid h-14 w-14 place-items-center rounded-full bg-card">
                <span class="text-sm font-black text-ink">{{ Math.round(safeProgress) }}%</span>
              </div>
            </div>
            <div>
              <p class="text-[8px] font-black uppercase tracking-[0.22em] text-ink/40">Lealtad</p>
              <p class="mt-1 text-lg font-black uppercase text-ink">{{ data.loyalty.nivelLabel }}</p>
              <p v-if="data.loyalty.nextNivel" class="mt-1 text-xs font-bold text-ink/45">
                Próximo nivel: <span class="text-gold">{{ data.loyalty.nextNivelLabel }}</span> ·
                {{ data.loyalty.citasFaltan > 0 ? `faltan ${data.loyalty.citasFaltan} visita${data.loyalty.citasFaltan !== 1 ? 's' : ''}` : 'listo para subir' }}
              </p>
              <p v-else class="mt-1 text-xs font-bold text-fuchsia-300/70">Nivel máximo alcanzado. Sigue acumulando beneficios.</p>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <div
              v-for="ben in benefits"
              :key="ben.label"
              class="flex items-center gap-2 rounded-xl border border-ink/[0.06] bg-ink/[0.02] p-2.5 transition-all hover:bg-ink/[0.04]"
              :class="ben.active ? 'text-gold' : 'text-ink/25'"
            >
              <svg class="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" :d="ben.icon" />
              </svg>
              <span class="text-[9px] font-bold leading-tight">{{ ben.label }}</span>
            </div>
          </div>

          <div v-if="data.loyalty.recentTransactions.length">
            <p class="mb-2 text-[8px] font-black uppercase tracking-[0.22em] text-ink/45">Últimos movimientos</p>
            <div class="space-y-1.5">
              <div v-for="(tx, index) in data.loyalty.recentTransactions.slice(0, 4)" :key="index" class="flex items-center justify-between gap-2">
                <div class="flex items-center gap-1.5">
                  <svg class="h-2.5 w-2.5 shrink-0" fill="none" :stroke="tx.puntos > 0 ? '#4ade80' : '#f87171'" stroke-width="2.5" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" :d="tx.puntos > 0 ? 'M12 19V5m0 0l-7 7m7-7l7 7' : 'M12 5v14m0 0l7-7m-7 7l-7-7'" />
                  </svg>
                  <span class="text-[9px] text-ink/50">{{ tx.descripcion }}</span>
                </div>
                <span class="shrink-0 text-[9px] font-black" :style="{ color: tx.puntos > 0 ? '#4ade80' : '#f87171' }">{{ tx.puntos > 0 ? '+' : '' }}{{ tx.puntos }} pts</span>
              </div>
            </div>
          </div>

          <div v-if="data.loyalty.wonRaffle" class="flex items-center gap-2 rounded-lg p-2.5" style="background: rgba(232, 121, 249, 0.05); border: 1px solid rgba(232, 121, 249, 0.15);">
            <svg class="h-3.5 w-3.5 shrink-0" style="fill: rgba(232, 121, 249, 0.8)" viewBox="0 0 24 24">
              <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
            <div>
              <p class="text-[9px] font-black" style="color: rgba(232, 121, 249, 0.8)">Ganaste el sorteo de {{ data.loyalty.wonRaffle.mes }}</p>
              <p class="text-[8px] text-ink/50">{{ data.loyalty.wonRaffle.premio }}</p>
              <p v-if="data.loyalty.wonRaffle.isExpired" class="mt-0.5 text-[8px] text-red-400/70">Caducó el {{ data.loyalty.wonRaffle.venceEn }} sin reclamarse</p>
              <p v-else class="mt-0.5 text-[8px] text-emerald-400/70">Válido hasta {{ data.loyalty.wonRaffle.venceEn }} — coméntalo en tu próxima cita</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
