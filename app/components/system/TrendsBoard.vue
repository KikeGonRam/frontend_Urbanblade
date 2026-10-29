<script setup lang="ts">
/*
 * Tendencias del monitor (auditoría UI/UX I-01): latencia, cola y salud en el tiempo, con selector de ventana
 * (1 h, 6 h, 24 h) y registro de cambios de estado. Se alimenta del historial local del navegador; solo cubre el
 * tiempo en que el monitor estuvo abierto, y así se dice en pantalla.
 */
import { Line } from 'vue-chartjs'
import type { SystemHealth, SystemIncident, SystemSample } from '~/utils/systemHistory'
import { resumen, windowed } from '~/utils/systemHistory'
import { chartAxisClean, chartScale, chartTooltip, fmtInt, tokenRgba } from '~/utils/chartTheme'
import { ensureChartjsRegistered } from '~/utils/registerChartjs'

ensureChartjsRegistered()

const props = defineProps<{ samples: SystemSample[], incidents: SystemIncident[] }>()
const emit = defineEmits<{ clear: [] }>()

const VENTANAS = [
  { id: '1h', label: '1 hora', ms: 3_600_000 },
  { id: '6h', label: '6 horas', ms: 21_600_000 },
  { id: '24h', label: '24 horas', ms: 86_400_000 },
] as const
const ventana = ref<(typeof VENTANAS)[number]['id']>('1h')
const ms = computed(() => VENTANAS.find(v => v.id === ventana.value)!.ms)

// «Ahora» se actualiza con cada lectura nueva, no con el reloj, para que la gráfica no se mueva sola.
const ahora = computed(() => props.samples.at(-1)?.t ?? 0)
const visibles = computed(() => windowed(props.samples, ms.value, ahora.value))

const etiqueta = (t: number) => new Date(t).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
const labels = computed(() => visibles.value.map(s => etiqueta(s.t)))

function linea(nombre: string, datos: (number | null)[], color: string, relleno = false) {
  return {
    label: nombre,
    data: datos,
    borderColor: color,
    backgroundColor: relleno ? color.replace(/[\d.]+\)$/, '0.12)') : color,
    borderWidth: 2,
    fill: relleno,
    tension: 0.25,
    pointRadius: visibles.value.length > 60 ? 0 : 2.5,
    pointHoverRadius: 5,
    spanGaps: true,
  }
}

const latenciaData = computed(() => ({
  labels: labels.value,
  datasets: [
    linea('MongoDB (ms)', visibles.value.map(s => s.db), tokenRgba('gold', 0.95), true),
    ...(visibles.value.some(s => s.redis !== null) ? [linea('Redis (ms)', visibles.value.map(s => s.redis), tokenRgba('info', 0.95))] : []),
  ],
}))
const colaData = computed(() => ({
  labels: labels.value,
  datasets: [
    linea('Pendientes', visibles.value.map(s => s.pending), tokenRgba('info', 0.95)),
    linea('Fallidos', visibles.value.map(s => s.failedJobs), tokenRgba('danger', 0.95)),
  ],
}))

function opciones(unidad: string) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index' as const, intersect: false },
    plugins: {
      legend: { display: true, position: 'bottom' as const, labels: { boxWidth: 10, boxHeight: 10, color: tokenRgba('ink', 0.7), font: { size: 12 } } },
      tooltip: { ...chartTooltip(), callbacks: { label: (c: { dataset: { label?: string }, parsed: { y: number | null } }) => `${c.dataset.label}: ${fmtInt(c.parsed.y)} ${unidad}`.trim() } },
    },
    scales: {
      x: { ...chartAxisClean(), ticks: { ...chartAxisClean().ticks, maxTicksLimit: 6, maxRotation: 0 } },
      y: { ...chartScale(), beginAtZero: true, ticks: { ...chartScale().ticks, precision: 0 } },
    },
  }
}

const statsDb = computed(() => resumen(visibles.value.map(s => s.db)))
const statsRedis = computed(() => resumen(visibles.value.map(s => s.redis)))
const hayDatos = computed(() => visibles.value.length >= 2)

// Franja de salud: hasta 48 cubos, cada uno con el peor estado que hubo en él.
const PESO: Record<SystemHealth, number> = { ok: 0, warn: 1, down: 2 }
const COLOR: Record<SystemHealth, string> = { ok: 'bg-success', warn: 'bg-warning', down: 'bg-danger' }
const NOMBRE: Record<SystemHealth, string> = { ok: 'Estable', warn: 'Con avisos', down: 'Caído' }
const franja = computed(() => {
  const v = visibles.value
  if (!v.length) return []
  const n = Math.min(48, v.length)
  const cubos: { health: SystemHealth, desde: number }[] = []
  for (let i = 0; i < n; i++) {
    const tramo = v.slice(Math.floor((i * v.length) / n), Math.floor(((i + 1) * v.length) / n) || undefined)
    const peor = tramo.reduce<SystemHealth>((p, s) => (PESO[s.health] > PESO[p] ? s.health : p), 'ok')
    cubos.push({ health: peor, desde: tramo[0]?.t ?? v[0]!.t })
  }

  return cubos
})
const estable = computed(() => visibles.value.length ? Math.round((visibles.value.filter(s => s.health === 'ok').length / visibles.value.length) * 100) : 0)

const incidentesVisibles = computed(() => props.incidents.filter(i => i.t >= ahora.value - ms.value).slice(0, 8))

/*
 * Tráfico real del servidor (peticiones, errores 5xx y latencia media por minuto). Viene del backend, así que cubre
 * también el tiempo en que el monitor estuvo cerrado. Si el servidor aún no lo ofrece, la sección se omite.
 */
interface PuntoTrafico { t: string, requests: number, errors: number, avg_ms: number | null }
interface Trafico { step: number, sample_rate: number, points: PuntoTrafico[] }
const PASO: Record<(typeof VENTANAS)[number]['id'], { minutes: number, step: number }> = {
  '1h': { minutes: 60, step: 1 },
  '6h': { minutes: 360, step: 6 },
  '24h': { minutes: 1440, step: 24 },
}
const { apiFetch } = useApi()
const { data: traficoRes, refresh: refrescarTrafico } = await useAsyncData(
  'system-traffic',
  () => apiFetch<Trafico>('/admin/system/metrics', { query: PASO[ventana.value] }).catch(() => null),
  { watch: [ventana], lazy: true },
)
const trafico = computed(() => traficoRes.value?.points ?? [])
const hayTrafico = computed(() => trafico.value.some(p => p.requests > 0))
const etiquetaTrafico = computed(() => trafico.value.map(p => etiqueta(new Date(p.t).getTime())))
const traficoData = computed(() => ({
  labels: etiquetaTrafico.value,
  datasets: [
    linea('Peticiones', trafico.value.map(p => p.requests), tokenRgba('gold', 0.95), true),
    linea('Errores 5xx', trafico.value.map(p => p.errors), tokenRgba('danger', 0.95)),
  ],
}))
const latenciaApiData = computed(() => ({
  labels: etiquetaTrafico.value,
  datasets: [linea('Latencia media (ms)', trafico.value.map(p => p.avg_ms), tokenRgba('info', 0.95), true)],
}))
const totalesTrafico = computed(() => {
  const total = trafico.value.reduce((s, p) => s + p.requests, 0)
  const errores = trafico.value.reduce((s, p) => s + p.errors, 0)
  const ponderado = trafico.value.reduce((s, p) => s + (p.avg_ms ?? 0) * p.requests, 0)

  return {
    total,
    errores,
    tasa: total > 0 ? Math.round((errores / total) * 1000) / 10 : 0,
    media: total > 0 ? Math.round(ponderado / total) : null,
  }
})

let temporizador: ReturnType<typeof setInterval> | undefined
onMounted(() => { temporizador = setInterval(() => { void refrescarTrafico() }, 60_000) })
onBeforeUnmount(() => clearInterval(temporizador))
</script>

<template>
  <section class="rounded-2xl border border-line bg-card p-5 sm:p-6" aria-labelledby="tendencias">
    <header class="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 id="tendencias" class="text-base font-semibold text-ink">Tendencias</h2>
        <p class="mt-0.5 text-sm text-muted">Lecturas de este navegador mientras el monitor estuvo abierto (se guardan hasta 24 h).</p>
      </div>
      <div class="flex flex-wrap items-center gap-1" role="group" aria-label="Ventana de tiempo">
        <button
          v-for="v in VENTANAS"
          :key="v.id"
          type="button"
          class="min-h-10 rounded-lg border px-3 text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold"
          :class="ventana === v.id ? 'border-gold bg-gold/15 text-gold' : 'border-line text-muted hover:text-ink'"
          :aria-pressed="ventana === v.id"
          @click="ventana = v.id"
        >
          {{ v.label }}
        </button>
        <button
          type="button"
          class="min-h-10 rounded-lg border border-line px-3 text-xs text-muted hover:text-danger focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold"
          @click="emit('clear')"
        >
          Borrar historial
        </button>
      </div>
    </header>

    <div v-if="hayTrafico" class="mb-6 border-b border-line pb-6">
      <div class="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 class="text-sm font-semibold text-ink">Tráfico de la API</h3>
        <p class="text-xs text-muted">
          <strong class="text-ink">{{ fmtInt(totalesTrafico.total) }}</strong> peticiones ·
          <strong :class="totalesTrafico.errores ? 'text-danger' : 'text-ink'">{{ totalesTrafico.tasa }} %</strong> con error 5xx ·
          <strong class="text-ink">{{ totalesTrafico.media ?? '—' }} ms</strong> de media
        </p>
      </div>
      <div class="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div class="h-56"><Line :data="traficoData" :options="opciones('')" /></div>
        <div class="h-56"><Line :data="latenciaApiData" :options="opciones('ms')" /></div>
      </div>
      <p class="mt-2 text-xs text-muted">Se mide en el servidor sobre una muestra de las peticiones y se reescala, por lo que las cifras son aproximadas. No cuenta el propio monitor.</p>
    </div>

    <div v-if="!hayDatos" class="rounded-xl border border-dashed border-line py-12 text-center text-sm text-muted">
      Aún no hay suficientes lecturas. El monitor toma una cada 30 segundos; en un minuto verás la tendencia.
    </div>

    <template v-else>
      <div class="mb-5">
        <div class="mb-1 flex items-baseline justify-between text-xs text-muted">
          <span>Salud en la ventana</span>
          <span><strong class="text-ink">{{ estable }} %</strong> de las lecturas estables</span>
        </div>
        <div class="flex h-3 gap-px overflow-hidden rounded-full" role="img" :aria-label="`${estable} % de las lecturas estables en la ventana elegida`">
          <span
            v-for="(c, i) in franja"
            :key="i"
            class="h-full flex-1"
            :class="COLOR[c.health]"
            :title="`${etiqueta(c.desde)} · ${NOMBRE[c.health]}`"
          />
        </div>
      </div>

      <div class="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div>
          <h3 class="mb-2 text-sm font-semibold text-ink">Latencia</h3>
          <div class="h-56"><Line :data="latenciaData" :options="opciones('ms')" /></div>
          <dl v-if="statsDb" class="mt-3 grid grid-cols-4 gap-2 text-center text-xs">
            <div class="rounded-lg border border-line p-2"><dt class="text-muted">Mín.</dt><dd class="font-black text-ink">{{ statsDb.min }} ms</dd></div>
            <div class="rounded-lg border border-line p-2"><dt class="text-muted">Prom.</dt><dd class="font-black text-ink">{{ statsDb.avg }} ms</dd></div>
            <div class="rounded-lg border border-line p-2"><dt class="text-muted">Máx.</dt><dd class="font-black text-ink">{{ statsDb.max }} ms</dd></div>
            <div class="rounded-lg border border-line p-2"><dt class="text-muted">Última</dt><dd class="font-black text-gold">{{ statsDb.last }} ms</dd></div>
          </dl>
          <p v-if="statsRedis" class="mt-2 text-xs text-muted">Redis: promedio {{ statsRedis.avg }} ms, máximo {{ statsRedis.max }} ms.</p>
        </div>
        <div>
          <h3 class="mb-2 text-sm font-semibold text-ink">Cola de trabajos</h3>
          <div class="h-56"><Line :data="colaData" :options="opciones('')" /></div>
          <p class="mt-3 text-xs text-muted">Los trabajos fallidos aparecen en rojo; cualquier valor mayor a cero cambia la salud a «con avisos».</p>
        </div>
      </div>

      <div class="mt-6">
        <h3 class="mb-2 text-sm font-semibold text-ink">Cambios de estado</h3>
        <ul v-if="incidentesVisibles.length" class="divide-y divide-line rounded-xl border border-line">
          <li v-for="i in incidentesVisibles" :key="i.t" class="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm">
            <span class="tabular-nums text-muted">{{ new Date(i.t).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) }}</span>
            <span class="font-semibold" :class="i.to === 'ok' ? 'text-success' : i.to === 'warn' ? 'text-warning' : 'text-danger'">{{ NOMBRE[i.from] }} → {{ NOMBRE[i.to] }}</span>
            <span class="text-muted">{{ i.detail }}</span>
          </li>
        </ul>
        <p v-else class="rounded-xl border border-dashed border-line py-6 text-center text-sm text-muted">Sin cambios de estado en esta ventana.</p>
      </div>
    </template>
  </section>
</template>
