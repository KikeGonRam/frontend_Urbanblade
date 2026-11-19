import { computeLoyaltyCharge } from "~/utils/loyaltyCharge";
import type { ChoiceOption } from "~/types/choice";
import type {
  ChargeableAppointment,
  ChargeForm,
  PaymentMethod,
  ProductoSugerido,
} from "~/types/payments";

/*
 * Flujo "Nuevo Cobro". El monto que se cobra NUNCA se calcula aquí para
 * enviarlo: el preview de descuento (computeLoyaltyCharge, puerto de
 * loyalty-charge.js) es solo para que el staff vea el desglose antes de
 * cobrar — el campo "monto" que se manda es el precio base de la cita, y
 * PaymentService::create() en barber vuelve a calcular todo del lado
 * servidor (ver guardrail #13 de ese repo).
 */
export const TIP_PRESETS = [0, 10, 15, 20];

export function initialsOf(name: string | null | undefined) {
  return (
    (name ?? "")
      .trim()
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase() || "—"
  );
}

export function usePaymentCharge(refresh: () => Promise<unknown>) {
  const { apiFetch } = useApi();

  const showCharge = ref(false);
  const chargeableAppointments = ref<ChargeableAppointment[]>([]);
  const loadingChargeable = ref(false);

  const form = reactive<ChargeForm>({
    appointmentId: "",
    propina: 0,
    puntosCanjear: 0,
    usarPremioRifa: false,
    usarPaquete: false,
    codigoGiftCard: "",
    metodo: "efectivo",
    stripePaymentId: "",
  });
  const chargeError = ref("");
  const saving = ref(false);

  // ── Sugerencias de productos al cobrar ──────────────────────────────────
  const sugerencias = ref<ProductoSugerido[]>([]);
  const productosAgregados = ref<string[]>([]);
  const ocultarSugerencias = ref(false);

  const selected = computed(
    () =>
      chargeableAppointments.value.find((a) => a.id === form.appointmentId) ??
      null,
  );

  const preview = computed(() =>
    computeLoyaltyCharge({
      monto: selected.value?.precio ?? 0,
      nivelPct: selected.value?.nivel_pct ?? 0,
      puntosDisponibles: selected.value?.puntos_disponibles ?? 0,
      puntosCanjear: form.puntosCanjear,
      propina: form.propina,
      // El paquete cubre el 100% igual que el premio de rifa -- se reusa el
      // mismo "apagador" del util compartido en vez de duplicar la lógica de
      // ponerlo en $0 aquí.
      usarPremioRifa: form.usarPremioRifa || form.usarPaquete,
    }),
  );

  const productosVendidos = computed(() =>
    form.metodo === "tarjeta"
      ? []
      : sugerencias.value.filter((p) => productosAgregados.value.includes(p.id)),
  );
  const productosTotal = computed(() =>
    productosVendidos.value.reduce((sum, p) => sum + Number(p.precio_venta), 0),
  );
  const totalConProductos = computed(
    () => preview.value.total + productosTotal.value,
  );

  function toggleProducto(id: string) {
    productosAgregados.value = productosAgregados.value.includes(id)
      ? productosAgregados.value.filter((x) => x !== id)
      : [...productosAgregados.value, id];
  }

  async function cargarSugerencias() {
    try {
      const res = await apiFetch<{ data: ProductoSugerido[] }>("/products");
      sugerencias.value = (res.data ?? [])
        .filter((p) => p.stock_actual > 0)
        .slice(0, 3);
    } catch {
      // Es una ayuda opcional: sin catálogo el cobro sigue igual.
      sugerencias.value = [];
    }
  }

  const tipFor = (pct: number) =>
    Math.round((selected.value?.precio ?? 0) * pct) / 100;

  function selectAppointment() {
    form.puntosCanjear = 0;
    form.usarPremioRifa = false;
    form.usarPaquete = false;
    form.codigoGiftCard = "";
    if (form.metodo === "tarjeta" && (selected.value?.premio_rifa || selected.value?.paquete_disponible))
      form.metodo = "efectivo";
  }

  watch(
    () => form.usarPremioRifa,
    (usar) => {
      if (usar) {
        form.puntosCanjear = 0;
        form.usarPaquete = false;
        form.codigoGiftCard = "";
        if (form.metodo === "tarjeta") form.metodo = "efectivo";
      }
    },
  );

  watch(
    () => form.usarPaquete,
    (usar) => {
      if (usar) {
        form.puntosCanjear = 0;
        form.usarPremioRifa = false;
        form.codigoGiftCard = "";
        if (form.metodo === "tarjeta") form.metodo = "efectivo";
      }
    },
  );

  watch(
    () => form.metodo,
    (m) => {
      // El paquete sigue sin combinarse con tarjeta (cubre el 100%, dejaría $0
      // a cobrar); la gift card sí se conserva -- se manda en el stripe-intent.
      if (m === "tarjeta") form.usarPaquete = false;
    },
  );

  // submitCharge se declara después; el cierre lo resuelve en el momento de uso.
  const stripe = usePaymentStripe(form, selected, () => submitCharge());

  // Mismos valores de metodo_pago de siempre; la tarjeta no aplica con paquete ni premio de rifa.
  const metodoOptions = computed<ChoiceOption<PaymentMethod>[]>(() => [
    { value: "efectivo", title: "Efectivo", detail: "Se suma al arqueo de caja", icon: "efectivo" },
    { value: "transferencia", title: "Transferencia", detail: "Confirma que llegó el depósito", icon: "transferencia" },
    ...(stripe.stripeConfigured && !form.usarPremioRifa && !form.usarPaquete
      ? [{ value: "tarjeta" as const, title: "Tarjeta", detail: "Cobro real con Stripe (beta)", icon: "tarjeta" as const }]
      : []),
  ]);

  async function openCharge(preselectId = "") {
    form.appointmentId = "";
    form.propina = 0;
    form.puntosCanjear = 0;
    form.usarPremioRifa = false;
    form.usarPaquete = false;
    form.codigoGiftCard = "";
    form.metodo = "efectivo";
    form.stripePaymentId = "";
    chargeError.value = "";
    stripe.stripeErrors.value = "";
    productosAgregados.value = [];
    ocultarSugerencias.value = false;
    showCharge.value = true;

    loadingChargeable.value = true;
    try {
      const res = await apiFetch<{ data: ChargeableAppointment[] }>(
        "/appointments/chargeable",
      );
      chargeableAppointments.value = res.data;

      // Deep link "Cobrar" desde la agenda (/payments?cita=<id>): solo
      // preselecciona si la cita sigue siendo cobrable según el backend; si no
      // aparece en la lista, el selector queda vacío en vez de fingir un dato.
      if (preselectId && res.data.some((a) => a.id === preselectId)) {
        form.appointmentId = preselectId;
        selectAppointment();
      }
    } catch {
      chargeableAppointments.value = [];
    } finally {
      loadingChargeable.value = false;
    }

    await cargarSugerencias();
  }

  /*
   * Entrada desde la agenda: /payments?cita=<id> abre el modal de cobro con esa
   * cita ya elegida. Antes había que abrir "Cobrar" y buscarla a mano en el
   * selector, aunque se viniera de su propia fila.
   */
  const route = useRoute();
  onMounted(() => {
    const cita = typeof route.query.cita === "string" ? route.query.cita : "";
    if (cita) openCharge(cita);
  });

  async function submitCharge() {
    if (!selected.value) return;

    saving.value = true;
    chargeError.value = "";
    try {
      await apiFetch("/payments", {
        method: "POST",
        body: {
          appointment_id: selected.value.id,
          monto: selected.value.precio,
          metodo_pago: form.metodo,
          propina: form.propina || 0,
          puntos_canjeados: form.puntosCanjear || 0,
          usar_premio_rifa: form.usarPremioRifa,
          usar_paquete_id: form.usarPaquete ? selected.value.paquete_disponible?.id : undefined,
          codigo_gift_card: form.codigoGiftCard.trim() || undefined,
          stripe_payment_id: form.stripePaymentId || undefined,
          productos: productosVendidos.value.length
            ? productosVendidos.value.map((p) => ({
                product_id: p.id,
                cantidad: 1,
              }))
            : undefined,
        },
      });
      showCharge.value = false;
      stripe.teardownStripe();
      await refresh();
    } catch (err: unknown) {
      chargeError.value =
        (err as { data?: { message?: string } })?.data?.message ??
        "No se pudo registrar el cobro.";
    } finally {
      saving.value = false;
    }
  }

  function closeCharge() {
    showCharge.value = false;
    stripe.teardownStripe();
  }

  return {
    showCharge,
    chargeableAppointments,
    loadingChargeable,
    form,
    chargeError,
    saving,
    selected,
    preview,
    sugerencias,
    productosAgregados,
    ocultarSugerencias,
    productosVendidos,
    productosTotal,
    totalConProductos,
    metodoOptions,
    cardElementRef: stripe.cardElementRef,
    stripeErrors: stripe.stripeErrors,
    stripeProcessing: stripe.stripeProcessing,
    tipFor,
    toggleProducto,
    selectAppointment,
    openCharge,
    submitCharge,
    closeCharge,
    payWithCard: stripe.payWithCard,
  };
}
