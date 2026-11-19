<script setup lang="ts">
import type { PayChoice, PayOption } from '~/types/booking'

defineProps<{
  options: PayOption[]
  /** Monto que se cobra ahora (servicio con descuento + propina). */
  amountToCharge: number
  cardError: string
  stripeReady: boolean
}>()
const emit = defineEmits<{
  /** Contenedor del campo de tarjeta de Stripe (null al desmontarse). */
  'card-el': [el: HTMLDivElement | null]
  'receipt-change': [event: Event]
}>()
const payChoice = defineModel<PayChoice>('payChoice', { required: true })

function setCardEl(el: unknown) {
  emit('card-el', el as HTMLDivElement | null)
}
</script>

<template>
  <div class="mt-5 border-t border-line pt-5">
    <UiChoiceCards v-model="payChoice" label="¿Cuándo prefieres pagar?" :options="options" />


    <p v-if="payChoice !== 'despues'" class="mt-3 text-xs text-muted">
      Pagarás {{ bookingCurrency(amountToCharge) }} ahora (servicio con tu descuento + propina). Los productos que
      agregaste se pagan aparte, en el salón.
    </p>

    <div v-if="payChoice === 'ahora_tarjeta'" class="mt-3">
      <!-- Sin flex: en un contenedor flex el iframe de Stripe se colapsaba a 1px de ancho -->
      <div :ref="setCardEl" class="ui-input block w-full px-3 py-3" />
      <p v-if="cardError" role="alert" class="mt-2 text-xs text-danger">{{ cardError }}</p>
      <p v-if="!stripeReady" class="mt-2 text-xs text-muted">Cargando formulario de tarjeta…</p>
    </div>

    <div v-if="payChoice === 'ahora_transferencia'" class="mt-3">
      <label for="transfer-receipt" class="mb-1 block text-xs font-bold text-ink">
        Sube tu comprobante de transferencia
      </label>
      <input
        id="transfer-receipt" type="file" accept=".jpg,.jpeg,.png,.pdf" lang="es"
        class="ui-input w-full text-xs file:mr-3 file:rounded-md file:border-0 file:bg-gold file:px-3 file:py-1 file:text-xs file:font-semibold file:text-black" @change="emit('receipt-change', $event)"
      >
      <p class="mt-2 text-xs text-muted">Tu cita queda reservada mientras revisamos el comprobante.</p>
    </div>
  </div>
</template>
