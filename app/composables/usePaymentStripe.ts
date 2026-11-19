import {
  loadStripe,
  type Stripe,
  type StripeCardElement,
  type StripeElements,
} from "@stripe/stripe-js/pure";
import type { ChargeableAppointment, ChargeForm } from "~/types/payments";

/*
 * Pago con tarjeta (beta) vía Stripe Elements dentro del cobro. El monto lo
 * calcula el backend en stripe-intent; aquí solo se confirma el intento y,
 * si sale bien, se delega en `submit` el registro del cobro.
 */
export function usePaymentStripe(
  form: ChargeForm,
  selected: Ref<ChargeableAppointment | null>,
  submit: () => Promise<void>,
) {
  const { apiFetch } = useApi();
  const config = useRuntimeConfig();

  let stripe: Stripe | null = null;
  let elements: StripeElements | null = null;
  let cardElement: StripeCardElement | null = null;
  const cardElementRef = ref<HTMLDivElement | null>(null);
  const stripeErrors = ref("");
  const stripeProcessing = ref(false);
  const stripeConfigured = Boolean(config.public.stripeKey);

  async function ensureStripeMounted() {
    if (!stripeConfigured || cardElement) return;

    stripe = await loadStripe(config.public.stripeKey);
    if (!stripe) return;

    elements = stripe.elements();
    cardElement = elements.create("card", {
      style: {
        base: { fontFamily: "Figtree, sans-serif", fontSize: "15px" },
        invalid: { color: "#f87171" },
      },
    });
    await nextTick();
    if (cardElementRef.value) cardElement.mount(cardElementRef.value);
    cardElement.on("change", ({ error: elError }) => {
      stripeErrors.value = elError?.message ?? "";
    });
  }

  function teardownStripe() {
    cardElement?.unmount();
    cardElement = null;
    elements = null;
    stripeErrors.value = "";
  }

  watch(
    () => form.metodo,
    (m) => {
      if (m === "tarjeta") void ensureStripeMounted();
    },
  );

  async function payWithCard() {
    if (!selected.value || !stripe || !cardElement) return;

    stripeProcessing.value = true;
    stripeErrors.value = "";
    try {
      const intentRes = await apiFetch<{ data: { client_secret: string } }>(
        "/payments/stripe-intent",
        {
          method: "POST",
          body: {
            appointment_id: selected.value.id,
            puntos_canjeados: form.puntosCanjear || 0,
            codigo_gift_card: form.codigoGiftCard.trim() || undefined,
          },
        },
      );

      const result = await stripe.confirmCardPayment(
        intentRes.data.client_secret,
        {
          payment_method: { card: cardElement },
        },
      );

      if (result.error) {
        stripeErrors.value = result.error.message ?? "Error al procesar el pago.";

        return;
      }

      if (result.paymentIntent?.status === "succeeded") {
        form.stripePaymentId = result.paymentIntent.id;
        await submit();
      }
    } catch (err: unknown) {
      stripeErrors.value =
        (err as { data?: { message?: string } })?.data?.message ??
        "No se pudo conectar con Stripe.";
    } finally {
      stripeProcessing.value = false;
    }
  }

  onUnmounted(() => teardownStripe());

  return {
    cardElementRef,
    stripeErrors,
    stripeProcessing,
    stripeConfigured,
    teardownStripe,
    payWithCard,
  };
}
