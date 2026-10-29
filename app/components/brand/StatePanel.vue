<script setup lang="ts">
import type { MascotId, MascotState } from '~/composables/useBrandMascots'

withDefaults(defineProps<{
  mascot: MascotId
  state: MascotState
  title: string
  description?: string
  tone?: 'neutral' | 'danger'
  actionLabel?: string
  /** Ruta a la que lleva la acción (si se da, la acción es un enlace en vez de un botón). */
  actionTo?: string
}>(), {
  description: undefined,
  tone: 'neutral',
  actionLabel: undefined,
  actionTo: undefined,
})

const emit = defineEmits<{ action: [] }>()
</script>

<template>
  <section
    class="brand-state-panel rounded-2xl border border-dashed border-line px-4 py-4 text-center"
    aria-live="polite"
  >
    <BrandMascot :mascot="mascot" :state="state" size="sm" class="mx-auto" />
    <h2 class="mt-2 text-sm font-black" :class="tone === 'danger' ? 'text-danger' : 'text-ink'">
      {{ title }}
    </h2>
    <p v-if="description" class="mx-auto mt-1 max-w-md text-xs leading-5 text-muted">
      {{ description }}
    </p>
    <NuxtLink
      v-if="actionLabel && actionTo"
      :to="actionTo"
      class="mt-4 inline-flex min-h-11 items-center rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink transition-colors hover:border-gold hover:bg-gold/10 active:scale-[.98]"
    >
      {{ actionLabel }}
    </NuxtLink>
    <button
      v-else-if="actionLabel"
      type="button"
      class="mt-4 min-h-11 rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink transition-colors hover:border-gold hover:bg-gold/10 active:scale-[.98]"
      @click="emit('action')"
    >
      {{ actionLabel }}
    </button>
  </section>
</template>
