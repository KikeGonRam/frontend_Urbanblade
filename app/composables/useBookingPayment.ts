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

  const payChoice = ref<PayChoice>('despues')

  const cardError = ref('')
  // Carga de Stripe.js, campo de tarjeta y confirmación: useStripeCard (compartido).
  const card = useStripeCard({
    onChangeError: (message) => { cardError.value = message },
    // El iframe de Stripe es de otro origen: no puede heredar el color del tema
    // ("inherit" lo dejaba oscuro sobre fondo oscuro), asi que se le pasa el
    // color ya calculado del contenedor.
    style: (container) => ({
      base: { fontFamily: 'Figtree, sans-serif', fontSize: '15px', color: container ? getComputedStyle(container).color : '#ffffff', '::placeholder': { color: '#8a8a8a' } },
      invalid: { color: '#f87171' },
    }),
  })
  function setCardElement(el: HTMLDivElement | null) {
    card.cardElementRef.value = el
  }
  const stripeConfigured = card.stripeConfigured
  // Mismos tres valores de siempre (el backend no cambia); solo se presentan como tarjetas.
  const payOptions = computed<PayOption[]>(() => [
    { value: 'despues', title: 'Pagar en el salón', detail: 'Efectivo, tarjeta o transferencia el día de tu cita', icon: 'salon' },
    ...(stripeConfigured
      ? [{ value: 'ahora_tarjeta' as const, title: 'Pagar ahora con tarjeta', detail: 'Se cobra al instante de forma segura', icon: 'tarjeta' as const }]
      : []),
    { value: 'ahora_transferencia', title: 'Pagar ahora por transferencia', detail: 'Sube tu comprobante para confirmar', icon: 'transferencia' },
  ])
  // true cuando el formulario de tarjeta ya está montado (lo observa el template).
  const stripeReady = card.cardReady

  function teardownStripe() {
    card.unmountCard()
    cardError.value = ''
  }
  watch(payChoice, async (choice) => {
    if (choice === 'ahora_tarjeta') await nextTick().then(card.mountCard)
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

  const isCardReady = card.isCardReady

  async function chargeBookingPayment(code: string) {
    paymentConfirming.value = true
    paymentWarning.value = ''
    try {
      if (payChoice.value === 'ahora_tarjeta') {
        if (!card.isCardReady()) throw new Error('Stripe no está listo.')
        const intentRes = await apiFetch<{ data: { client_secret: string } }>(
          `/appointments/${code}/deposit/stripe-intent`,
          { method: 'POST' },
        )
        const result = await card.confirmCardPayment(intentRes.data.client_secret)
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
