<script setup lang="ts">
/*
 * Fase 9.3 del plan (ver .claude/skills/nuxt-migration-plan/SKILL.md) —
 * como 9.1/9.2, payments/index.blade.php en barber sigue siendo Blade
 * puro, así que esta página se construye directo desde el contrato de
 * Api/Payment/PaymentController, enriquecido en esta misma fase con
 * filtros (q/barbero_id/fecha_desde/fecha_hasta) + stats/pending_count en
 * meta, y el nuevo GET /appointments/chargeable para el selector de
 * "Nuevo Cobro".
 *
 * El monto que se cobra NUNCA se calcula aquí para enviarlo: el preview de
 * descuento (computeLoyaltyCharge, puerto de loyalty-charge.js) es solo
 * para que el staff vea el desglose antes de cobrar — el campo "monto" que
 * se manda es el precio base de la cita (igual que el input readonly del
 * Blade original), y PaymentService::create() en barber vuelve a calcular
 * todo del lado servidor (ver guardrail #13 de ese repo).
 */
import {
    loadStripe,
    type Stripe,
    type StripeCardElement,
    type StripeElements,
} from "@stripe/stripe-js";
import { computeLoyaltyCharge } from "~/utils/loyaltyCharge";

definePageMeta({ middleware: ["auth", "staff"], layout: "dashboard" });

const METODO_LABEL: Record<string, string> = {
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
  transferencia: "Transferencia",
  otro: "Otro",
};

interface PaymentRow {
  id: string;
  // Payment::$monto/$propina usan el cast decimal:2 de Laravel, que
  // siempre serializa como string ("225.00") para no perder precisión —
  // nunca sumar/restar directo sin Number(), "225.00" + "0.00" concatena.
  monto: string;
  metodo_pago: string;
  propina: string;
  receipt_url: string | null;
  created_at: string | null;
  appointment: {
    id: string | null;
    fecha: string | null;
    hora_inicio: string | null;
    service: string | null;
    client: string | null;
    barber: string | null;
  };
  creator: { id: string | null; name: string | null };
}

interface PaymentsResponse {
  data: PaymentRow[];
  meta: {
    current_page: number;
    last_page: number;
    total: number;
    stats: {
      total_hoy: number;
      total_mes: number;
      count: number;
      metodos: Record<string, number>;
    };
    pending_count: number;
  };
}

interface ChargeableAppointment {
  id: string;
  code: string | null;
  fecha: string;
  hora_inicio: string;
  client_name: string | null;
  barber_name: string | null;
  service_name: string | null;
  precio: number;
  nivel: string;
  nivel_label: string;
  nivel_pct: number;
  puntos_disponibles: number;
  premio_rifa: string | null;
}

interface Barber {
  id: string;
  name: string;
}

const { apiFetch } = useApi();
const { confirm } = useConfirm();
const config = useRuntimeConfig();

// ── Historial + filtros ──────────────────────────────────────────────────
const search = ref("");
const debouncedSearch = useDebounce(search, 350);
const actionError = ref("");
const metodoFilter = ref("");
const barberoFilter = ref("");
const fechaDesde = ref("");
const fechaHasta = ref("");

const {
  data: response,
  pending,
  error,
  refresh,
} = await useAsyncData<PaymentsResponse>(
  buildDataKey("payments-list", {
    q: search.value || undefined,
    metodo_pago: metodoFilter.value || undefined,
    barbero_id: barberoFilter.value || undefined,
    fecha_desde: fechaDesde.value || undefined,
    fecha_hasta: fechaHasta.value || undefined,
  }),
  () =>
    apiFetch<PaymentsResponse>("/payments", {
      query: {
        q: search.value || undefined,
        metodo_pago: metodoFilter.value || undefined,
        barbero_id: barberoFilter.value || undefined,
        fecha_desde: fechaDesde.value || undefined,
        fecha_hasta: fechaHasta.value || undefined,
      },
    }),
  {
    watch: [
      debouncedSearch,
      metodoFilter,
      barberoFilter,
      fechaDesde,
      fechaHasta,
    ],
    lazy: true,
  },
);

const payments = computed(() => response.value?.data ?? []);
const stats = computed(() => response.value?.meta.stats);
const pendingCount = computed(() => response.value?.meta.pending_count ?? 0);

function clearFilters() {
  search.value = "";
  metodoFilter.value = "";
  barberoFilter.value = "";
  fechaDesde.value = "";
  fechaHasta.value = "";
}

const { data: barbersRes } = await useAsyncData(
  "payments-barbers",
  () =>
    apiFetch<{ data: Array<{ id: string; user: { name: string } | null }> }>(
      "/barbers",
    ),
  { lazy: true },
);
const barbers = computed<Barber[]>(() =>
  (barbersRes.value?.data ?? []).map((b) => ({
    id: b.id,
    name: b.user?.name ?? "Barbero",
  })),
);

function fmtMoney(n: number | string) {
  return `$${Number(n ?? 0).toFixed(2)}`;
}

function fmtDateTime(iso: string | null) {
  if (!iso) return "—";

  return new Date(iso).toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function viewReceipt(payment: PaymentRow) {
  if (payment.receipt_url) {
    window.open(payment.receipt_url, "_blank");

    return;
  }

  try {
    const res = await apiFetch<{ data: { receipt_url: string } }>(
      `/payments/${payment.id}/receipt`,
    );
    window.open(res.data.receipt_url, "_blank");
  } catch (err: unknown) {
    actionError.value =
      (err as { data?: { message?: string } })?.data?.message ??
      "No se pudo generar el comprobante.";
  }
}

async function removePayment(payment: PaymentRow) {
  const accepted = await confirm({
    title: "Anular comprobante",
    message: `¿Anular el comprobante #${payment.id}?`,
    confirmText: "Sí, anular",
    isDanger: true,
  });
  if (!accepted) return;

  actionError.value = "";
  try {
    await apiFetch(`/payments/${payment.id}`, { method: "DELETE" });
    await refresh();
  } catch (err: unknown) {
    actionError.value =
      (err as { data?: { message?: string } })?.data?.message ??
      "No se pudo anular el comprobante.";
  }
}

// ── Nuevo Cobro ───────────────────────────────────────────────────────────
const showCharge = ref(false);
const chargeableAppointments = ref<ChargeableAppointment[]>([]);
const loadingChargeable = ref(false);

const form = reactive({
  appointmentId: "",
  propina: 0,
  puntosCanjear: 0,
  usarPremioRifa: false,
  // Redimir una gift card solo está resuelto para efectivo/transferencia:
  // el intent de Stripe (stripe-intent) no manda el código en su metadata,
  // así que el webhook no puede aplicarlo -- ver PaymentController::
  // stripeIntent() en barber. El campo se oculta con method === "tarjeta".
  codigoGiftCard: "",
  metodo: "efectivo" as "efectivo" | "transferencia" | "tarjeta",
  stripePaymentId: "",
});
const chargeError = ref("");
const saving = ref(false);

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
    usarPremioRifa: form.usarPremioRifa,
  }),
);

async function openCharge(preselectId = "") {
  form.appointmentId = "";
  form.propina = 0;
  form.puntosCanjear = 0;
  form.usarPremioRifa = false;
  form.codigoGiftCard = "";
  form.metodo = "efectivo";
  form.stripePaymentId = "";
  chargeError.value = "";
  stripeErrors.value = "";
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

function selectAppointment() {
  form.puntosCanjear = 0;
  form.usarPremioRifa = false;
  form.codigoGiftCard = "";
  if (form.metodo === "tarjeta" && selected.value?.premio_rifa)
    form.metodo = "efectivo";
}

watch(
  () => form.usarPremioRifa,
  (usar) => {
    if (usar) {
      form.puntosCanjear = 0;
      form.codigoGiftCard = "";
      if (form.metodo === "tarjeta") form.metodo = "efectivo";
    }
  },
);

watch(
  () => form.metodo,
  (m) => {
    if (m === "tarjeta") form.codigoGiftCard = "";
  },
);

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
        codigo_gift_card: form.codigoGiftCard.trim() || undefined,
        stripe_payment_id: form.stripePaymentId || undefined,
      },
    });
    showCharge.value = false;
    teardownStripe();
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
  teardownStripe();
}

// ── Stripe (tarjeta, beta) ───────────────────────────────────────────────
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
    if (m === "tarjeta") ensureStripeMounted();
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
      await submitCharge();
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
</script>

<template>
  <div class="p-4 sm:p-6 lg:p-8">
    <header
      class="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div>
        <p class="text-sm uppercase tracking-widest text-muted">UrbanBlade</p>
        <h1 class="mt-1 text-2xl font-semibold text-ink">
          Centro de <span class="text-gold">Facturación</span>
        </h1>
        <p class="mt-1 text-sm text-muted">
          Gestión de ingresos, comprobantes y trazabilidad financiera.
        </p>
      </div>
      <div class="flex items-center gap-3">
        <NuxtLink
          to="/payments/pending"
          class="relative rounded-lg border border-line px-4 py-2 text-sm text-muted hover:text-ink"
        >
          Por Revisar
          <span
            v-if="pendingCount > 0"
            class="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-gold px-1 text-[10px] font-black text-black"
            >{{ pendingCount }}</span
          >
        </NuxtLink>
        <NuxtLink
          to="/payments/corte"
          class="flex items-center rounded-lg border border-line px-4 py-2 text-sm font-semibold text-muted transition-colors hover:border-gold/40 hover:text-gold"
        >
          Corte de caja
        </NuxtLink>
        <button
          type="button"
          class="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-black hover:bg-gold-dim"
          @click="openCharge()"
        >
          + Nuevo Cobro
        </button>
      </div>
    </header>
    <p v-if="actionError" role="alert" class="mb-4 text-sm text-red-400">
      {{ actionError }}
    </p>

    <section v-if="stats" class="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
      <div class="rounded-2xl border border-line bg-card p-4">
        <p
          class="mb-1 text-[10px] font-black uppercase tracking-wider text-muted"
        >
          Facturación Hoy
        </p>
        <p class="text-2xl font-black text-emerald-400">
          {{ fmtMoney(stats.total_hoy) }}
        </p>
      </div>
      <div class="rounded-2xl border border-line bg-card p-4">
        <p
          class="mb-1 text-[10px] font-black uppercase tracking-wider text-muted"
        >
          Este Mes
        </p>
        <p class="text-2xl font-black text-ink">
          {{ fmtMoney(stats.total_mes) }}
        </p>
      </div>
      <div class="rounded-2xl border border-line bg-card p-4">
        <p
          class="mb-1 text-[10px] font-black uppercase tracking-wider text-muted"
        >
          Total Cobros
        </p>
        <p class="text-2xl font-black text-ink">{{ stats.count }}</p>
      </div>
      <div class="rounded-2xl border border-line bg-card p-4">
        <p
          class="mb-2 text-[10px] font-black uppercase tracking-wider text-muted"
        >
          Por Método
        </p>
        <div class="flex flex-wrap gap-1.5">
          <span
            v-for="(cnt, metodo) in stats.metodos"
            :key="metodo"
            class="rounded-full border border-line bg-ink/5 px-2 py-0.5 text-[9px] font-black uppercase text-ink/70"
          >
            {{ metodo }}: {{ cnt }}
          </span>
        </div>
      </div>
    </section>

    <section class="mb-5 flex flex-wrap items-center gap-3">
      <input
        v-model="search"
        type="text"
        placeholder="Cliente o servicio…"
        class="w-full rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink sm:max-w-xs"
      >
      <select
        v-model="metodoFilter"
        class="rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink"
      >
        <option value="">Todos los métodos</option>
        <option v-for="(label, val) in METODO_LABEL" :key="val" :value="val">
          {{ label }}
        </option>
      </select>
      <select
        v-model="barberoFilter"
        class="rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink"
      >
        <option value="">Todos los barberos</option>
        <option v-for="b in barbers" :key="b.id" :value="b.id">
          {{ b.name }}
        </option>
      </select>
      <input
        v-model="fechaDesde"
        type="date"
        class="rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink"
      >
      <input
        v-model="fechaHasta"
        type="date"
        class="rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink"
      >
      <button
        v-if="
          search || metodoFilter || barberoFilter || fechaDesde || fechaHasta
        "
        type="button"
        class="text-xs font-bold uppercase tracking-widest text-muted hover:text-ink"
        @click="clearFilters"
      >
        Limpiar filtros
      </button>
    </section>

    <p v-if="pending" class="text-sm text-muted">Cargando pagos…</p>
    <p v-else-if="error" class="text-sm text-red-400">
      No se pudo cargar el historial de pagos.
    </p>

    <section v-else class="ui-card overflow-x-auto">
      <table class="w-full text-left text-sm">
        <thead>
          <tr
            class="border-b border-line text-[10px] uppercase tracking-wider text-muted"
          >
            <th class="px-4 py-3">Folio / Fecha</th>
            <th class="px-4 py-3">Cliente & Servicio</th>
            <th class="px-4 py-3">Barbero</th>
            <th class="px-4 py-3">Método</th>
            <th class="px-4 py-3 text-right">Total</th>
            <th class="px-4 py-3 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="payment in payments"
            :key="payment.id"
            class="border-b border-line/60 last:border-0"
          >
            <td class="px-4 py-3">
              <div class="flex flex-col">
                <span class="font-black text-ink"
                  >#{{ String(payment.id).padStart(6, "0").slice(-6) }}</span
                >
                <span class="text-[10px] font-bold uppercase text-muted">{{
                  fmtDateTime(payment.created_at)
                }}</span>
              </div>
            </td>
            <td class="px-4 py-3">
              <div class="flex flex-col">
                <span class="font-bold text-ink">{{
                  payment.appointment.client ?? "N/A"
                }}</span>
                <span
                  class="text-[10px] font-black uppercase tracking-widest text-gold"
                  >{{ payment.appointment.service ?? "General" }}</span
                >
              </div>
            </td>
            <td class="px-4 py-3 text-ink/80">
              {{ payment.appointment.barber ?? "—" }}
            </td>
            <td class="px-4 py-3">
              <span
                class="rounded-full border border-line bg-ink/5 px-2 py-0.5 text-[9px] font-black uppercase text-muted"
                >{{
                  METODO_LABEL[payment.metodo_pago] ?? payment.metodo_pago
                }}</span
              >
            </td>
            <td class="px-4 py-3 text-right">
              <div class="flex flex-col items-end">
                <span class="font-black text-emerald-400">{{
                  fmtMoney(Number(payment.monto) + Number(payment.propina))
                }}</span>
                <span
                  v-if="Number(payment.propina) > 0"
                  class="text-[9px] font-bold uppercase text-gold"
                  >+{{ fmtMoney(payment.propina) }} propina</span
                >
              </div>
            </td>
            <td class="px-4 py-3">
              <div class="flex justify-end gap-2">
                <button
                  type="button"
                  class="rounded-lg border border-line px-3 py-1 text-xs text-muted hover:text-gold"
                  @click="viewReceipt(payment)"
                >
                  PDF
                </button>
                <button
                  type="button"
                  class="rounded-lg border border-red-500/20 px-3 py-1 text-xs text-red-400 hover:bg-red-500/10"
                  @click="removePayment(payment)"
                >
                  Anular
                </button>
              </div>
            </td>
          </tr>
          <tr v-if="!payments.length">
            <td colspan="6" class="px-4 py-12 text-center text-sm text-muted">
              Sin comprobantes.
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <!-- Nuevo Cobro -->
    <div
      v-if="showCharge"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      @click.self="closeCharge"
    >
      <div
        class="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-line bg-card p-6"
      >
        <h2 class="mb-4 text-lg font-semibold text-ink">Registro de Cobro</h2>

        <p v-if="loadingChargeable" class="text-sm text-muted">
          Cargando citas por cobrar…
        </p>

        <form v-else class="space-y-4" @submit.prevent="submitCharge">
          <div>
            <label class="mb-1 block text-xs text-muted"
              >Seleccionar cita pendiente de cobro</label
            >
            <select
              v-model="form.appointmentId"
              required
              class="w-full rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink"
              @change="selectAppointment"
            >
              <option value="" disabled>
                Selecciona el servicio a cobrar…
              </option>
              <option
                v-for="a in chargeableAppointments"
                :key="a.id"
                :value="a.id"
              >
                {{ a.fecha }} — {{ a.client_name }} ({{ a.service_name }})
              </option>
            </select>
            <p
              v-if="!chargeableAppointments.length"
              class="mt-2 text-xs text-muted"
            >
              No hay citas cobrables (aprobadas por el barbero y sin pago) en
              este momento.
            </p>
          </div>

          <template v-if="selected">
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="mb-1 block text-xs text-muted"
                  >Monto del servicio</label
                >
                <input
                  :value="fmtMoney(selected.precio)"
                  type="text"
                  readonly
                  class="w-full rounded-lg border border-line bg-ink/5 px-3 py-2 text-sm text-ink/70"
                >
              </div>
              <div>
                <label class="mb-1 block text-xs text-muted">Propina</label>
                <input
                  v-model.number="form.propina"
                  type="number"
                  step="0.01"
                  min="0"
                  class="w-full rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink"
                >
              </div>
            </div>

            <div v-if="form.metodo !== 'tarjeta' && !form.usarPremioRifa">
              <label class="mb-1 block text-xs text-muted"
                >Código de gift card (opcional)</label
              >
              <input
                v-model="form.codigoGiftCard"
                type="text"
                placeholder="Ej. A1B2C3D4"
                class="w-full rounded-lg border border-line bg-main px-3 py-2 text-sm uppercase text-ink"
              >
              <p class="mt-1 text-[9px] italic text-muted">
                Se aplica al total antes de cobrar el resto por
                {{ METODO_LABEL[form.metodo]?.toLowerCase() }}. Si el saldo no
                alcanza, cubre solo una parte.
              </p>
            </div>

            <div
              v-if="selected.premio_rifa"
              class="rounded-xl border border-fuchsia-400/25 bg-fuchsia-400/5 p-4"
            >
              <label class="flex cursor-pointer items-start gap-3">
                <input
                  v-model="form.usarPremioRifa"
                  type="checkbox"
                  class="mt-0.5 h-4 w-4 rounded border-line"
                >
                <span>
                  <span
                    class="block text-[10px] font-black uppercase tracking-widest text-fuchsia-300"
                    >Premio de rifa disponible</span
                  >
                  <span class="mt-0.5 block text-xs text-ink/80">{{
                    selected.premio_rifa
                  }}</span>
                  <span class="mt-1 block text-[9px] italic text-muted"
                    >Aplica el premio como 100% de descuento (no se combina con
                    puntos).</span
                  >
                </span>
              </label>
            </div>

            <div
              v-if="selected.nivel_pct > 0 || selected.puntos_disponibles > 0"
              v-show="!form.usarPremioRifa"
              class="space-y-3 rounded-xl border border-gold/20 bg-ink/3 p-4"
            >
              <p
                class="text-[10px] font-black uppercase tracking-widest text-gold"
              >
                Cliente {{ selected.nivel_label }}
                <span v-if="selected.nivel_pct > 0"
                  >· {{ selected.nivel_pct }}% de descuento</span
                >
              </p>
              <div>
                <label class="mb-1 block text-xs text-muted"
                  >Puntos a canjear (disponibles:
                  {{ selected.puntos_disponibles }}, máximo:
                  {{ preview.maxPuntosCanjeables }})</label
                >
                <input
                  v-model.number="form.puntosCanjear"
                  type="number"
                  step="1"
                  min="0"
                  :max="preview.maxPuntosCanjeables"
                  class="w-full rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink"
                >
                <p class="mt-1 text-[9px] italic text-muted">
                  1 punto = $1 MXN. Tope: 50% del total con descuento de nivel,
                  o el saldo del cliente.
                </p>
              </div>
            </div>

            <div>
              <label class="mb-2 block text-xs text-muted"
                >Método de pago</label
              >
              <div class="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  class="relative rounded-xl border p-3 text-center transition"
                  :class="
                    form.metodo === 'efectivo'
                      ? 'border-gold bg-gold/10 text-gold'
                      : 'border-line bg-ink/5 text-muted'
                  "
                  @click="form.metodo = 'efectivo'"
                >
                  <span class="text-[10px] font-black uppercase tracking-widest"
                    >Efectivo</span
                  >
                </button>
                <button
                  type="button"
                  class="relative rounded-xl border p-3 text-center transition"
                  :class="
                    form.metodo === 'transferencia'
                      ? 'border-gold bg-gold/10 text-gold'
                      : 'border-line bg-ink/5 text-muted'
                  "
                  @click="form.metodo = 'transferencia'"
                >
                  <span class="text-[10px] font-black uppercase tracking-widest"
                    >Transferencia</span
                  >
                </button>
                <button
                  v-if="stripeConfigured && !form.usarPremioRifa"
                  type="button"
                  class="relative rounded-xl border p-3 text-center transition"
                  :class="
                    form.metodo === 'tarjeta'
                      ? 'border-gold bg-gold/10 text-gold'
                      : 'border-line bg-ink/5 text-muted'
                  "
                  @click="form.metodo = 'tarjeta'"
                >
                  <span
                    class="absolute -right-2 -top-2 rounded-full bg-gold px-1.5 py-0.5 text-[7px] font-black uppercase text-black"
                    >Beta</span
                  >
                  <span class="text-[10px] font-black uppercase tracking-widest"
                    >Tarjeta</span
                  >
                </button>
              </div>
            </div>

            <div
              v-show="form.metodo === 'tarjeta'"
              class="space-y-3 rounded-xl border border-gold/20 bg-ink/3 p-4"
            >
              <p
                class="text-[10px] font-black uppercase tracking-widest text-gold"
              >
                Pago con tarjeta (beta) — procesado por Stripe
              </p>
              <div
                ref="cardElementRef"
                class="min-h-[46px] rounded-lg border border-line bg-card p-3"
              />
              <p
                v-if="stripeErrors"
                class="text-[10px] font-black uppercase text-red-500"
              >
                {{ stripeErrors }}
              </p>
              <button
                type="button"
                :disabled="stripeProcessing"
                class="w-full rounded-lg bg-gold py-2.5 text-xs font-black uppercase tracking-widest text-black hover:bg-gold-dim disabled:opacity-50"
                @click="payWithCard"
              >
                {{ stripeProcessing ? "Procesando…" : "Cobrar con tarjeta" }}
              </button>
            </div>

            <div class="rounded-xl border border-gold/30 bg-black/20 p-5">
              <div class="space-y-2 text-sm">
                <div class="flex justify-between">
                  <span class="text-[10px] font-bold uppercase text-muted"
                    >Subtotal</span
                  ><span class="text-ink">{{ fmtMoney(selected.precio) }}</span>
                </div>
                <div v-if="form.usarPremioRifa" class="flex justify-between">
                  <span class="text-[10px] font-bold uppercase text-muted"
                    >Premio de rifa</span
                  ><span class="text-fuchsia-400"
                    >-{{ fmtMoney(selected.precio) }}</span
                  >
                </div>
                <div
                  v-else-if="selected.nivel_pct > 0"
                  class="flex justify-between"
                >
                  <span class="text-[10px] font-bold uppercase text-muted"
                    >Descuento nivel ({{ selected.nivel_pct }}%)</span
                  ><span class="text-green-500"
                    >-{{
                      fmtMoney(selected.precio - preview.montoConNivel)
                    }}</span
                  >
                </div>
                <div
                  v-if="preview.descuentoPuntos > 0"
                  class="flex justify-between"
                >
                  <span class="text-[10px] font-bold uppercase text-muted"
                    >Puntos canjeados</span
                  ><span class="text-green-500"
                    >-{{ fmtMoney(preview.descuentoPuntos) }}</span
                  >
                </div>
                <div class="flex justify-between">
                  <span class="text-[10px] font-bold uppercase text-muted"
                    >Propina</span
                  ><span class="text-gold">{{ fmtMoney(form.propina) }}</span>
                </div>
                <div class="my-2 border-t border-line" />
                <div class="flex justify-between">
                  <span class="text-xs font-black uppercase text-ink"
                    >Total a pagar</span
                  ><span class="text-xl font-black text-gold">{{
                    fmtMoney(preview.total)
                  }}</span>
                </div>
              </div>
            </div>

            <p v-if="chargeError" class="text-sm text-red-400">
              {{ chargeError }}
            </p>

            <div v-show="form.metodo !== 'tarjeta'" class="flex gap-3">
              <button
                type="submit"
                :disabled="saving"
                class="flex-1 rounded-lg bg-gold px-4 py-2.5 text-sm font-semibold text-black hover:bg-gold-dim disabled:opacity-50"
              >
                {{ saving ? "Guardando…" : "Confirmar y Cerrar Servicio" }}
              </button>
              <button
                type="button"
                class="rounded-lg border border-line px-4 py-2.5 text-sm text-muted hover:text-ink"
                @click="closeCharge"
              >
                Cancelar
              </button>
            </div>
          </template>
          <div v-else class="flex justify-end">
            <button
              type="button"
              class="rounded-lg border border-line px-4 py-2.5 text-sm text-muted hover:text-ink"
              @click="closeCharge"
            >
              Cerrar
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
