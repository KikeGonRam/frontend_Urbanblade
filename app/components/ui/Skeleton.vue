<script setup lang="ts">
/*
 * Esqueleto de carga (auditoría UI/UX A-02): mientras llegan los datos o se prepara una gráfica, la tarjeta mantiene
 * su altura y muestra la silueta de lo que vendrá, en vez de quedar vacía o de mostrar solo «Cargando…».
 * El pulso se apaga con «reducir movimiento».
 */
withDefaults(
  defineProps<{
    /**
     * `block`: recuadro; `chart`: barras de una gráfica; `rows`: filas de una tabla;
     * `cards`: indicadores (KPI) y un panel; `list`: lista de avisos con icono y dos líneas;
     * `feed`: tarjetas con imagen (muro).
     */
    variant?: 'block' | 'chart' | 'rows' | 'cards' | 'list' | 'feed'
    rows?: number
    label?: string
  }>(),
  { variant: 'block', rows: 6, label: 'Cargando…' },
)

// Alturas fijas (en %): una silueta de gráfica sin números aleatorios para no desajustar la hidratación.
const BARS = [38, 62, 46, 78, 54, 90, 66, 48, 72, 58, 84, 44]
</script>

<template>
  <div role="status" aria-live="polite" aria-busy="true" :aria-label="label" class="w-full">
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

    <div v-else-if="variant === 'cards'" class="space-y-4" aria-hidden="true">
      <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div v-for="n in 4" :key="n" class="ui-card space-y-3 p-4">
          <span class="block h-3 w-1/2 rounded bg-ink/10 motion-safe:animate-pulse" :style="{ animationDelay: `${n * 60}ms` }" />
          <span class="block h-7 w-2/3 rounded bg-ink/10 motion-safe:animate-pulse" :style="{ animationDelay: `${n * 60}ms` }" />
        </div>
      </div>
      <div class="ui-card h-56 p-4">
        <span class="mb-4 block h-3 w-1/4 rounded bg-ink/10 motion-safe:animate-pulse" />
        <div class="flex h-36 items-end gap-2">
          <span
            v-for="(h, i) in BARS"
            :key="i"
            class="flex-1 rounded-t-md bg-ink/10 motion-safe:animate-pulse"
            :style="{ height: `${h}%`, animationDelay: `${i * 60}ms` }"
          />
        </div>
      </div>
    </div>

    <ul v-else-if="variant === 'list'" class="space-y-2" aria-hidden="true">
      <li v-for="n in rows" :key="n" class="ui-card flex items-start gap-3 p-4">
        <span class="h-10 w-10 shrink-0 rounded-full bg-ink/10 motion-safe:animate-pulse" />
        <span class="flex-1 space-y-2">
          <span class="block h-3 rounded bg-ink/10 motion-safe:animate-pulse" :style="{ width: `${40 + ((n * 13) % 30)}%` }" />
          <span class="block h-3 rounded bg-ink/10 motion-safe:animate-pulse" :style="{ width: `${65 + ((n * 7) % 25)}%` }" />
        </span>
        <span class="h-3 w-12 shrink-0 rounded bg-ink/10 motion-safe:animate-pulse" />
      </li>
    </ul>

    <div v-else-if="variant === 'feed'" class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-hidden="true">
      <div v-for="n in rows" :key="n" class="ui-card overflow-hidden">
        <span class="block aspect-[4/3] w-full bg-ink/10 motion-safe:animate-pulse" :style="{ animationDelay: `${n * 60}ms` }" />
        <div class="space-y-2 p-3">
          <span class="block h-3 w-2/3 rounded bg-ink/10 motion-safe:animate-pulse" />
          <span class="block h-3 w-1/3 rounded bg-ink/10 motion-safe:animate-pulse" />
        </div>
      </div>
    </div>

    <span v-else class="block h-full min-h-24 w-full rounded-xl bg-ink/10 motion-safe:animate-pulse" aria-hidden="true" />
  </div>
</template>
