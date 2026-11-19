<script setup lang="ts">
import type { ProductoSugerido } from "~/types/payments";

defineProps<{
  sugerencias: ProductoSugerido[];
  productosAgregados: string[];
}>();
defineEmits<{ hide: []; toggle: [id: string] }>();

function fmtMoney(n: number | string) {
  return formatMoney(n)
}
</script>

<template>
  <div class="space-y-2">
    <div class="flex items-center justify-between">
      <p class="text-xs font-bold uppercase tracking-widest text-muted">
        ¿Algo más para el cliente?
      </p>
      <button
        type="button"
        class="min-h-11 rounded-lg px-2 text-xs text-muted hover:text-ink"
        @click="$emit('hide')"
      >
        Ocultar sugerencias
      </button>
    </div>
    <ul class="flex flex-col gap-2 sm:flex-row">
      <li
        v-for="p in sugerencias"
        :key="p.id"
        class="flex flex-1 items-center gap-3 rounded-xl border border-line bg-card p-3"
      >
        <img
          v-if="p.imagen"
          :src="p.imagen"
          alt=""
          class="h-12 w-12 shrink-0 rounded-[10px] object-cover"
        >
        <div class="min-w-0 flex-1">
          <p class="truncate text-[13px] font-semibold text-ink">
            {{ p.nombre }}
          </p>
          <p class="text-sm tabular-nums text-muted">
            {{ fmtMoney(p.precio_venta) }}
          </p>
        </div>
        <button
          type="button"
          :aria-pressed="productosAgregados.includes(p.id)"
          class="min-h-11 shrink-0 rounded-lg border px-3 text-xs font-semibold"
          :class="
            productosAgregados.includes(p.id)
              ? 'border-gold bg-gold/15 text-gold-text'
              : 'border-line text-ink hover:border-gold'
          "
          @click="$emit('toggle', p.id)"
        >
          {{
            productosAgregados.includes(p.id)
              ? "Agregado ✓"
              : "Agregar"
          }}
        </button>
      </li>
    </ul>
  </div>
</template>
