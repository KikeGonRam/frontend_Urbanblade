<script setup lang="ts">
/*
 * "Lo que dicen tus datos": hallazgos del análisis (spark) y, en el dashboard del
 * administrador, los indicadores calculados por barber (premium, cancelaciones, hora pico),
 * juntos en una sola sección compacta. Reemplaza a las tarjetas grandes de degradados de
 * colores ("Prioridades detectadas", "Insights del análisis de datos") y a la tarjeta
 * publicitaria de analítica: ahora es un enlace en el encabezado. Mismos datos de /dashboard.
 */
import type { BadgeTone } from "~/utils/appointmentStatus";

export interface DashboardInsight {
  titulo: string
  dato: string
  color: string
  visual_label: string
  mensaje: string
  brief: string
  is_truncated: boolean
  progress_value: number | null
}

/** Forma de `insights` del dashboard del administrador (DashboardController::analysisInsights). */
export interface SimpleInsight {
  titulo: string
  dato: string
  detalle: string
}

const props = withDefaults(
  defineProps<{
    insights?: DashboardInsight[]
    simple?: SimpleInsight[]
    titulo?: string
    /** Muestra "Ver analítica completa" (roles con acceso a /analytics). */
    showLink?: boolean
  }>(),
  { insights: () => [], simple: () => [], titulo: 'Lo que dicen tus datos', showLink: false },
)

interface Row { key: string; titulo: string; dato: string; texto: string; detalle: string | null; tone: BadgeTone; progress: number | null }

const TONES: Record<string, BadgeTone> = { gold: 'gold', success: 'success', warning: 'warning', danger: 'danger', info: 'info' }

const rows = computed<Row[]>(() => [
  ...props.simple.map((s, i) => ({ key: `s${i}`, titulo: s.titulo, dato: s.dato, texto: s.detalle, detalle: null, tone: 'gold' as BadgeTone, progress: null })),
  ...props.insights.map((s, i) => ({
    key: `i${i}`,
    titulo: s.titulo,
    dato: s.dato,
    texto: s.brief,
    detalle: s.is_truncated ? s.mensaje : null,
    tone: TONES[s.color] ?? 'gold',
    progress: s.progress_value,
  })),
])

const DOT: Record<BadgeTone, string> = {
  neutral: 'bg-muted', gold: 'bg-gold', success: 'bg-success', warning: 'bg-warning', danger: 'bg-danger', info: 'bg-info',
}

const open = ref<Record<string, boolean>>({})
</script>

<template>
  <section v-if="rows.length || showLink" :aria-label="titulo" class="rounded-2xl border border-line bg-card p-5">
    <header class="flex items-center justify-between gap-3" :class="rows.length ? 'mb-4' : ''">
      <div>
        <h3 class="text-base font-semibold text-ink">{{ titulo }}</h3>
        <p v-if="rows.length" class="mt-0.5 text-sm text-muted">Hallazgos calculados con el historial real de la barbería</p>
        <p v-else class="mt-0.5 text-sm text-muted">Patrones, predicciones y recomendaciones sobre tu historial</p>
      </div>
      <NuxtLink v-if="showLink" to="/analytics" class="shrink-0 text-sm font-semibold text-gold hover:underline">
        Ver analítica completa →
      </NuxtLink>
    </header>

    <ul v-if="rows.length" class="grid gap-3 md:grid-cols-2">
      <li v-for="row in rows" :key="row.key" class="ub-rise rounded-xl border border-line bg-main/40 p-4">
        <div class="flex items-center gap-2">
          <span class="h-2 w-2 shrink-0 rounded-full" :class="DOT[row.tone]" aria-hidden="true" />
          <p class="text-sm font-medium text-muted">{{ row.titulo }}</p>
        </div>
        <p class="mt-1 text-xl font-semibold tracking-tight text-ink">{{ row.dato }}</p>
        <div v-if="row.progress !== null" class="mt-2 h-1.5 overflow-hidden rounded-full bg-ink/10" role="presentation">
          <span class="block h-full rounded-full" :class="DOT[row.tone]" :style="{ width: `${row.progress}%` }" />
        </div>
        <p class="mt-2 text-sm leading-relaxed text-muted">{{ row.texto }}</p>

        <template v-if="row.detalle">
          <div class="ub-collapse" :class="{ 'is-open': open[row.key] }">
            <div class="overflow-hidden">
              <p class="pt-2 text-sm leading-relaxed text-muted">{{ row.detalle }}</p>
            </div>
          </div>
          <button
            type="button"
            class="mt-2 text-sm font-semibold text-gold hover:underline"
            :aria-expanded="!!open[row.key]"
            @click="open[row.key] = !open[row.key]"
          >
            {{ open[row.key] ? 'Ver menos' : 'Ver detalle' }}
          </button>
        </template>
      </li>
    </ul>
  </section>
</template>
