<script setup lang="ts">
/*
 * Lista con barras (estilo Tremor BarList) del kit: nombre completo a la izquierda, valor a la
 * derecha y una barra dorada proporcional debajo. Se lee mejor que una gráfica con etiquetas
 * giradas cuando hay nombres largos (barberos, servicios). Las barras crecen al entrar en pantalla.
 */
export interface BarListItem {
  label: string;
  value: number;
  /** Texto del valor (p. ej. "$18,400"); por defecto el número. */
  display?: string;
  /** Detalle secundario (p. ej. "62 citas"). */
  detail?: string;
  /** Resalta la fila (p. ej. "Barberos dados de baja" en gris). */
  muted?: boolean;
}

const props = defineProps<{ items: BarListItem[] }>();

const root = ref<HTMLElement | null>(null);
const inView = useInView(root);
const max = computed(() => Math.max(1, ...props.items.map((i) => i.value)));

// La primera fila va en el oro de la marca y las demás recorren la paleta del tema (--chart-N-rgb), con un degradado
// de izquierda a derecha para que la barra no sea un bloque plano.
function barBackground(i: number) {
  const rgb = i === 0 ? "var(--gold-rgb)" : `var(--chart-${((i - 1) % 5) + 1}-rgb)`;

  return `linear-gradient(90deg, rgb(${rgb} / 0.55), rgb(${rgb}))`;
}
</script>

<template>
  <ul ref="root" class="space-y-4">
    <li v-for="(item, i) in items" :key="item.label">
      <div class="flex items-baseline justify-between gap-3 text-sm">
        <span class="min-w-0 truncate font-medium" :class="item.muted ? 'text-muted' : 'text-ink'">{{ item.label }}</span>
        <span class="shrink-0 tabular-nums">
          <span class="font-semibold text-ink">{{ item.display ?? item.value.toLocaleString("es-MX") }}</span>
          <span v-if="item.detail" class="ml-2 text-muted">{{ item.detail }}</span>
        </span>
      </div>
      <div class="mt-2 h-2.5 overflow-hidden rounded-full bg-ink/[0.07]" role="presentation">
        <div
          class="ub-bar h-full rounded-full"
          :class="item.muted ? 'bg-ink/25' : ''"
          :style="{
            width: inView ? `${Math.max(2, (item.value / max) * 100)}%` : '0%',
            transitionDelay: `${i * 70}ms`,
            ...(item.muted ? {} : { background: barBackground(i) }),
          }"
        />
      </div>
    </li>
  </ul>
</template>

<style scoped>
.ub-bar {
  transition: width 800ms cubic-bezier(0.22, 1, 0.36, 1);
}
@media (prefers-reduced-motion: reduce) {
  .ub-bar {
    transition: none;
  }
}
</style>
