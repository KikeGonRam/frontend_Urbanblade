<script setup lang="ts">
defineProps<{
  steps: readonly string[]
  step: number
  saving: boolean
  hasService: boolean
  hasBarber: boolean
  hasSchedule: boolean
}>()
const emit = defineEmits<{ go: [target: number] }>()
</script>

<template>
  <ol class="mb-6 grid grid-cols-2 gap-2 text-xs font-black tracking-wide sm:grid-cols-4">
    <li v-for="(label, i) in steps" :key="label" class="flex flex-1 items-center gap-1 sm:gap-2">
      <button
        type="button"
        class="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border px-2 py-2 transition-colors sm:px-3"
        :class="i === step
          ? 'border-gold/40 bg-gold/10 text-gold'
          : i < step ? 'border-line text-ink hover:border-gold/30' : 'border-line text-muted'"
        :disabled="saving || (i > 0 && !hasService) || (i > 1 && !hasBarber) || (i > 2 && !hasSchedule)"
        :aria-current="i === step ? 'step' : undefined"
        @click="emit('go', i)"
      >
        <!-- Paso hecho: ✓ en lugar del número, para ver de un vistazo lo que ya está resuelto. -->
        <span class="grid h-5 w-5 place-items-center rounded-full border border-current text-xs" aria-hidden="true">{{ i < step ? '✓' : i + 1 }}</span>
        <span>{{ label }}<span v-if="i < step" class="sr-only">, completado</span></span>
      </button>
    </li>
  </ol>
</template>
