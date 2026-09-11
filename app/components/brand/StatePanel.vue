<script setup lang="ts">
import type { MascotId, MascotState } from '~/composables/useBrandMascots'

withDefaults(defineProps<{
  mascot: MascotId
  state: MascotState
  title: string
  description?: string
  tone?: 'neutral' | 'danger'
}>(), {
  description: undefined,
  tone: 'neutral',
})
</script>

<template>
  <section
    class="brand-state-panel rounded-2xl border border-dashed border-line px-4 py-4 text-center"
    aria-live="polite"
  >
    <BrandMascot :mascot="mascot" :state="state" size="sm" class="mx-auto" />
    <h2 class="mt-2 text-sm font-black" :class="tone === 'danger' ? 'text-red-400' : 'text-ink'">
      {{ title }}
    </h2>
    <p v-if="description" class="mx-auto mt-1 max-w-md text-xs leading-5 text-muted">
      {{ description }}
    </p>
  </section>
</template>
