import { loadStripe, type Stripe, type StripeCardElement, type StripeElements } from '@stripe/stripe-js/pure'
import type { ComputedRef, Ref } from 'vue'
import type { PayChoice, PayOption } from '~/types/booking'

export interface BookingPayment {
  payChoice: Ref<PayChoice>
  payOptions: ComputedRef<PayOption[]>
  cardError: Ref<string>
  stripeReady: Ref<boolean>
  /** Recibe el contenedor del campo de tarjeta (lo monta el paso de confirmar). */
  setCardElement: (el: HTMLDivElement | null) => void
  transferReceipt: Ref<File | null>
  onTransferFileChange: (e: Event) => void
  paymentWarning: Ref<string>
  paymentConfirming: Ref<boolean>
  /** true cuando el formulario de tarjeta de Stripe ya está montado. */
  isCardReady: () => boolean
  chargeBookingPayment: (code: string) => Promise<void>
}

/**
 * "Pagar ahora" vs "pagar después" (Fase 7). "Pagar ahora" reutiliza el mecanismo de deposito
 * anti-no-show tal cual (mismo backend, mismo webhook de Stripe) pero por el monto completo -- ver
 * AppointmentController::store() en barber. Default 'despues' para no forzar el cambio de
 * comportamiento a nadie que solo quiera reservar.
 */
export function useBookingPayment(): BookingPayment {
  const { apiFetch } = useApi()
  const runtimeConfig = useRuntimeConfig()

  const payChoice = ref<PayChoice>('despues')

  let stripe: Stripe | null = null
  let elements: StripeElements | null = null
  let cardElement: StripeCardElement | null = null
  const cardElementRef = ref<HTMLDivElement | null>(null)
  function setCardElement(el: HTMLDivElement | null) {
    cardElementRef.value = el
  }
  const stripeConfigured = Boolean(runtimeConfig.public.stripeKey)
  // Mismos tres valores de siempre (el backend no cambia); solo se presentan como tarjetas.
  const payOptions = computed<PayOption[]>(() => [
    { value: 'despues', title: 'Pagar en el salón', detail: 'Efectivo, tarjeta o transferencia el día de tu cita', icon: 'salon' },
    ...(stripeConfigured
      ? [{ value: 'ahora_tarjeta' as const, title: 'Pagar ahora con tarjeta', detail: 'Se cobra al instante de forma segura', icon: 'tarjeta' as const }]
      : []),
    { value: 'ahora_transferencia', title: 'Pagar ahora por transferencia', detail: 'Sube tu comprobante para confirmar', icon: 'transferencia' },
  ])
  const cardError = ref('')
  // `stripe` es una variable normal (no reactiva) a proposito, para no meter
  // el objeto Stripe en un Proxy de Vue; este ref es lo que el template observa.
  const stripeReady = ref(false)

  async function ensureStripeMounted() {
    if (!stripeConfigured || cardElement) return
    stripe = await loadStripe(runtimeConfig.public.stripeKey as string)
    if (!stripe) return
    elements = stripe.elements()
    // El iframe de Stripe es de otro origen: no puede heredar el color del tema
    // ("inherit" lo dejaba oscuro sobre fondo oscuro), asi que se le pasa el
    // color ya calculado del contenedor.
    const textColor = cardElementRef.value ? getComputedStyle(cardElementRef.value).color : '#ffffff'
    cardElement = elements.create('card', {
      style: { base: { fontFamily: 'Figtree, sans-serif', fontSize: '15px', color: textColor, '::placeholder': { color: '#8a8a8a' } }, invalid: { color: '#f87171' } },
    })
    if (cardElementRef.value) cardElement.mount(cardElementRef.value)
    cardElement.on('change', ({ error: elError }) => { cardError.value = elError?.message ?? '' })
    stripeReady.value = true
  }
  function teardownStripe() {
    cardElement?.unmount()
    cardElement = null
    elements = null
    cardError.value = ''
    stripeReady.value = false
  }
  watch(payChoice, async (choice) => {
    if (choice === 'ahora_tarjeta') await nextTick().then(ensureStripeMounted)
    else teardownStripe()
  })
  onUnmounted(() => teardownStripe())

  // Transferencia: el cliente sube su comprobante DESPUES de que la cita ya
  // existe (mismo flujo que el deposito anti-no-show) -- se guarda el archivo
  // aqui y se sube en confirm(), una vez se tiene el codigo de la cita.
  const transferReceipt = ref<File | null>(null)
  function onTransferFileChange(e: Event) {
    const input = e.target as HTMLInputElement
    transferReceipt.value = input.files?.[0] ?? null
  }

  const paymentWarning = ref('')
  const paymentConfirming = ref(false)

  function isCardReady() {
    return Boolean(stripe && cardElement)
  }

  async function chargeBookingPayment(code: string) {
    paymentConfirming.value = true
    paymentWarning.value = ''
    try {
      if (payChoice.value === 'ahora_tarjeta') {
        if (!stripe || !cardElement) throw new Error('Stripe no está listo.')
        const intentRes = await apiFetch<{ data: { client_secret: string } }>(
          `/appointments/${code}/deposit/stripe-intent`,
          { method: 'POST' },
        )
        const result = await stripe.confirmCardPayment(intentRes.data.client_secret, {
          payment_method: { card: cardElement },
        })
        if (result.error) throw new Error(result.error.message ?? 'Error al procesar el pago.')
      }
      else if (payChoice.value === 'ahora_transferencia' && transferReceipt.value) {
        const form = new FormData()
        form.append('comprobante', transferReceipt.value)
        await apiFetch(`/appointments/${code}/deposit/receipt`, { method: 'POST', body: form })
      }
    }
    catch (err: unknown) {
      // La cita ya esta reservada -- un fallo aqui NUNCA la cancela, solo se
      // avisa para que el cliente pague despues (tarjeta de nuevo o en el salon).
      paymentWarning.value = (err as { message?: string, data?: { message?: string } })?.data?.message
        ?? (err as Error)?.message
        ?? 'No se pudo procesar el pago. Podrás pagar en el salón.'
    }
    finally {
      paymentConfirming.value = false
    }
  }

  return {
    payChoice,
    payOptions,
    cardError,
    stripeReady,
    setCardElement,
    transferReceipt,
    onTransferFileChange,
    paymentWarning,
    paymentConfirming,
    isCardReady,
    chargeBookingPayment,
  }
}
