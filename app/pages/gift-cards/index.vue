<script setup lang="ts">
/*
 * Tarjetas de regalo (roadmap de mercado, ver .claude/skills/urbanblade-
 * market-web/SKILL.md en barber): comprar con tarjeta vía Stripe y
 * consultar el saldo de cualquier código. Abierta a cualquier autenticado
 * -- el backend no exige rol para stripe-intent ni para show(code), una
 * gift card la usa quien tenga el código, igual que una física.
 *
 * El código recién comprado NO llega en la respuesta de Stripe: el
 * webhook crea la GiftCard de forma asíncrona (ver GiftCardController::
 * mine() en barber), así que tras confirmar el pago se reintenta GET
 * gift-cards/mine unas cuantas veces hasta que aparezca -- mismo patrón
 * de "esperar y refrescar" que /my/appointments usa para el autopago.
 */
import {
  loadStripe,
  type Stripe,
  type StripeCardElement,
  type StripeElements,
} from "@stripe/stripe-js";

definePageMeta({ middleware: ["auth"], layout: "dashboard" });

interface MyGiftCard {
  code: string;
  saldo: number;
  monto_inicial: number;
  estado: string;
  comprado_en: string | null;
}

const ESTADO_LABEL: Record<string, string> = {
  activa: "Activa",
  agotada: "Agotada",
  expirada: "Expirada",
  cancelada: "Cancelada",
};
const ESTADO_CLASS: Record<string, string> = {
  activa: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
  agotada: "border-ink/15 bg-ink/5 text-ink/50",
  expirada: "border-amber-500/25 bg-amber-500/10 text-amber-300",
  cancelada: "border-red-500/25 bg-red-500/10 text-red-400",
};

const { apiFetch } = useApi();
const { user, hasRole, fetchMe } = useAuth();
const config = useRuntimeConfig();
const stripeConfigured = Boolean(config.public.stripeKey);
const isClient = computed(() => hasRole("cliente"));

// Si se entra directo a esta URL (no desde /dashboard), el estado
// compartido "auth_user" todavía no existe -- mismo patrón que
// dashboard/index.vue, necesario para que hasRole('cliente') resuelva bien
// antes de decidir si se pide /gift-cards/mine. callOnce (no un simple if)
// evita pedir /auth/me dos veces al hidratar del lado del cliente.
await callOnce("gift-cards-fetch-me", () => (user.value ? null : fetchMe()));

function fmtMoney(n: number) {
  return `$${Number(n ?? 0).toFixed(2)}`;
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";

  return new Date(iso).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ── "Mis tarjetas" (solo cliente) ────────────────────────────────────────
const {
  data: mineResponse,
  refresh: refreshMine,
} = await useAsyncData(
  "gift-cards-mine",
  () =>
    isClient.value
      ? apiFetch<{ data: MyGiftCard[] }>("/gift-cards/mine")
      : Promise.resolve({ data: [] }),
  { lazy: true },
);
const myGiftCards = computed(() => mineResponse.value?.data ?? []);

// ── Comprar ───────────────────────────────────────────────────────────────
const MONTO_MIN = 100;
const MONTO_MAX = 5000;

const buyForm = reactive({
  monto: 500,
  compradorNombre: "",
  destinatarioEmail: "",
});
const buyError = ref("");
const buyProcessing = ref(false);
const buySucceeded = ref(false);
const buyWaiting = ref(false);
const revealedCode = ref<string | null>(null);

let stripe: Stripe | null = null;
let elements: StripeElements | null = null;
let cardElement: StripeCardElement | null = null;
const cardElementRef = ref<HTMLDivElement | null>(null);

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
    buyError.value = elError?.message ?? "";
  });
}

onMounted(() => {
  if (stripeConfigured) ensureStripeMounted();
});
onUnmounted(() => {
  cardElement?.unmount();
});

async function buyWithCard() {
  if (!stripe || !cardElement) return;

  if (buyForm.monto < MONTO_MIN || buyForm.monto > MONTO_MAX) {
    buyError.value = `El monto debe estar entre ${fmtMoney(MONTO_MIN)} y ${fmtMoney(MONTO_MAX)}.`;

    return;
  }

  buyProcessing.value = true;
  buyError.value = "";
  revealedCode.value = null;
  try {
    const intentRes = await apiFetch<{ data: { client_secret: string } }>(
      "/gift-cards/stripe-intent",
      {
        method: "POST",
        body: {
          monto: buyForm.monto,
          comprador_nombre: buyForm.compradorNombre || undefined,
          destinatario_email: buyForm.destinatarioEmail || undefined,
        },
      },
    );

    const result = await stripe.confirmCardPayment(
      intentRes.data.client_secret,
      { payment_method: { card: cardElement } },
    );

    if (result.error) {
      buyError.value = result.error.message ?? "Error al procesar el pago.";

      return;
    }

    if (result.paymentIntent?.status === "succeeded") {
      buySucceeded.value = true;
      if (isClient.value) await waitForCardToAppear();
    }
  } catch (err: unknown) {
    buyError.value =
      (err as { data?: { message?: string } })?.data?.message ??
      "No se pudo conectar con Stripe.";
  } finally {
    buyProcessing.value = false;
  }
}

// El webhook registra la compra en unos segundos; se compara contra los
// códigos ya vistos para no confundir una tarjeta anterior con la nueva.
async function waitForCardToAppear() {
  const seen = new Set(myGiftCards.value.map((g) => g.code));

  buyWaiting.value = true;
  try {
    for (let attempt = 0; attempt < 6; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await refreshMine();
      const fresh = myGiftCards.value.find((g) => !seen.has(g.code));
      if (fresh) {
        revealedCode.value = fresh.code;

        return;
      }
    }
  } finally {
    buyWaiting.value = false;
  }
}

// ── Consultar saldo ──────────────────────────────────────────────────────
const lookupCode = ref("");
const lookupResult = ref<{
  code: string;
  saldo: number;
  monto_inicial: number;
  estado: string;
} | null>(null);
const lookupError = ref("");
const lookupPending = ref(false);

async function lookupBalance() {
  const code = lookupCode.value.trim();
  if (!code) return;

  lookupPending.value = true;
  lookupError.value = "";
  lookupResult.value = null;
  try {
    const res = await apiFetch<{
      data: { code: string; saldo: number; monto_inicial: number; estado: string };
    }>(`/gift-cards/${encodeURIComponent(code)}`);
    lookupResult.value = res.data;
  } catch (err: unknown) {
    lookupError.value =
      (err as { data?: { message?: string } })?.data?.message ??
      "Código no válido o tarjeta sin saldo.";
  } finally {
    lookupPending.value = false;
  }
}
</script>

<template>
  <div class="p-4 sm:p-6 lg:p-8">
    <header class="mb-6">
      <p class="text-sm uppercase tracking-widest text-muted">UrbanBlade</p>
      <h1 class="mt-1 text-2xl font-semibold text-ink">
        Tarjetas de <span class="text-gold">Regalo</span>
      </h1>
      <p class="mt-1 text-sm text-muted">
        Compra una tarjeta de regalo o consulta el saldo de un código.
      </p>
    </header>

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <!-- Comprar -->
      <section class="ui-card p-5 sm:p-6">
        <h2 class="mb-1 text-lg font-black uppercase text-ink">Comprar</h2>
        <p class="mb-4 text-xs text-muted">
          Monto entre {{ fmtMoney(MONTO_MIN) }} y {{ fmtMoney(MONTO_MAX) }}.
        </p>

        <div v-if="!stripeConfigured" class="rounded-xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm text-amber-300">
          El cobro con tarjeta no está disponible en este momento.
        </div>

        <template v-else-if="revealedCode">
          <div class="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-5 text-center">
            <p class="text-[10px] font-black uppercase tracking-widest text-emerald-300">
              ¡Tarjeta creada!
            </p>
            <p class="mt-2 font-mono text-2xl font-black tracking-widest text-ink">
              {{ revealedCode }}
            </p>
            <p class="mt-2 text-xs text-muted">
              Guarda este código -- lo necesitarás para usar el saldo en tu
              próxima visita.
            </p>
          </div>
        </template>

        <template v-else-if="buySucceeded && buyWaiting">
          <div class="rounded-xl border border-line bg-ink/[0.03] p-5 text-center text-sm text-muted">
            Pago confirmado, generando tu tarjeta…
          </div>
        </template>

        <template v-else-if="buySucceeded">
          <div class="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-5 text-center text-sm text-emerald-300">
            Pago confirmado. Si la compra fue para regalar, el código llegará
            al correo indicado.
          </div>
        </template>

        <form v-else class="space-y-4" @submit.prevent="buyWithCard">
          <div>
            <label class="mb-1 block text-xs text-muted">Monto (MXN)</label>
            <input
              v-model.number="buyForm.monto"
              type="number"
              :min="MONTO_MIN"
              :max="MONTO_MAX"
              step="50"
              class="w-full rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink"
            >
          </div>
          <div>
            <label class="mb-1 block text-xs text-muted">Nombre de quien regala (opcional)</label>
            <input
              v-model="buyForm.compradorNombre"
              type="text"
              class="w-full rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink"
            >
          </div>
          <div>
            <label class="mb-1 block text-xs text-muted">Correo de quien la recibe (opcional)</label>
            <input
              v-model="buyForm.destinatarioEmail"
              type="email"
              placeholder="Déjalo vacío si es para ti"
              class="w-full rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink"
            >
          </div>
          <div>
            <label class="mb-1 block text-xs text-muted">Tarjeta</label>
            <div ref="cardElementRef" class="rounded-lg border border-line bg-main px-3 py-3" />
          </div>
          <p v-if="buyError" role="alert" class="text-sm text-red-400">{{ buyError }}</p>
          <button
            type="submit"
            class="ui-btn w-full justify-center"
            :disabled="buyProcessing"
          >
            {{ buyProcessing ? "Procesando…" : `Comprar por ${fmtMoney(buyForm.monto)}` }}
          </button>
        </form>
      </section>

      <!-- Consultar saldo -->
      <section class="ui-card p-5 sm:p-6">
        <h2 class="mb-1 text-lg font-black uppercase text-ink">Consultar saldo</h2>
        <p class="mb-4 text-xs text-muted">
          Escribe el código de la tarjeta para ver cuánto saldo tiene.
        </p>

        <form class="flex gap-2" @submit.prevent="lookupBalance">
          <input
            v-model="lookupCode"
            type="text"
            placeholder="Ej. A1B2C3D4"
            class="flex-1 rounded-lg border border-line bg-main px-3 py-2 text-sm uppercase text-ink"
          >
          <button type="submit" class="ui-btn-secondary shrink-0" :disabled="lookupPending">
            {{ lookupPending ? "…" : "Buscar" }}
          </button>
        </form>

        <p v-if="lookupError" role="alert" class="mt-3 text-sm text-red-400">{{ lookupError }}</p>

        <div v-if="lookupResult" class="mt-4 rounded-xl border border-line bg-ink/[0.03] p-4">
          <div class="flex items-center justify-between">
            <p class="font-mono text-sm font-black text-ink">{{ lookupResult.code }}</p>
            <span
              class="rounded-full border px-2 py-0.5 text-[10px] font-black uppercase"
              :class="ESTADO_CLASS[lookupResult.estado]"
            >{{ ESTADO_LABEL[lookupResult.estado] ?? lookupResult.estado }}</span>
          </div>
          <p class="mt-2 text-2xl font-black text-gold">{{ fmtMoney(lookupResult.saldo) }}</p>
          <p class="text-xs text-muted">de {{ fmtMoney(lookupResult.monto_inicial) }} originales</p>
        </div>
      </section>
    </div>

    <!-- Mis tarjetas (solo cliente) -->
    <section v-if="isClient" class="mt-6">
      <h2 class="mb-3 text-lg font-black uppercase text-ink">Mis tarjetas</h2>
      <p v-if="!myGiftCards.length" class="rounded-2xl border border-dashed border-line p-8 text-center text-sm text-muted">
        Todavía no has comprado ninguna tarjeta de regalo.
      </p>
      <div v-else class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div v-for="card in myGiftCards" :key="card.code" class="ui-card p-4">
          <div class="flex items-center justify-between gap-2">
            <p class="font-mono text-sm font-black text-ink">{{ card.code }}</p>
            <span
              class="rounded-full border px-2 py-0.5 text-[9px] font-black uppercase"
              :class="ESTADO_CLASS[card.estado]"
            >{{ ESTADO_LABEL[card.estado] ?? card.estado }}</span>
          </div>
          <p class="mt-2 text-xl font-black text-gold">{{ fmtMoney(card.saldo) }}</p>
          <p class="text-[10px] font-bold uppercase text-muted">
            de {{ fmtMoney(card.monto_inicial) }} · {{ fmtDate(card.comprado_en) }}
          </p>
        </div>
      </div>
    </section>
  </div>
</template>
