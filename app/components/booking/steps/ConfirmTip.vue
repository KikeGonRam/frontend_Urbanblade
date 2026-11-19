<script setup lang="ts">
defineProps<{
  presets: readonly number[]
  tipPreset: number
  usingCustomTip: boolean
  tipAmount: number
  barberName: string | undefined
}>()
const emit = defineEmits<{ 'pick-preset': [pct: number] }>()
const customTip = defineModel<string>('customTip', { required: true })
</script>

<template>
  <div class="mt-5 border-t border-line pt-5">
    <p class="mb-3 text-xs font-bold text-ink">¿Quieres dejar propina para {{ barberName || 'tu barbero' }}?</p>
    <div class="grid grid-cols-4 gap-2">
      <button
        v-for="pct in presets" :key="pct" type="button"
        class="min-h-11 rounded-xl border text-sm font-bold transition-colors"
        :class="!usingCustomTip && tipPreset === pct ? 'border-gold bg-gold/10 text-gold' : 'border-line text-ink hover:border-gold/30'"
        :aria-pressed="!usingCustomTip && tipPreset === pct"
        @click="emit('pick-preset', pct)"
      >
        {{ pct === 0 ? 'Sin propina' : `${pct * 100}%` }}
      </button>
    </div>
    <div class="mt-2 flex items-center gap-2">
      <span class="text-xs text-muted">Otro monto:</span>
      <input
        v-model="customTip"
        aria-label="Propina personalizada" type="number" min="0" step="10" placeholder="$"
        class="ui-input w-24 py-1.5 text-sm"
        @focus="customTip = customTip || String(tipAmount || '')"
      >
    </div>
  </div>
</template>
