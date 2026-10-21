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

// El tono se ve en el filo superior de la tarjeta, en la barra y en el color del dato; ya no hay punto de color.
const EDGE: Record<BadgeTone, string> = {
  neutral: 'border-t-line', gold: 'border-t-gold', success: 'border-t-success', warning: 'border-t-warning', danger: 'border-t-danger', info: 'border-t-info',
}
const BAR: Record<BadgeTone, string> = {
  neutral: 'bg-muted', gold: 'bg-gold', success: 'bg-success', warning: 'bg-warning', danger: 'bg-danger', info: 'bg-info',
}
const VALUE: Record<BadgeTone, string> = {
  neutral: 'text-ink', gold: 'text-ink', success: 'text-success', warning: 'text-warning', danger: 'text-danger', info: 'text-ink',
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

    <ul v-if="rows.length" class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <li
        v-for="row in rows"
        :key="row.key"
        class="ub-rise flex flex-col rounded-xl border border-line border-t-2 bg-main/40 p-5"
        :class="EDGE[row.tone]"
      >
        <p class="text-sm font-semibold text-ink">{{ row.titulo }}</p>
        <p class="mt-2 text-3xl font-semibold leading-none tracking-tight" :class="VALUE[row.tone]">{{ row.dato }}</p>
        <div v-if="row.progress !== null" class="mt-3 h-1.5 overflow-hidden rounded-full bg-ink/10" role="presentation">
          <span class="block h-full rounded-full" :class="BAR[row.tone]" :style="{ width: `${row.progress}%` }" />
        </div>
        <p class="mt-3 text-sm leading-relaxed text-muted">{{ row.texto }}</p>

        <template v-if="row.detalle">
          <div class="ub-collapse" :class="{ 'is-open': open[row.key] }">
            <div class="overflow-hidden">
              <p class="pt-2 text-sm leading-relaxed text-muted">{{ row.detalle }}</p>
            </div>
          </div>
          <button
            type="button"
            class="mt-auto self-start pt-3 text-sm font-semibold text-gold hover:underline"
            :aria-expanded="!!open[row.key]"
            @click="open[row.key] = !open[row.key]"
          >
            {{ open[row.key] ? 'Ver menos' : 'Leer más' }}
          </button>
        </template>
      </li>
    </ul>
  </section>
</template>
