<script setup lang="ts">
import type { ProductRow } from '~/types/booking'

defineProps<{
  products: ProductRow[]
  selectedIds: Set<string>
}>()
const emit = defineEmits<{ toggle: [id: string] }>()
</script>

<template>
  <div class="mt-5 border-t border-line pt-5">
    <p class="mb-3 text-xs font-bold text-ink">¿Se te antoja algo para llevar a tu cita?</p>
    <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <button
        v-for="p in products" :key="p.id" type="button"
        class="rounded-xl border p-2 text-left transition-colors"
        :class="selectedIds.has(p.id) ? 'border-gold bg-gold/10' : 'border-line hover:border-gold/30'"
        :aria-pressed="selectedIds.has(p.id)"
        @click="emit('toggle', p.id)"
      >
        <img
          v-if="p.imagen" :src="p.imagen" :alt="p.nombre"
          class="mb-2 h-16 w-full rounded-lg object-cover"
        >
        <span v-else class="mb-2 flex h-16 w-full items-center justify-center rounded-lg bg-gold/10 text-xs text-muted">
          Sin foto
        </span>
        <span class="block truncate text-xs font-bold text-ink">{{ p.nombre }}</span>
        <span class="mt-0.5 flex items-center justify-between text-xs">
          <span class="font-bold text-gold">{{ bookingCurrency(p.precio_venta) }}</span>
          <span v-if="selectedIds.has(p.id)" class="font-black text-gold">✓ Agregado</span>
        </span>
      </button>
    </div>
  </div>
</template>
