<script setup lang="ts">
import type { PaymentRow } from "~/types/payments";

defineProps<{ payment: PaymentRow; busy: boolean; error: string }>();
defineEmits<{ close: []; confirm: [] }>();

const reason = defineModel<string>("reason", { required: true });
</script>

<template>
  <!-- Anular cobro: pide motivo -->
  <UiModal
    title="Anular cobro"
    :busy="busy"
    @close="$emit('close')"
  >
    <form class="space-y-3" @submit.prevent="$emit('confirm')">
      <p class="text-sm text-muted">
        Se anula el cobro de {{ formatMoney(payment.monto) }} de {{ payment.appointment.client ?? "este cliente" }}.
        El comprobante se borra y no se puede deshacer; el motivo queda en la bitácora.
      </p>
      <div>
        <label for="void-reason" class="mb-1 block text-xs text-muted">Motivo</label>
        <textarea
          id="void-reason"
          v-model="reason"
          rows="3"
          maxlength="300"
          required
          class="w-full rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink"
        />
      </div>
      <p v-if="error" role="alert" class="text-xs text-danger">{{ error }}</p>
      <div class="flex justify-end gap-2">
        <button type="button" class="min-h-10 rounded-lg border border-line px-4 py-2 text-sm text-muted" :disabled="busy" @click="$emit('close')">Volver</button>
        <button type="submit" class="min-h-10 rounded-lg bg-danger px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" :disabled="busy">
          {{ busy ? "Anulando…" : "Sí, anular cobro" }}
        </button>
      </div>
    </form>
  </UiModal>
</template>
