<script setup lang="ts">
import type { BarberRow, PayChoice, PayOption, ProductRow, ServiceRow } from '~/types/booking'

defineProps<{
  service: ServiceRow | null
  barber: BarberRow | null
  date: string
  time: string
  /** Totales de referencia: el servidor es la autoridad al cobrar. */
  membershipDiscountPct: number
  discountedServicePrice: number
  selectedProducts: ProductRow[]
  selectedProductIds: Set<string>
  suggestedProducts: ProductRow[]
  tipPresets: readonly number[]
  tipPreset: number
  usingCustomTip: boolean
  tipAmount: number
  grandTotal: number
  payOptions: PayOption[]
  payAmountToCharge: number
  cardError: string
  stripeReady: boolean
  cancellationHours: number | null | undefined
  canBookHere: boolean
  isAuthenticated: boolean
  saving: boolean
  paymentConfirming: boolean
  slotsPending: boolean
  slotsFailed: boolean
}>()
const emit = defineEmits<{
  'toggle-product': [id: string]
  'pick-tip-preset': [pct: number]
  'card-el': [el: HTMLDivElement | null]
  'receipt-change': [event: Event]
  confirm: []
}>()
const payChoice = defineModel<PayChoice>('payChoice', { required: true })
const customTip = defineModel<string>('customTip', { required: true })
const notes = defineModel<string>('notes', { required: true })
const acceptsNoShowFee = defineModel<boolean>('acceptsNoShowFee', { required: true })
</script>

<template>
  <section aria-labelledby="paso-confirmar">
    <h2 id="paso-confirmar" class="mb-4 text-sm font-black uppercase tracking-widest text-ink">
      4. Confirma tu cita
    </h2>
    <div class="ui-card p-5">
      <dl class="space-y-3 text-sm">
        <div class="flex items-start justify-between gap-4">
          <dt class="text-muted">Servicio</dt>
          <dd class="text-right font-bold text-ink">
            {{ service?.nombre }}
            <span class="block text-xs font-normal text-muted">{{ service?.duracion_min }} min</span>
          </dd>
        </div>
        <div class="flex items-start justify-between gap-4">
          <dt class="text-muted">Barbero</dt>
          <dd class="text-right font-bold text-ink">{{ barber?.user?.name }}</dd>
        </div>
        <div class="flex items-start justify-between gap-4">
          <dt class="text-muted">Cuándo</dt>
          <dd class="text-right font-bold text-ink">{{ bookingPrettyDate(date) }} · {{ time }}</dd>
        </div>
        <div v-if="membershipDiscountPct > 0" class="flex items-start justify-between gap-4 text-xs">
          <dt class="text-success">Descuento por nivel ({{ membershipDiscountPct }}%)</dt>
          <dd class="text-right text-success">-{{ bookingCurrency((service?.precio ?? 0) - discountedServicePrice) }}</dd>
        </div>
        <div v-for="p in selectedProducts" :key="p.id" class="flex items-start justify-between gap-4 text-xs">
          <dt class="text-muted">+ {{ p.nombre }}</dt>
          <dd class="text-right text-ink">{{ bookingCurrency(p.precio_venta) }}</dd>
        </div>
        <div v-if="tipAmount > 0" class="flex items-start justify-between gap-4 text-xs">
          <dt class="text-muted">+ Propina</dt>
          <dd class="text-right text-ink">{{ bookingCurrency(tipAmount) }}</dd>
        </div>
        <div class="flex items-start justify-between gap-4 border-t border-line pt-3">
          <dt class="font-black uppercase tracking-widest text-ink">Total</dt>
          <dd class="text-right text-lg font-black text-gold">{{ bookingCurrency(grandTotal) }}</dd>
        </div>
      </dl>

      <BookingStepsConfirmProducts
        v-if="suggestedProducts.length"
        :products="suggestedProducts"
        :selected-ids="selectedProductIds"
        @toggle="emit('toggle-product', $event)"
      />

      <BookingStepsConfirmTip
        v-if="service"
        v-model:custom-tip="customTip"
        :presets="tipPresets"
        :tip-preset="tipPreset"
        :using-custom-tip="usingCustomTip"
        :tip-amount="tipAmount"
        :barber-name="barber?.user?.name"
        @pick-preset="emit('pick-tip-preset', $event)"
      />

      <BookingStepsConfirmPayment
        v-if="canBookHere"
        v-model:pay-choice="payChoice"
        :options="payOptions"
        :amount-to-charge="payAmountToCharge"
        :card-error="cardError"
        :stripe-ready="stripeReady"
        @card-el="emit('card-el', $event)"
        @receipt-change="emit('receipt-change', $event)"
      />

      <div class="mt-5">
        <label for="booking-notes" class="mb-1 block text-xs font-bold text-ink">Notas para tu cita (opcional)</label>
        <textarea id="booking-notes" v-model="notes" class="ui-input w-full" rows="2" maxlength="1000" />
      </div>

      <p v-if="cancellationHours" class="mt-4 border-t border-line pt-4 text-xs leading-5 text-muted">
        Puedes cancelar o reprogramar sin costo hasta
        {{ cancellationHours }} horas antes de tu cita.
      </p>

      <!-- Staff y barberos no pueden reservar para sí mismos en el backend -->
      <div v-if="!canBookHere" class="mt-5 rounded-xl border border-dashed border-line p-4 text-center">
        <p class="text-sm text-muted">
          Tu cuenta es de personal de la barbería. Las citas a nombre de un cliente se agendan desde la agenda del panel.
        </p>
        <NuxtLink to="/appointments" class="ui-btn mt-3 inline-flex px-6 py-2.5">Ir a la agenda</NuxtLink>
      </div>

      <template v-else>
        <label class="mt-5 flex items-start gap-3 rounded-xl border border-line p-3 text-xs leading-5 text-muted">
          <input v-model="acceptsNoShowFee" type="checkbox" class="mt-1 h-4 w-4 shrink-0 accent-[var(--color-gold,#d4af37)]">
          <span>
            Acepto el <strong class="text-ink">cargo por inasistencia</strong>: si no llego a mi cita sin cancelar a tiempo,
            se cobra un porcentaje del servicio a mi tarjeta guardada o queda como adeudo que debo pagar en la
            barbería para volver a reservar.
          </span>
        </label>
        <button
          type="button" class="ui-btn mt-3 w-full py-4 text-[12px] tracking-[0.15em]"
          :disabled="saving || paymentConfirming || slotsPending || slotsFailed || !time || !service || !barber || !acceptsNoShowFee"
          @click="emit('confirm')"
        >
          {{ paymentConfirming ? 'Procesando pago…' : saving ? 'Confirmando…' : isAuthenticated ? 'Confirmar cita' : 'Continuar y confirmar' }}
        </button>
        <p v-if="!isAuthenticated" class="mt-3 text-center text-xs text-muted">
          Te pediremos iniciar sesión o crear tu cuenta solo para guardar esta cita. No perderás lo que elegiste.
        </p>
      </template>
    </div>
  </section>
</template>
