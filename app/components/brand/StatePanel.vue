<script setup lang="ts">
import type { MascotId, MascotState } from '~/composables/useBrandMascots'

withDefaults(defineProps<{
  mascot: MascotId
  state: MascotState
  title: string
  description?: string
  tone?: 'neutral' | 'danger'
  actionLabel?: string
}>(), {
  description: undefined,
  tone: 'neutral',
  actionLabel: undefined,
})

const emit = defineEmits<{ action: [] }>()
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
    <button
      v-if="actionLabel"
      type="button"
      class="mt-4 min-h-11 rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink transition-colors hover:border-gold hover:bg-gold/10 active:scale-[.98]"
      @click="emit('action')"
    >
      {{ actionLabel }}
    </button>
  </section>
</template>
