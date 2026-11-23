import {
  loadStripe,
  type PaymentIntentResult,
  type Stripe,
  type StripeCardElement,
  type StripeCardElementOptions,
  type StripeElements,
} from '@stripe/stripe-js/pure'

/*
 * Campo de tarjeta de Stripe Elements compartido (nov-2026). Antes cada pantalla
 * de pago (cobro en caja, Mis Citas, gift cards, membresía, paquetes y el pago
 * al reservar) repetía la carga de Stripe.js, la creación del elemento «card»,
 * su montaje/desmontaje y la confirmación del PaymentIntent. Aquí vive una sola
 * vez; cada pantalla conserva su propio endpoint, cuerpo y manejo del resultado.
 *
 * - Sin NUXT_PUBLIC_STRIPE_KEY (nuxt.config.ts) `stripeConfigured` es false y
 *   `mountCard()` no hace nada, igual que antes en cada pantalla.
 * - `stripe` y el elemento son variables normales a propósito: no se meten en un
 *   Proxy de Vue. `cardReady` es lo que el template puede observar.
 */

type CardStyle = StripeCardElementOptions['style']

const DEFAULT_STYLE: CardStyle = {
  base: { fontFamily: 'Figtree, sans-serif', fontSize: '15px' },
  invalid: { color: '#f87171' },
}

export interface StripeCardOptions {
  /** Mensaje de validación del campo (vacío cuando vuelve a ser válido). */
  onChangeError?: (message: string) => void
  /** Estilo del iframe; recibe el contenedor por si hay que leer su color calculado. */
  style?: (container: HTMLDivElement | null) => CardStyle
}

export function useStripeCard(options: StripeCardOptions = {}) {
  const config = useRuntimeConfig()
  const stripeConfigured = Boolean(config.public.stripeKey)

  let stripe: Stripe | null = null
  let elements: StripeElements | null = null
  let cardElement: StripeCardElement | null = null
  const cardElementRef = ref<HTMLDivElement | null>(null)
  const cardReady = ref(false)

  /** Carga Stripe.js (una vez) y monta el campo en `cardElementRef`. */
  async function mountCard() {
    if (!stripeConfigured || cardElement) return

    stripe = await loadStripe(config.public.stripeKey as string)
    if (!stripe) return

    elements = stripe.elements()
    cardElement = elements.create('card', {
      style: options.style ? options.style(cardElementRef.value) : DEFAULT_STYLE,
    })
    await nextTick()
    if (cardElementRef.value) cardElement.mount(cardElementRef.value)
    cardElement.on('change', ({ error }) => {
      options.onChangeError?.(error?.message ?? '')
    })
    cardReady.value = true
  }

  function unmountCard() {
    cardElement?.unmount()
    cardElement = null
    elements = null
    cardReady.value = false
  }

  function isCardReady() {
    return Boolean(stripe && cardElement)
  }

  /** Confirma el PaymentIntent (client_secret del backend) con la tarjeta montada. */
  function confirmCardPayment(clientSecret: string): Promise<PaymentIntentResult> {
    if (!stripe || !cardElement) throw new Error('Stripe no está listo.')

    return stripe.confirmCardPayment(clientSecret, {
      payment_method: { card: cardElement },
    })
  }

  onUnmounted(() => unmountCard())

  return { stripeConfigured, cardElementRef, cardReady, mountCard, unmountCard, isCardReady, confirmCardPayment }
}
