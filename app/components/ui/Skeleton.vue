<script setup lang="ts">
/*
 * Esqueleto de carga (auditoría UI/UX A-02): mientras llegan los datos o se prepara una gráfica, la tarjeta mantiene
 * su altura y muestra la silueta de lo que vendrá, en vez de quedar vacía o de mostrar solo «Cargando…».
 * El pulso se apaga con «reducir movimiento».
 */
withDefaults(
  defineProps<{
    /** `block`: recuadro; `chart`: barras de una gráfica; `rows`: filas de una tabla. */
    variant?: 'block' | 'chart' | 'rows'
    rows?: number
    label?: string
  }>(),
  { variant: 'block', rows: 6, label: 'Cargando…' },
)

// Alturas fijas (en %): una silueta de gráfica sin números aleatorios para no desajustar la hidratación.
const BARS = [38, 62, 46, 78, 54, 90, 66, 48, 72, 58, 84, 44]
</script>

<template>
  <div role="status" aria-live="polite" :aria-label="label" class="w-full">
    <span class="sr-only">{{ label }}</span>

    <div v-if="variant === 'chart'" class="flex h-full min-h-40 w-full items-end gap-2 px-1 pb-1" aria-hidden="true">
      <span
        v-for="(h, i) in BARS"
        :key="i"
        class="flex-1 rounded-t-md bg-ink/10 motion-safe:animate-pulse"
        :style="{ height: `${h}%`, animationDelay: `${i * 60}ms` }"
      />
    </div>

    <div v-else-if="variant === 'rows'" class="space-y-3 p-4" aria-hidden="true">
      <div v-for="n in rows" :key="n" class="flex items-center gap-4">
        <span class="h-9 w-9 shrink-0 rounded-full bg-ink/10 motion-safe:animate-pulse" />
        <span class="h-3 flex-1 rounded bg-ink/10 motion-safe:animate-pulse" :style="{ maxWidth: `${55 + ((n * 17) % 35)}%` }" />
        <span class="hidden h-3 w-24 rounded bg-ink/10 motion-safe:animate-pulse sm:block" />
        <span class="h-3 w-16 rounded bg-ink/10 motion-safe:animate-pulse" />
      </div>
    </div>

    <span v-else class="block h-full min-h-24 w-full rounded-xl bg-ink/10 motion-safe:animate-pulse" aria-hidden="true" />
  </div>
</template>
