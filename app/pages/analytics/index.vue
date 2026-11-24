<script setup lang="ts">
/*
 * Fase Analítica — puerto de Analytics\AnalyticsController (web) contra el
 * nuevo Api\Analytics\AnalyticsController en barber (creado en esta misma
 * fase; no existía ninguna API para esto antes). La página es solo para
 * administrador y recepcionista (middleware `staff`, nov-2026): antes un
 * cliente entraba escribiendo la URL. El backend sigue recortando
 * el contenido por rol (AnalyticsInsightService); la vista simple de abajo se
 * conserva por si una cuenta con varios roles recibe ese recorte.
 *
 * Las secciones técnicas «Flujo del análisis» y «Cobertura de
 * visualizaciones» se quitaron (nov-2026): describían el motor, no el negocio.
 *
 * Simplificación deliberada frente al Blade original (401 líneas, con tabs+
 * mini-charts-en-header+heatmap/matrix/factor-list custom+panel de
 * diagnóstico colapsable+quick actions): aquí los tipos visuales
 * heatmap/matrix/factor-list se muestran como texto/lista en vez de
 * visualizaciones custom (fuera de alcance razonable para esta fase), y no
 * hay panel de diagnóstico ni accesos rápidos — el contenido y las
 * gráficas reales (bar/line/doughnut vía Chart.js) sí están completos.
 */
import { ensureChartjsRegistered } from '~/utils/registerChartjs'
import { Bar, Doughnut, Line } from 'vue-chartjs'
import { UB_CATEGORICAL, chartScale, goldHex, inkRgba } from '~/utils/chartTheme'
import type { ChatbotTelemetry } from '~/types/dashboard'

ensureChartjsRegistered()

// Solo administrador y recepcionista; el resto vuelve a /dashboard con el aviso de acceso denegado.
// (El barbero ya ve sus oportunidades en su dashboard; se quitó del menú el 26-sep.)
definePageMeta({ middleware: ['auth', 'staff'], layout: 'dashboard' })

useSeoMeta({ title: 'Analítica — UrbanBlade', robots: 'noindex' })

const { user: analyticsUser } = useAuth()

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

interface AnalyticsResponse {
  operational?: {
    calculated_at: string
    period: { start: string, end: string, timezone: string }
    kpis: { label: string, value: number, detail: string }[]
    actions: { label: string, detail: string, to: string }[]
  } | null
  rol_label: 'administrador' | 'recepcionista' | 'barbero' | 'cliente' | 'invitado'
  kpis: KpiDto[]
  ultima_actualizacion: string | null
  secciones: Record<string, SeccionDto>
  diagnostico_insights: InsightDto[]
}

const TONE_CLASS: Record<string, string> = {
  gold: 'border-gold/25 bg-gold/[0.06] text-gold',
  info: 'border-info/25 bg-sky-500/[0.06] text-info',
  success: 'border-success/25 bg-emerald-500/[0.06] text-success',
  warning: 'border-warning/25 bg-amber-500/[0.06] text-warning',
  danger: 'border-danger/25 bg-rose-500/[0.06] text-danger',
}

const { apiFetch } = useApi()

const { data: response, pending, error, refresh } = await useAsyncData(
  'analytics', () => apiFetch<AnalyticsResponse>('/analytics'),
  { lazy: true },
)

// Predicciones y uso de Bladebot: salieron del panel del administrador (rediseño, nov-2026) y viven aquí. El uso
// del asistente solo viene en GET /dashboard (DashboardService::chatbotTelemetrySummary), así que se pide aparte.
const esAdmin = computed(() => analyticsUser.value?.roles?.includes('administrador') ?? false)
const { data: tableroAdmin } = await useAsyncData(
  'analytics-chatbot',
  () => (esAdmin.value
    ? apiFetch<{ data?: { chatbotTelemetry?: ChatbotTelemetry } }>('/dashboard')
    : Promise.resolve(null)),
  { lazy: true },
)
const telemetria = computed(() => tableroAdmin.value?.data?.chatbotTelemetry ?? null)

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

    <!-- Tablero con gráficas y lectura automática: solo administración (usa los reportes de /admin). -->
    <AnalyticsAdminBoard v-if="esAdmin" />

    <section v-if="esAdmin" class="mb-8 space-y-4" aria-labelledby="predicciones-asistente">
      <header>
        <h2 id="predicciones-asistente" class="text-lg font-black text-ink">Predicciones y asistente</h2>
        <p class="mt-0.5 text-sm text-muted">Lo que se espera para los próximos 7 días y cómo responde Bladebot.</p>
      </header>
      <div class="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <DashboardAdministradorAiPredictions />
        <DashboardAdministradorChatbotUsage v-if="telemetria" :telemetry="telemetria" />
      </div>
    </section>

    <section v-if="!pending && !error && response?.operational" class="mb-8 space-y-4" aria-label="Análisis operativo actual">
      <div>
        <h2 class="text-lg font-bold text-ink">Operación actual</h2>
        <p class="mt-1 text-xs text-muted">Calculado desde citas y pagos registrados. Periodo: {{ response.operational.period.start }} — {{ response.operational.period.end }} · {{ response.operational.period.timezone }}</p>
      </div>
      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <article v-for="kpi in response.operational.kpis" :key="kpi.label" class="ui-card p-4">
          <h3 class="text-xs font-bold text-muted">{{ kpi.label }}</h3>
          <p class="my-2 text-2xl font-black text-ink">{{ kpi.value }}</p>
          <p class="text-xs text-muted">{{ kpi.detail }}</p>
        </article>
      </div>
      <div v-if="response.operational.actions.length" class="grid gap-3 sm:grid-cols-2">
        <NuxtLink v-for="action in response.operational.actions" :key="action.to + action.label" :to="action.to" class="ui-card p-4 hover:border-gold">
          <strong class="text-sm text-gold">{{ action.label }} →</strong>
          <p class="mt-1 text-xs text-muted">{{ action.detail }}</p>
        </NuxtLink>
      </div>
      <p v-else class="text-sm text-muted">Sin acciones pendientes detectadas en estos indicadores.</p>
    </section>

    <p v-if="pending" class="text-sm text-muted">Calculando análisis…</p>
    <BrandStatePanel
      v-else-if="error"
      mascot="bruno"
      state="error"
      tone="danger"
      title="No se pudo cargar el centro de análisis"
      action-label="Reintentar"
      @action="refresh"
    />
    <p v-else-if="!allInsightsFlat.length" class="rounded-2xl border border-dashed border-line p-4 text-sm text-muted">
      Aún no hay análisis históricos publicados. No se muestran predicciones sin resultados disponibles; los indicadores del día están en tu panel.
    </p>

    <template v-else>
      <!-- Vista simple: cliente / barbero -->
      <section v-if="isSimpleView" class="space-y-4">
        <span class="inline-block rounded-full border border-gold/25 bg-gold/10 px-3 py-1 text-xs font-black uppercase tracking-widest text-gold">
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
        <section v-if="response?.kpis.length" class="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div v-for="kpi in response.kpis" :key="kpi.label" class="rounded-2xl border p-4" :class="TONE_CLASS[kpi.tone] ?? TONE_CLASS.gold">
            <p class="text-xs font-bold uppercase opacity-75">{{ kpi.label }}</p>
            <p class="mt-1 text-xl font-black">{{ kpi.value }}</p>
            <p class="mt-0.5 text-xs opacity-70">{{ kpi.detail }}</p>
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
      </template>
    </template>
  </div>
</template>
