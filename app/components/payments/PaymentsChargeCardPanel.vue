<script setup lang="ts">
defineProps<{ visible: boolean; errors: string; processing: boolean }>();
defineEmits<{ pay: [] }>();

// Contenedor donde Stripe monta el campo de tarjeta; el padre lo recibe vía v-model.
const cardEl = defineModel<HTMLDivElement | null>("cardEl", { required: true });

function setCardEl(el: unknown) {
  cardEl.value = el as HTMLDivElement | null;
}
</script>

<template>
  <div
    v-show="visible"
    class="space-y-3 rounded-xl border border-gold/20 bg-ink/3 p-4"
  >
    <p
      class="text-xs font-black uppercase tracking-widest text-gold"
    >
      Pago con tarjeta (beta) — procesado por Stripe
    </p>
    <div
      :ref="setCardEl"
      class="min-h-[46px] rounded-lg border border-line bg-card p-3"
    />
    <p
      v-if="errors"
      class="text-xs font-black uppercase text-danger"
    >
      {{ errors }}
    </p>
    <button
      type="button"
      :disabled="processing"
      class="w-full rounded-lg bg-gold py-2.5 text-xs font-black uppercase tracking-widest text-black hover:bg-gold-dim disabled:opacity-50"
      @click="$emit('pay')"
    >
      {{ processing ? "Procesando…" : "Cobrar con tarjeta" }}
    </button>
  </div>
</template>
