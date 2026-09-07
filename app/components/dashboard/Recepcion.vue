<script setup lang="ts">
import { Bar } from 'vue-chartjs'
import { chartScale, fmtInt } from '~/utils/chartTheme'
import type { DashboardInsight } from '~/components/dashboard/AnalyticsInsights.vue'

interface ReceptionistData {
  todayLabel: string
  kpis: {
    appointments_today: number
    collected_today: number
    pending_payments: number
    pending_orders: number
    new_clients_today: number
    low_stock_count: number
  }
  nextAppointments: Array<{ id: string, hora_inicio: string, cliente: string, servicio: string, barbero: string }>
  pendingOrders: Array<{ id: string, folio: string, cliente: string, creadoEn: string | null, itemsCount: number, total: number }>
  flowChart: { labels: string[], values: number[] }
  sparkHighlights: DashboardInsight[]
}

const props = defineProps<{ data: ReceptionistData, firstName: string }>()

const kpiCards = computed(() => [
  { label: 'Citas Hoy', val: props.data.kpis.appointments_today, text: 'text-indigo-400', line: 'from-indigo-500/60' },
  { label: 'Cobrado Hoy', val: `$${Number(props.data.kpis.collected_today ?? 0).toLocaleString('es-MX', { maximumFractionDigits: 0 })}`, text: 'text-emerald-400', line: 'from-emerald-500/60' },
  { label: 'Cobros Pend.', val: props.data.kpis.pending_payments, text: 'text-amber-400', line: 'from-amber-500/60' },
  { label: 'Pedidos', val: props.data.kpis.pending_orders ?? 0, text: 'text-cyan-400', line: 'from-cyan-500/60' },
  { label: 'Nuevos Clientes', val: props.data.kpis.new_clients_today, text: 'text-indigo-400', line: 'from-indigo-500/60' },
  { label: 'Stock Crítico', val: props.data.kpis.low_stock_count, text: 'text-red-400', line: 'from-red-500/60' },
])

const hasFlow = computed(() => (props.data.flowChart.values ?? []).some((v) => v))

/*
 * Barras tipo "cápsula" (borderRadius alto + grosor fijo) en vez de la
 * línea que tenía antes -- son horas discretas del día (buckets), no una
 * serie continua, así que barras representan mejor "cuántas citas en esta
 * hora" que una línea que sugiere interpolación entre horas. Mismo tipo de
 * gráfica que el template de referencia usaba para su tarjeta de pagos por
 * día de la semana.
 */
const flowChartData = computed(() => ({
  labels: props.data.flowChart.labels ?? [],
  datasets: [{
    label: 'Citas',
    data: props.data.flowChart.values ?? [],
    backgroundColor: 'rgba(99,102,241,0.55)',
    hoverBackgroundColor: '#6366f1',
    borderRadius: 999,
    borderSkipped: false,
    barThickness: 14,
  }],
}))

const flowChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      displayColors: false,
      callbacks: { label: (ctx: { parsed: { y: number } }) => `${fmtInt(ctx.parsed.y)} cita${ctx.parsed.y === 1 ? '' : 's'}` },
    },
  },
  scales: {
    y: { ...chartScale(), beginAtZero: true, ticks: { ...chartScale().ticks, stepSize: 1, precision: 0 } },
    x: chartScale(),
  },
}
</script>

<template>
  <div class="space-y-5">
    <DashboardHeader label="Recepción" color="text-indigo-400" :today-label="data.todayLabel" />

    <section class="relative overflow-hidden rounded-2xl border border-ink/[0.06] bg-card p-5">
      <div class="absolute -bottom-8 -right-8 h-32 w-32 rounded-full bg-indigo-500/5 blur-2xl" />
      <div class="relative flex flex-col gap-4 sm:flex-row sm:items-center">
        <div>
          <p class="text-[9px] font-black uppercase tracking-[0.3em] text-ink/50">Recepción</p>
          <h3 class="mt-0.5 text-base font-black uppercase text-ink">
            Hola, <span class="text-indigo-400">{{ firstName }}</span>
          </h3>
          <p class="mt-1 text-[10px] text-ink/50">Centro de mando activo.</p>
        </div>
      </div>
    </section>

    <section class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
      <div
        v-for="kpi in kpiCards"
        :key="kpi.label"
        class="relative overflow-hidden rounded-[8px] border border-ink/[0.06] bg-card p-5"
      >
        <div class="absolute left-0 top-0 h-0.5 w-full bg-gradient-to-r to-transparent" :class="kpi.line" />
        <p class="mb-3 text-[9px] font-black uppercase tracking-[0.2em] text-ink/50">{{ kpi.label }}</p>
        <p class="text-2xl font-black" :class="kpi.text">{{ kpi.val }}</p>
      </div>
    </section>

    <DashboardAnalyticsInsights :insights="data.sparkHighlights" titulo="Prioridades del turno" />
    <DashboardAnalyticsCta
      titulo="Analítica operativa"
      descripcion="Horarios de mayor demanda, clientes por reactivar y productos por reabastecer — para planear mejor el día a día."
    />

    <section class="grid grid-cols-1 gap-5 lg:grid-cols-12">
      <div class="rounded-2xl border border-ink/[0.06] bg-card p-5 lg:col-span-7">
        <div class="mb-5 flex items-center justify-between">
          <div>
            <p class="text-[9px] font-black uppercase tracking-[0.25em] text-ink/50">Hoy</p>
            <h3 class="mt-0.5 text-sm font-black uppercase text-ink">Próximas Llegadas</h3>
          </div>
        </div>
        <div class="space-y-2">
          <div
            v-for="appt in data.nextAppointments"
            :key="appt.id"
            class="flex items-center gap-3 rounded-xl border border-ink/[0.05] p-3 transition-all hover:border-indigo-500/20 hover:bg-indigo-500/[0.03]"
          >
            <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-xs font-black text-indigo-400">
              {{ appt.hora_inicio?.slice(0, 2) }}
            </div>
            <div class="min-w-0 flex-1">
              <p class="truncate text-xs font-black uppercase text-ink">{{ appt.cliente }}</p>
              <p class="truncate text-[9px] text-ink/50">{{ appt.servicio }} · {{ appt.barbero }}</p>
            </div>
            <p class="shrink-0 text-xs font-black text-ink">{{ appt.hora_inicio?.slice(0, 5) }}</p>
          </div>
          <div v-if="!data.nextAppointments.length" class="flex items-center justify-center rounded-xl border border-dashed border-ink/[0.06] py-12">
            <p class="text-xs font-bold uppercase tracking-widest text-ink/45">Sin llegadas próximas</p>
          </div>
        </div>
      </div>

      <div class="rounded-2xl border border-ink/[0.06] bg-card p-5 lg:col-span-5">
        <div class="mb-5">
          <p class="text-[9px] font-black uppercase tracking-[0.25em] text-ink/50">Distribución horaria</p>
          <h3 class="mt-0.5 text-sm font-black uppercase text-ink">Flujo Operativo</h3>
        </div>
        <div v-if="hasFlow" class="h-52">
          <Bar :data="flowChartData" :options="flowChartOptions" />
        </div>
        <div v-else class="flex h-52 items-center justify-center rounded-xl border border-dashed border-ink/[0.06]">
          <p class="text-xs font-bold uppercase tracking-widest text-ink/45">Sin flujo registrado hoy</p>
        </div>
      </div>
    </section>

    <section class="rounded-2xl border border-ink/[0.06] bg-card p-5">
      <div class="mb-5 flex items-center justify-between">
        <div>
          <p class="text-[9px] font-black uppercase tracking-[0.25em] text-ink/50">Tienda</p>
          <h3 class="mt-0.5 text-sm font-black uppercase text-ink">Pedidos por Entregar</h3>
        </div>
      </div>
      <div
        v-for="order in data.pendingOrders"
        :key="order.id"
        class="mb-2 flex items-center gap-3 rounded-xl border border-ink/[0.05] p-3 transition-all last:mb-0 hover:border-cyan-500/20 hover:bg-cyan-500/[0.03]"
      >
        <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-400">
          <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
            <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2" />
          </svg>
        </div>
        <div class="min-w-0 flex-1">
          <p class="truncate text-xs font-black text-ink">{{ order.folio }} · {{ order.cliente }}</p>
          <p class="truncate text-[9px] font-bold text-ink/45">
            {{ order.creadoEn }} · {{ order.itemsCount }} artículo{{ order.itemsCount !== 1 ? 's' : '' }}
          </p>
        </div>
        <p class="shrink-0 text-sm font-black text-gold">${{ order.total.toFixed(2) }}</p>
      </div>
      <div v-if="!data.pendingOrders.length" class="flex items-center justify-center rounded-xl border border-dashed border-ink/[0.06] py-12">
        <p class="text-xs font-bold uppercase tracking-widest text-ink/45">Sin pedidos pendientes</p>
      </div>
    </section>
  </div>
</template>
