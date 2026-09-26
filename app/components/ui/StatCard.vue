<script setup lang="ts">
/*
 * KPI del kit (skill urbanblade-ui-kit): etiqueta, valor grande, variación contra el periodo
 * anterior y, opcional, minigráfica o barra de avance. Inspirado en Tremor/Untitled UI, con
 * los colores del tema: el valor va en tinta, lo dorado es el acento y verde/rojo solo la variación.
 */
const props = withDefaults(
  defineProps<{
    label: string;
    value: string | number;
    /** Variación en % contra el periodo anterior; null o 0 la oculta. */
    delta?: number | null;
    deltaLabel?: string;
    hint?: string | null;
    /** Serie para la minigráfica (se dibuja en oro). */
    spark?: number[] | null;
    /** 0–100 para una barra de avance. */
    progress?: number | null;
    to?: string | null;
  }>(),
  { delta: null, deltaLabel: "vs. periodo anterior", hint: null, spark: null, progress: null, to: null },
);

const sparkPath = computed(() => {
  const vals = (props.spark ?? []).filter((v) => Number.isFinite(v));
  if (vals.length < 2) return "";
  const w = 100;
  const h = 28;
  const max = Math.max(...vals);
  const min = Math.min(...vals);
  const rng = max - min || 1;
  const step = w / (vals.length - 1);

  return "M " + vals.map((v, i) => `${(i * step).toFixed(2)},${(h - 2 - ((v - min) / rng) * (h - 4)).toFixed(2)}`).join(" L ");
});

// Resuelto aquí: resolveComponent dentro de la plantilla dejaba la tarjeta sin enlace.
const NuxtLink = resolveComponent("NuxtLink");

const up = computed(() => (props.delta ?? 0) >= 0);
const showDelta = computed(() => props.delta !== null && props.delta !== 0 && Number.isFinite(props.delta));
</script>

<template>
  <component
    :is="to ? NuxtLink : 'div'"
    :to="to ?? undefined"
    class="ub-rise group flex flex-col rounded-2xl border border-line bg-card p-5 transition-colors duration-200"
    :class="to ? 'hover:border-gold/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold' : ''"
  >
    <div class="flex items-start justify-between gap-3">
      <p class="text-sm font-medium text-muted">{{ label }}</p>
      <span v-if="$slots.icon" class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gold/10 text-gold" aria-hidden="true">
        <slot name="icon" />
      </span>
    </div>

    <p class="mt-2 text-3xl font-bold tracking-tight text-ink tabular-nums">{{ value }}</p>

    <svg v-if="sparkPath" viewBox="0 0 100 28" preserveAspectRatio="none" class="mt-3 h-7 w-full" aria-hidden="true">
      <path :d="sparkPath" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="text-gold" vector-effect="non-scaling-stroke" />
    </svg>
    <div v-else-if="progress !== null" class="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-ink/10" role="presentation">
      <div class="h-full rounded-full bg-gold" :style="{ width: `${Math.max(0, Math.min(100, progress))}%` }" />
    </div>

    <div class="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 pt-3 text-xs">
      <span
        v-if="showDelta"
        class="inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-semibold tabular-nums"
        :class="up ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'"
      >
        <span aria-hidden="true">{{ up ? "▲" : "▼" }}</span>
        <span class="sr-only">{{ up ? "Sube" : "Baja" }}</span>
        {{ Math.abs(delta ?? 0) }}%
      </span>
      <span v-if="showDelta" class="text-muted">{{ deltaLabel }}</span>
      <span v-if="hint" class="text-muted" :class="showDelta ? 'w-full' : ''">{{ hint }}</span>
    </div>
  </component>
</template>
