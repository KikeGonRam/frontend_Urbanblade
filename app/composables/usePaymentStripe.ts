import type { ChargeableAppointment, ChargeForm } from "~/types/payments";

/*
 * Pago con tarjeta (beta) vía Stripe Elements dentro del cobro. El monto lo
 * calcula el backend en stripe-intent; aquí solo se confirma el intento y,
 * si sale bien, se delega en `submit` el registro del cobro. La carga de
 * Stripe.js y el campo de tarjeta salen de useStripeCard (compartido).
 */
export function usePaymentStripe(
  form: ChargeForm,
  selected: Ref<ChargeableAppointment | null>,
  submit: () => Promise<void>,
) {
  const { apiFetch } = useApi();
  const stripeErrors = ref("");
  const stripeProcessing = ref(false);
  const card = useStripeCard({
    onChangeError: (message) => {
      stripeErrors.value = message;
    },
  });
  const stripeConfigured = card.stripeConfigured;

  function teardownStripe() {
    card.unmountCard();
    stripeErrors.value = "";
  }

  watch(
    () => form.metodo,
    (m) => {
      if (m === "tarjeta") void card.mountCard();
    },
  );

  async function payWithCard() {
    if (!selected.value || !card.isCardReady()) return;

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

      const result = await card.confirmCardPayment(
        intentRes.data.client_secret,
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
    cardElementRef: card.cardElementRef,
    stripeErrors,
    stripeProcessing,
    stripeConfigured,
    teardownStripe,
    payWithCard,
  };
}
