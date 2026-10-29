<script setup lang="ts">
/*
 * Tablero del negocio del administrador (auditoría UI/UX A-45): el Centro de Análisis deja de ser seis contadores.
 * Responde preguntas (¿cómo vamos?, ¿quién genera el dinero?, ¿dónde perdemos citas?, ¿cuándo estamos llenos?,
 * ¿los clientes regresan?) con los mismos reportes agregados de /admin/reports y una lectura automática arriba.
 * El detalle exportable sigue en Reportes.
 */
import type { BarListItem } from '~/components/ui/BarList.vue'
import type { DonutItem } from '~/components/ui/DonutCard.vue'
import { etiquetaComparacion, lecturaComparativa, lecturaDelNegocio, variacionDe, type Cohorte, type Comparacion } from '~/utils/analitica'
import { fmtInt } from '~/utils/chartTheme'
import { formatMoney } from '~/utils/format'

type Period = 'dia' | 'semana' | 'mes' | 'trimestre' | 'año'
const PERIODOS: { id: Period, label: string }[] = [
  { id: 'dia', label: 'Hoy' },
  { id: 'semana', label: 'Semana' },
  { id: 'mes', label: 'Mes' },
  { id: 'trimestre', label: 'Trimestre' },
  { id: 'año', label: 'Año' },
]

interface RevenueData {
  totalRevenue: number
  totalAppointments: number
  averageRevenue: number
  revenueByBarber: Record<string, { barber: string, total: number, count: number, average: number }>
}
interface AppointmentsData {
  totalAppointments: number
  appointmentsByStatus: Record<string, number>
  completionRate: number
}
interface ClientsData {
  totalClients: number
  newClients: number
  activeClients: number
  inactiveClients: number
  clientRetention: number
}

const { apiFetch } = useApi()
const period = ref<Period>('mes')

const { data: revenueRes, pending: revenuePending } = await useAsyncData(
  'analitica-revenue',
  () => apiFetch<{ data: RevenueData }>('/admin/reports/revenue', { query: { period: period.value } }),
  { watch: [period], lazy: true },
)
const { data: apptRes, pending: apptPending } = await useAsyncData(
  'analitica-appointments',
  () => apiFetch<{ data: AppointmentsData }>('/admin/reports/appointments', { query: { period: period.value } }),
  { watch: [period], lazy: true },
)
const { data: clientsRes, pending: clientsPending } = await useAsyncData(
  'analitica-clients',
  () => apiFetch<{ data: ClientsData }>('/admin/reports/clients', { query: { period: period.value } }),
  { watch: [period], lazy: true },
)

// Comparación y cohortes son un añadido: si el servidor aún no las ofrece, el tablero sigue sin ellas.
const { data: comparisonRes } = await useAsyncData(
  'analitica-comparison',
  () => apiFetch<{ data: Comparacion }>('/admin/reports/comparison', { query: { period: period.value } }).catch(() => null),
  { watch: [period], lazy: true },
)
const { data: cohortsRes } = await useAsyncData(
  'analitica-cohorts',
  () => apiFetch<{ data: { meses: number, cohortes: Cohorte[] } }>('/admin/reports/cohorts', { query: { months: 6 } }).catch(() => null),
  { lazy: true },
)
const comparison = computed(() => comparisonRes.value?.data ?? null)
const cohortes = computed(() => cohortsRes.value?.data?.cohortes ?? null)
const contra = computed(() => etiquetaComparacion(period.value))

const revenue = computed(() => revenueRes.value?.data)
const appts = computed(() => apptRes.value?.data)
const clients = computed(() => clientsRes.value?.data)
const cargando = computed(() => revenuePending.value || apptPending.value || clientsPending.value)

const ESTADOS: Record<string, { label: string, color: string }> = {
  completada: { label: 'Completada', color: 'var(--chart-2-rgb)' },
  confirmada: { label: 'Confirmada', color: 'var(--chart-1-rgb)' },
  pendiente: { label: 'Pendiente', color: 'var(--chart-4-rgb)' },
  en_proceso: { label: 'En proceso', color: 'var(--chart-3-rgb)' },
  cancelada: { label: 'Cancelada', color: 'var(--danger-rgb)' },
  no_asistio: { label: 'No asistió', color: 'var(--warning-rgb)' },
}

const estadoItems = computed<DonutItem[]>(() =>
  Object.entries(appts.value?.appointmentsByStatus ?? {}).map(([estado, value]) => ({
    label: ESTADOS[estado]?.label ?? estado,
    value,
    color: `rgb(${ESTADOS[estado]?.color ?? 'var(--chart-5-rgb)'})`,
  })),
)

const barberos = computed(() => Object.values(revenue.value?.revenueByBarber ?? {}))
const barberoItems = computed<BarListItem[]>(() =>
  [...barberos.value].sort((a, b) => b.total - a.total).map(b => ({
    label: b.barber,
    value: b.total,
    display: formatMoney(b.total, 0),
    detail: `${fmtInt(b.count)} cita${b.count === 1 ? '' : 's'} · ticket ${formatMoney(b.average, 0)}`,
  })),
)

const clienteItems = computed<DonutItem[]>(() => [
  { label: 'Activos', value: clients.value?.activeClients ?? 0, color: 'rgb(var(--chart-2-rgb))' },
  { label: 'Inactivos', value: clients.value?.inactiveClients ?? 0, color: 'rgb(var(--chart-5-rgb))' },
])

const lectura = computed(() => [
  ...lecturaComparativa(comparison.value),
  ...lecturaDelNegocio({
    totalIngresos: revenue.value?.totalRevenue ?? 0,
    citas: appts.value?.totalAppointments ?? 0,
    porEstado: appts.value?.appointmentsByStatus ?? {},
    ingresosPorBarbero: barberos.value.map(b => ({ nombre: b.barber, total: b.total })),
    retencion: clients.value?.clientRetention ?? 0,
    clientesInactivos: clients.value?.inactiveClients ?? 0,
  }),
])

const TONO = {
  bien: 'border-success/30 bg-success/10 text-success',
  atencion: 'border-warning/30 bg-warning/10 text-warning',
  info: 'border-line bg-ink/5 text-muted',
} as const
const ICONO = { bien: '✓', atencion: '!', info: 'i' } as const
</script>

<template>
  <section class="mb-8" aria-labelledby="tablero-negocio">
    <header class="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 id="tablero-negocio" class="text-lg font-black text-ink">Tablero del negocio</h2>
        <p class="mt-0.5 text-sm text-muted">Cómo vamos, quién genera el dinero y dónde se pierden citas. El detalle exportable está en Reportes.</p>
      </div>
      <div class="flex flex-wrap gap-1" role="group" aria-label="Periodo del tablero">
        <button
          v-for="p in PERIODOS"
          :key="p.id"
          type="button"
          class="min-h-10 rounded-lg border px-3 text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold"
          :class="period === p.id ? 'border-gold bg-gold/15 text-gold' : 'border-line text-muted hover:text-ink'"
          :aria-pressed="period === p.id"
          @click="period = p.id"
        >
          {{ p.label }}
        </button>
      </div>
    </header>

    <UiSkeleton v-if="cargando && !revenue" variant="rows" :rows="4" label="Cargando el tablero…" class="ui-card" />

    <template v-else>
      <ul class="mb-4 space-y-2" aria-label="Lectura del periodo">
        <li
          v-for="(l, i) in lectura"
          :key="i"
          class="flex items-start gap-3 rounded-xl border px-4 py-3 text-sm"
          :class="TONO[l.tono]"
        >
          <span class="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border border-current text-xs font-black" aria-hidden="true">{{ ICONO[l.tono] }}</span>
          <span class="text-ink">{{ l.texto }}</span>
        </li>
      </ul>

      <div class="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <UiStatCard label="Ingresos" :value="formatMoney(revenue?.totalRevenue, 0)" :delta="variacionDe(comparison?.metricas.ingresos)" :delta-label="contra" :hint="`${fmtInt(revenue?.totalAppointments)} citas cobradas`" to="/reports" />
        <UiStatCard label="Ticket promedio" :value="formatMoney(revenue?.averageRevenue, 0)" hint="Por cita cobrada" />
        <UiStatCard label="Citas" :value="fmtInt(appts?.totalAppointments)" :delta="variacionDe(comparison?.metricas.citas)" :delta-label="contra" :hint="`${fmtInt(appts?.appointmentsByStatus?.completada)} completadas`" to="/appointments" />
        <UiStatCard label="Finalización" :value="`${Math.round(appts?.completionRate ?? 0)}%`" :progress="appts?.completionRate ?? 0" hint="Citas completadas" />
      </div>

      <div class="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section class="rounded-2xl border border-line bg-card p-5 sm:p-6">
          <h3 class="text-base font-semibold text-ink">¿Quién genera el dinero?</h3>
          <p class="mb-5 mt-0.5 text-sm text-muted">Ingresos por barbero en el periodo</p>
          <UiBarList v-if="barberoItems.length" :items="barberoItems" />
          <p v-else class="rounded-xl border border-dashed border-line py-10 text-center text-sm text-muted">Sin ingresos en este periodo.</p>
        </section>
        <UiDonutCard
          title="¿Dónde se pierden citas?"
          subtitle="Cómo terminaron las citas del periodo"
          :items="estadoItems"
          center-label="Citas"
          empty-text="No hay citas en este periodo."
        />
      </div>

      <div class="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <UiDonutCard
          title="¿Los clientes regresan?"
          subtitle="Clientes activos frente a inactivos"
          :items="clienteItems"
          :center-value="`${Math.round(clients?.clientRetention ?? 0)}%`"
          center-label="Retención"
          empty-text="Aún no hay clientes registrados."
        />
        <section class="rounded-2xl border border-line bg-card p-5 sm:p-6">
          <h3 class="text-base font-semibold text-ink">Base de clientes</h3>
          <p class="mb-5 mt-0.5 text-sm text-muted">Altas y actividad del periodo</p>
          <dl class="grid grid-cols-3 gap-3 text-center">
            <div class="rounded-xl border border-line p-3">
              <dt class="text-xs uppercase tracking-wider text-muted">Total</dt>
              <dd class="mt-1 text-2xl font-black text-ink">{{ fmtInt(clients?.totalClients) }}</dd>
            </div>
            <div class="rounded-xl border border-line p-3">
              <dt class="text-xs uppercase tracking-wider text-muted">Nuevos</dt>
              <dd class="mt-1 text-2xl font-black text-gold">{{ fmtInt(clients?.newClients) }}</dd>
            </div>
            <div class="rounded-xl border border-line p-3">
              <dt class="text-xs uppercase tracking-wider text-muted">Inactivos</dt>
              <dd class="mt-1 text-2xl font-black text-ink">{{ fmtInt(clients?.inactiveClients) }}</dd>
            </div>
          </dl>
          <NuxtLink to="/campaigns" class="mt-5 inline-flex min-h-10 items-center rounded-lg border border-line px-4 text-sm font-semibold text-gold hover:bg-gold/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold">
            Reactivar con una campaña
          </NuxtLink>
        </section>
      </div>

      <AnalyticsCohortsMatrix v-if="cohortes" :cohortes="cohortes" class="mb-4" />

      <UiPeakHoursHeatmap />
    </template>
  </section>
</template>
