<script setup lang="ts">
import { BOOKING_STEPS } from '~/composables/useBookingWizard'
import { BOOKING_TIP_PRESETS } from '~/composables/useBookingPricing'

const props = withDefaults(defineProps<{ initialBarber?: string, embedded?: boolean }>(), { initialBarber: '', embedded: false })
const emit = defineEmits<{ confirmed: [code: string], busy: [value: boolean] }>()

const { isAuthenticated, user, fetchMe } = useAuth()

// /reservar es pública y no pasa por el middleware 'auth', así que nadie
// carga el usuario: con la cookie puesta pero user en null, hasRole() da
// false para TODO y el cliente legítimo veía "tu cuenta es de personal de la
// barbería" sin poder confirmar. Mismo patrón que equipo/[slug].vue.
if (isAuthenticated.value && !user.value) {
  await fetchMe()
}

// Máquina de pasos, catálogos, disponibilidad, totales y pago viven en composables
// (useBookingWizard y los que compone); este componente solo cablea la plantilla.
const wizard = useBookingWizard({
  initialBarber: props.initialBarber,
  onBusy: value => emit('busy', value),
  onConfirmed: code => emit('confirmed', code),
})
await wizard.ready

const {
  catalog, availability, pricing, payment,
  date, time, notes, step,
  selectedService, selectedBarber, canBookHere,
  saving, submitError, submitErrorEl, confirmedCode, productsWarning, acceptsNoShowFee,
  pickService, pickBarber, pickDate, pickTime, goToStep, confirm,
} = wizard
const { shop, services, servicesPending, servicesError, barbersPending, barbersError, orderedBarbers, suggestedProducts, favoriteSaving, toggleFavorite } = catalog
const { days, slots, slotsPending, slotsFailed, groupedSlots, joiningWaitlist, waitlistJoined, waitlistError, joinWaitlist } = availability
const {
  selectedProducts, selectedProductIds, toggleProduct, membershipDiscountPct, discountedServicePrice,
  tipPreset, customTip, usingCustomTip, tipAmount, pickTipPreset, grandTotal, payAmountToCharge,
} = pricing
const {
  payChoice, payOptions, cardError, stripeReady, setCardElement, onTransferFileChange,
  paymentWarning, paymentConfirming,
} = payment
</script>

<template>
  <div class="mx-auto w-full" :class="embedded ? 'max-w-4xl p-1' : 'max-w-4xl px-4 py-8 sm:px-6 sm:py-12 lg:max-w-6xl'">
    <!-- Confirmación -->
    <BookingConfirmed
      v-if="confirmedCode"
      :code="confirmedCode"
      :service-name="selectedService?.nombre"
      :barber-name="selectedBarber?.user?.name"
      :date="date"
      :time="time"
      :products-warning="productsWarning"
      :payment-warning="paymentWarning"
      :pay-choice="payChoice"
      :cancellation-hours="shop?.politica_cancelacion"
    />

    <template v-else>
      <header :class="embedded ? 'mb-5' : 'mb-8'">
        <p class="text-xs font-black uppercase tracking-[0.2em] text-gold">
          {{ shop?.nombre || 'UrbanBlade' }}
        </p>
        <h1 v-if="!embedded" class="mt-2 text-3xl font-black uppercase tracking-tight text-ink">
          Reserva tu cita
        </h1>
        <p v-if="shop?.direccion || shop?.horario_apertura" :class="embedded ? 'mt-1 text-sm text-muted' : 'mt-2 text-sm text-muted'">
          <span v-if="shop?.direccion">{{ shop.direccion }}</span>
          <span v-if="shop?.direccion && shop?.horario_apertura" aria-hidden="true"> · </span>
          <span v-if="shop?.horario_apertura && shop?.horario_cierre">
            {{ shop.horario_apertura }} a {{ shop.horario_cierre }}
          </span>
        </p>
      </header>

      <!-- El error del backend vive FUERA de los pasos a propósito: cuando el
           422 es por horario ocupado se limpia la hora y el asistente vuelve
           al paso 3, así que un mensaje dentro del paso 4 se desmontaba junto
           con él y el visitante volvía al selector sin saber por qué. -->
      <p
        v-if="submitError"
        ref="submitErrorEl"
        role="alert"
        class="mb-6 rounded-xl border border-danger/30 bg-danger/10 p-4 text-sm font-bold text-danger"
      >
        {{ submitError }}
      </p>

      <BookingProgress
        :steps="BOOKING_STEPS"
        :step="step"
        :saving="saving"
        :has-service="!!selectedService"
        :has-barber="!!selectedBarber"
        :has-schedule="!!(date && time)"
        @go="goToStep"
      />

      <BookingSummaryInline
        v-if="selectedService"
        :service="selectedService"
        :barber="selectedBarber"
        :date="date"
        :time="time"
        :embedded="embedded"
      />

      <!-- En escritorio: pasos a la izquierda y resumen fijo a la derecha, visible desde el primer paso. -->
      <div :class="embedded ? '' : 'lg:grid lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start lg:gap-8'">
        <div class="min-w-0">
          <BookingStepsService
            v-if="step === 0"
            :services="services"
            :pending="servicesPending"
            :failed="!!servicesError"
            @pick="pickService"
          />

          <BookingStepsBarber
            v-if="step === 1"
            :barbers="orderedBarbers"
            :pending="barbersPending"
            :failed="!!barbersError"
            :is-authenticated="isAuthenticated"
            :favorite-saving="favoriteSaving"
            @pick="pickBarber"
            @favorite="toggleFavorite"
          />

          <BookingStepsSchedule
            v-if="step === 2"
            :days="days"
            :date="date"
            :time="time"
            :slots="slots"
            :grouped-slots="groupedSlots"
            :slots-pending="slotsPending"
            :slots-failed="slotsFailed"
            :can-book-here="canBookHere"
            :joining-waitlist="joiningWaitlist"
            :waitlist-joined="waitlistJoined"
            :waitlist-error="waitlistError"
            @pick-date="pickDate"
            @pick-time="pickTime"
            @join-waitlist="joinWaitlist"
          />

          <BookingStepsConfirm
            v-if="step === 3"
            v-model:pay-choice="payChoice"
            v-model:custom-tip="customTip"
            v-model:notes="notes"
            v-model:accepts-no-show-fee="acceptsNoShowFee"
            :service="selectedService"
            :barber="selectedBarber"
            :date="date"
            :time="time"
            :membership-discount-pct="membershipDiscountPct"
            :discounted-service-price="discountedServicePrice"
            :selected-products="selectedProducts"
            :selected-product-ids="selectedProductIds"
            :suggested-products="suggestedProducts"
            :tip-presets="BOOKING_TIP_PRESETS"
            :tip-preset="tipPreset"
            :using-custom-tip="usingCustomTip"
            :tip-amount="tipAmount"
            :grand-total="grandTotal"
            :pay-options="payOptions"
            :pay-amount-to-charge="payAmountToCharge"
            :card-error="cardError"
            :stripe-ready="stripeReady"
            :cancellation-hours="shop?.politica_cancelacion"
            :can-book-here="canBookHere"
            :is-authenticated="isAuthenticated"
            :saving="saving"
            :payment-confirming="paymentConfirming"
            :slots-pending="slotsPending"
            :slots-failed="slotsFailed"
            @toggle-product="toggleProduct"
            @pick-tip-preset="pickTipPreset"
            @card-el="setCardElement"
            @receipt-change="onTransferFileChange"
            @confirm="confirm"
          />
        </div>

        <BookingSummary
          v-if="!embedded"
          :service="selectedService"
          :barber="selectedBarber"
          :date="date"
          :time="time"
          :step="step"
          :grand-total="grandTotal"
        />
      </div>
    </template>
  </div>
</template>
