<script setup lang="ts">
/*
 * Fase Analítica — puerto de Analytics\AnalyticsController (web) contra el
 * nuevo Api\Analytics\AnalyticsController en barber (creado en esta misma
 * fase; no existía ninguna API para esto antes). Los 4 roles la ven, cada
 * uno con su propio recorte (ver AnalyticsInsightService del lado servidor).
 *
 * Simplificación deliberada frente al Blade original (401 líneas, con tabs+
 * mini-charts-en-header+heatmap/matrix/factor-list custom+panel de
 * diagnóstico colapsable+quick actions): aquí los tipos visuales
 * heatmap/matrix/factor-list se muestran como texto/lista en vez de
 * visualizaciones custom (fuera de alcance razonable para esta fase), y no
 * hay panel de diagnóstico ni accesos rápidos — el contenido y las
 * gráficas reales (bar/line/doughnut vía Chart.js) sí están completos.
 */
import { Bar, Doughnut, Line } from 'vue-chartjs'
import { UB_CATEGORICAL, chartScale, goldHex, inkRgba } from '~/utils/chartTheme'

definePageMeta({ middleware: ['auth'], layout: 'dashboard' })

interface InsightDto {
  tipo: string
  titulo: string | null
  mensaje: string | null
  valor_destacado: string | null
  color: string
  grafica: { tipo?: string, labels?: string[], valores?: (string | number)[] } | null
  visual_type: string
  has_renderable_visual: boolean
  generado_en: string | null
}

interface SeccionDto {
  titulo: string
  subtitulo: string
  intro: string
  acento: string
  insights: InsightDto[]
}

interface KpiDto {
  label: string
  value: string | null
  detail: string
  tone: string
  type: string
  graph: unknown
  message: string | null
}

interface SparkFlowStepDto {
  titulo: string
  descripcion: string
  color: string
  count: number
  total: number
  progress: number
}

interface VisualCoverageDto {
  titulo: string
  descripcion: string
  color: string
  tipo: string
  count: number
}

interface AnalyticsResponse {
  rol_label: 'administrador' | 'recepcionista' | 'barbero' | 'cliente' | 'invitado'
  kpis: KpiDto[]
  ultima_actualizacion: string | null
  secciones: Record<string, SeccionDto>
  diagnostico_insights: InsightDto[]
  spark_flow: SparkFlowStepDto[]
  visual_coverage: VisualCoverageDto[]
}

const TONE_CLASS: Record<string, string> = {
  gold: 'border-gold/25 bg-gold/[0.06] text-gold',
  info: 'border-sky-400/25 bg-sky-500/[0.06] text-sky-300',
  success: 'border-emerald-400/25 bg-emerald-500/[0.06] text-emerald-300',
  warning: 'border-amber-400/25 bg-amber-500/[0.06] text-amber-300',
  danger: 'border-rose-400/25 bg-rose-500/[0.06] text-rose-300',
}
const BAR_COLOR: Record<string, string> = {
  gold: 'bg-gold', info: 'bg-sky-400', success: 'bg-emerald-400', warning: 'bg-amber-400', danger: 'bg-rose-400',
}

const { apiFetch } = useApi()

const { data: response, pending, error } = await useAsyncData(
  'analytics', () => apiFetch<AnalyticsResponse>('/analytics'),
)

const rolLabel = computed(() => response.value?.rol_label ?? 'invitado')
const isSimpleView = computed(() => ['cliente', 'barbero'].includes(rolLabel.value))
const secciones = computed(() => response.value?.secciones ?? {})
const sectionKeys = computed(() => Object.keys(secciones.value).filter((k) => secciones.value[k].insights.length > 0))
const activeTab = ref('')
watch(sectionKeys, (keys) => { if (!activeTab.value && keys.length) activeTab.value = keys[0] }, { immediate: true })

const allInsightsFlat = computed(() => Object.values(secciones.value).flatMap((s) => s.insights))

function fmtDate(iso: string | null) {
  if (!iso) return '—'

  return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

function chartKind(visualType: string): 'bar' | 'line' | 'doughnut' | null {
  if (visualType === 'bar' || visualType === 'radar') return 'bar'
  if (visualType === 'line') return 'line'
  if (visualType === 'doughnut') return 'doughnut'

  return null
}

function chartData(insight: InsightDto) {
  const labels = insight.grafica?.labels ?? []
  const valores = (insight.grafica?.valores ?? []).map((v) => Number(String(v).replace(/,/g, '')) || 0)
  const kind = chartKind(insight.visual_type)

  if (kind === 'doughnut') {
    return { labels, datasets: [{ data: valores, backgroundColor: UB_CATEGORICAL, borderWidth: 0 }] }
  }

  return {
    labels,
    datasets: [{
      data: valores,
      backgroundColor: kind === 'bar' ? `${goldHex()}cc` : `${goldHex()}22`,
      borderColor: goldHex(),
      borderWidth: kind === 'line' ? 2 : 0,
      fill: kind === 'line',
      tension: 0.3,
    }],
  }
}

const baseChartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: { x: chartScale(), y: chartScale() },
}))
const doughnutOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true, position: 'bottom' as const, labels: { color: inkRgba(0.6), boxWidth: 10, font: { size: 10 } } } } }
</script>

<template>
  <div class="p-4 sm:p-6 lg:p-8">
    <header class="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p class="text-sm uppercase tracking-widest text-muted">UrbanBlade · Inteligencia del negocio</p>
        <h1 class="mt-1 text-2xl font-semibold text-ink">Centro de <span class="text-gold">Análisis</span></h1>
        <p class="mt-1 text-sm text-muted">Indicadores, predicciones y recomendaciones listos para decidir.</p>
      </div>
      <p v-if="response?.ultima_actualizacion" class="text-xs text-muted">Actualizado: {{ fmtDate(response.ultima_actualizacion) }}</p>
    </header>

    <p v-if="pending" class="text-sm text-muted">Calculando análisis…</p>
    <p v-else-if="error" class="text-sm text-red-400">No se pudo cargar el centro de análisis.</p>
    <p v-else-if="!allInsightsFlat.length" class="rounded-2xl border border-dashed border-line p-12 text-center text-sm text-muted">
      Aún no hay resultados disponibles. El sistema actualizará este espacio cuando termine su siguiente revisión.
    </p>

    <template v-else>
      <!-- Vista simple: cliente / barbero -->
      <section v-if="isSimpleView" class="space-y-4">
        <span class="inline-block rounded-full border border-gold/25 bg-gold/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-gold">
          {{ rolLabel === 'cliente' ? 'Recomendado para ti' : 'Tu analítica personal' }}
        </span>
        <div v-for="insight in allInsightsFlat" :key="insight.tipo" class="ui-card p-5">
          <p class="font-black text-ink">{{ insight.titulo }}</p>
          <p class="mt-1 text-lg font-black" :class="TONE_CLASS[insight.color]?.split(' ')[2] ?? 'text-gold'">{{ insight.valor_destacado }}</p>
          <p class="mt-2 text-sm text-muted">{{ insight.mensaje }}</p>
        </div>
      </section>

      <!-- Vista completa: administrador / recepcionista -->
      <template v-else>
        <section v-if="response?.kpis.length" class="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <div v-for="kpi in response.kpis" :key="kpi.label" class="rounded-2xl border p-4" :class="TONE_CLASS[kpi.tone] ?? TONE_CLASS.gold">
            <p class="text-[10px] font-bold uppercase opacity-75">{{ kpi.label }}</p>
            <p class="mt-1 text-xl font-black">{{ kpi.value }}</p>
            <p class="mt-0.5 text-[11px] opacity-70">{{ kpi.detail }}</p>
          </div>
        </section>

        <section v-if="response?.spark_flow.length" class="ui-card mb-6 p-5">
          <h2 class="mb-3 text-sm font-black uppercase tracking-wide text-ink">Flujo del análisis</h2>
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-5">
            <div v-for="step in response.spark_flow" :key="step.titulo">
              <p class="text-xs font-bold text-ink">{{ step.titulo }}</p>
              <p class="mb-1.5 text-[11px] text-muted">{{ step.descripcion }}</p>
              <div class="h-1.5 w-full overflow-hidden rounded-full bg-line/40">
                <div class="h-full rounded-full" :class="BAR_COLOR[step.color] ?? BAR_COLOR.gold" :style="{ width: `${step.progress}%` }" />
              </div>
              <p class="mt-1 text-[10px] text-muted">{{ step.count }}/{{ step.total }}</p>
            </div>
          </div>
        </section>

        <nav class="mb-5 flex flex-wrap gap-2">
          <button
            v-for="key in sectionKeys" :key="key" type="button"
            class="rounded-full border px-4 py-1.5 text-xs font-bold uppercase tracking-wide transition"
            :class="activeTab === key ? 'border-gold/50 bg-gold/10 text-gold' : 'border-line text-muted hover:text-ink'"
            @click="activeTab = key"
          >
            {{ secciones[key].titulo }}
          </button>
        </nav>

        <section v-if="activeTab && secciones[activeTab]">
          <p class="mb-4 text-sm text-muted">{{ secciones[activeTab].intro }}</p>
          <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div v-for="insight in secciones[activeTab].insights" :key="insight.tipo" class="ui-card p-5">
              <p class="font-black text-ink">{{ insight.titulo }}</p>
              <p class="mt-1 text-lg font-black" :class="TONE_CLASS[insight.color]?.split(' ')[2] ?? 'text-gold'">{{ insight.valor_destacado }}</p>
              <p class="mt-2 text-sm text-muted">{{ insight.mensaje }}</p>

              <div v-if="insight.has_renderable_visual && chartKind(insight.visual_type) === 'doughnut'" class="mt-4 h-48">
                <Doughnut :data="chartData(insight)" :options="doughnutOptions" />
              </div>
              <div v-else-if="insight.has_renderable_visual && chartKind(insight.visual_type) === 'bar'" class="mt-4 h-48">
                <Bar :data="chartData(insight)" :options="baseChartOptions" />
              </div>
              <div v-else-if="insight.has_renderable_visual && chartKind(insight.visual_type) === 'line'" class="mt-4 h-48">
                <Line :data="chartData(insight)" :options="baseChartOptions" />
              </div>
              <ul v-else-if="insight.grafica?.labels?.length" class="mt-3 space-y-1 text-xs text-muted">
                <li v-for="(label, idx) in insight.grafica.labels" :key="label">
                  {{ label }}: <span class="text-ink">{{ insight.grafica.valores?.[idx] }}</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        <section v-if="response?.visual_coverage.some((v) => v.count > 0)" class="mt-6 ui-card p-5">
          <h2 class="mb-3 text-sm font-black uppercase tracking-wide text-ink">Cobertura de visualizaciones</h2>
          <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div v-for="family in response.visual_coverage.filter((v) => v.count > 0)" :key="family.tipo" class="rounded-xl border border-line p-3">
              <p class="text-lg font-black text-ink">{{ family.count }}</p>
              <p class="text-[11px] font-bold text-muted">{{ family.titulo }}</p>
            </div>
          </div>
        </section>
      </template>
    </template>
  </div>
</template>
