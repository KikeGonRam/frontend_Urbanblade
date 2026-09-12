<script setup lang="ts">
/*
 * Membresía recurrente (roadmap de mercado, ver barber/.claude/skills/
 * urbanblade-market-web/SKILL.md): suscripción mensual real (Stripe
 * Subscriptions) que otorga un descuento % en cada servicio mientras esté
 * activa -- nunca sumado al descuento por nivel de lealtad, siempre el
 * mayor de los dos (ver PaymentService::applyBestDiscount() en barber).
 *
 * Solo cliente contrata/cancela -- staff no tiene acción aquí, a diferencia
 * de gift-cards/packages, porque una membresía siempre la paga y la
 * cancela el propio dueño de la tarjeta guardada en Stripe.
 */
import {
  loadStripe,
  type Stripe,
  type StripeCardElement,
  type StripeElements,
} from "@stripe/stripe-js";

definePageMeta({ middleware: ["auth", "client"], layout: "dashboard" });

interface Plan {
  id: string;
  nombre: string;
  descripcion: string | null;
  precio_mensual: number;
  descuento_pct: number;
}

interface Membership {
  id: string;
  estado: "pendiente" | "activa" | "pago_fallido" | "cancelada";
  cancelar_al_finalizar: boolean;
  periodo_actual_fin: string | null;
  plan: { id: string; nombre: string; precio_mensual: number; descuento_pct: number };
}

const ESTADO_LABEL: Record<string, string> = {
  pendiente: "Confirmando pago",
  activa: "Activa",
  pago_fallido: "Pago pendiente",
  cancelada: "Cancelada",
};
const ESTADO_CLASS: Record<string, string> = {
  pendiente: "border-amber-500/25 bg-amber-500/10 text-amber-300",
  activa: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
  pago_fallido: "border-red-500/25 bg-red-500/10 text-red-400",
  cancelada: "border-ink/15 bg-ink/5 text-ink/50",
};

const { apiFetch } = useApi();
const { confirm } = useConfirm();
const config = useRuntimeConfig();
const stripeConfigured = Boolean(config.public.stripeKey);

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

const { data: plansResponse, pending: plansPending } = await useAsyncData(
  "membership-plans",
  () => apiFetch<{ data: Plan[] }>("/memberships/plans"),
);
const plans = computed(() => plansResponse.value?.data ?? []);

const {
  data: mineResponse,
  pending: minePending,
  refresh: refreshMine,
} = await useAsyncData("membership-mine", () =>
  apiFetch<{ data: Membership | null }>("/memberships/mine"),
);
const membership = computed(() => mineResponse.value?.data ?? null);
// Una membresía cancelada ya no bloquea nada -- se trata igual que no tener
// ninguna, para volver a ofrecer el catálogo (ver ClientMembership::
// bloquea_membresia en barber).
const hasActiveOrPending = computed(
  () => !!membership.value && membership.value.estado !== "cancelada",
);

// ── Contratar ────────────────────────────────────────────────────────────
const subscribing = ref<Plan | null>(null);
const subscribeError = ref("");
const subscribeProcessing = ref(false);
const subscribeSucceeded = ref(false);
const subscribeWaiting = ref(false);

let stripe: Stripe | null = null;
let elements: StripeElements | null = null;
let cardElement: StripeCardElement | null = null;
const cardElementRef = ref<HTMLDivElement | null>(null);

async function openSubscribe(plan: Plan) {
  subscribing.value = plan;
  subscribeError.value = "";
  subscribeSucceeded.value = false;
  await nextTick();
  await ensureStripeMounted();
}

function closeSubscribe() {
  subscribing.value = null;
  teardownStripe();
}

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
  if (cardElementRef.value) cardElement.mount(cardElementRef.value);
  cardElement.on("change", ({ error: elError }) => {
    subscribeError.value = elError?.message ?? "";
  });
}

function teardownStripe() {
  cardElement?.unmount();
  cardElement = null;
  elements = null;
}

onUnmounted(() => teardownStripe());

async function subscribeWithCard() {
  if (!subscribing.value || !stripe || !cardElement) return;

  subscribeProcessing.value = true;
  subscribeError.value = "";
  try {
    const res = await apiFetch<{ data: { client_secret: string } }>(
      "/memberships/subscribe",
      { method: "POST", body: { membership_plan_id: subscribing.value.id } },
    );

    const result = await stripe.confirmCardPayment(res.data.client_secret, {
      payment_method: { card: cardElement },
    });

    if (result.error) {
      subscribeError.value = result.error.message ?? "Error al procesar el pago.";

      return;
    }

    if (result.paymentIntent?.status === "succeeded") {
      subscribeSucceeded.value = true;
      await waitForActivation();
    }
  } catch (err: unknown) {
    subscribeError.value =
      (err as { data?: { message?: string } })?.data?.message ??
      "No se pudo conectar con Stripe.";
  } finally {
    subscribeProcessing.value = false;
  }
}

// El webhook customer.subscription.updated activa la membresía en unos
// segundos -- mismo patrón de "esperar y refrescar" que gift-cards/packages.
async function waitForActivation() {
  subscribeWaiting.value = true;
  try {
    for (let attempt = 0; attempt < 6; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await refreshMine();
      if (membership.value?.estado === "activa") {
        closeSubscribe();

        return;
      }
    }
  } finally {
    subscribeWaiting.value = false;
  }
}

// ── Cancelar ─────────────────────────────────────────────────────────────
const cancelling = ref(false);
const cancelError = ref("");

async function cancelMembership() {
  const accepted = await confirm({
    title: "Cancelar membresía",
    message: "Seguirás con el beneficio hasta el final del periodo ya pagado. ¿Cancelar de todos modos?",
    confirmText: "Sí, cancelar",
    isDanger: true,
  });
  if (!accepted) return;

  cancelling.value = true;
  cancelError.value = "";
  try {
    await apiFetch("/memberships/cancel", { method: "POST" });
    await refreshMine();
  } catch (err: unknown) {
    cancelError.value =
      (err as { data?: { message?: string } })?.data?.message ??
      "No se pudo cancelar la membresía.";
  } finally {
    cancelling.value = false;
  }
}
</script>

<template>
  <div class="p-4 sm:p-6 lg:p-8">
    <header class="mb-6">
      <p class="text-sm uppercase tracking-widest text-muted">UrbanBlade</p>
      <h1 class="mt-1 text-2xl font-semibold text-ink">
        Membresía <span class="text-gold">Recurrente</span>
      </h1>
      <p class="mt-1 text-sm text-muted">
        Descuento fijo en cada servicio mientras tu membresía esté activa.
      </p>
    </header>

    <p v-if="minePending || plansPending" class="text-sm text-muted">Cargando…</p>

    <!-- Ya tiene una membresía activa/pendiente/con pago fallido -->
    <section v-else-if="hasActiveOrPending && membership" class="ui-card max-w-lg p-6">
      <div class="flex items-center justify-between gap-2">
        <h2 class="text-lg font-black uppercase text-ink">{{ membership.plan.nombre }}</h2>
        <span
          class="rounded-full border px-2 py-0.5 text-[10px] font-black uppercase"
          :class="ESTADO_CLASS[membership.estado]"
        >{{ ESTADO_LABEL[membership.estado] ?? membership.estado }}</span>
      </div>
      <p class="mt-2 text-2xl font-black text-gold">
        {{ fmtMoney(membership.plan.precio_mensual) }}<span class="text-sm text-muted">/mes</span>
      </p>
      <p class="mt-1 text-sm text-ink/80">{{ membership.plan.descuento_pct }}% de descuento en cada servicio</p>

      <p v-if="membership.estado === 'pago_fallido'" class="mt-4 rounded-xl border border-red-500/25 bg-red-500/10 p-3 text-xs text-red-300">
        Tu último cobro falló. Stripe reintentará automáticamente; si sigue fallando, actualiza tu método de pago con tu banco.
      </p>
      <p v-else-if="membership.estado === 'pendiente'" class="mt-4 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-xs text-amber-300">
        Confirmando tu primer pago…
      </p>

      <p v-if="membership.cancelar_al_finalizar" class="mt-4 text-xs text-muted">
        Se cancelará el {{ fmtDate(membership.periodo_actual_fin) }} y no se renovará.
      </p>
      <p v-else-if="membership.periodo_actual_fin" class="mt-4 text-xs text-muted">
        Próxima renovación: {{ fmtDate(membership.periodo_actual_fin) }}
      </p>

      <p v-if="cancelError" role="alert" class="mt-3 text-sm text-red-400">{{ cancelError }}</p>

      <button
        v-if="membership.estado !== 'pendiente' && !membership.cancelar_al_finalizar"
        type="button"
        class="ui-btn-secondary mt-5"
        :disabled="cancelling"
        @click="cancelMembership"
      >
        {{ cancelling ? "Cancelando…" : "Cancelar membresía" }}
      </button>
    </section>

    <!-- Sin membresía: catálogo de planes -->
    <section v-else>
      <p v-if="!plans.length" class="rounded-2xl border border-dashed border-line p-8 text-center text-sm text-muted">
        No hay planes de membresía disponibles por el momento.
      </p>
      <div v-else class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div v-for="plan in plans" :key="plan.id" class="ui-card flex flex-col p-5">
          <h3 class="text-lg font-black uppercase text-ink">{{ plan.nombre }}</h3>
          <p v-if="plan.descripcion" class="mt-1 text-xs text-muted">{{ plan.descripcion }}</p>
          <p class="mt-3 text-2xl font-black text-gold">
            {{ fmtMoney(plan.precio_mensual) }}<span class="text-sm text-muted">/mes</span>
          </p>
          <p class="mt-1 text-sm text-ink/80">{{ plan.descuento_pct }}% de descuento en cada servicio</p>
          <button
            type="button"
            class="ui-btn mt-4 justify-center"
            :disabled="!stripeConfigured"
            @click="openSubscribe(plan)"
          >
            Contratar
          </button>
        </div>
      </div>
    </section>

    <!-- Modal de contratación -->
    <div v-if="subscribing" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div class="w-full max-w-md rounded-2xl border border-line bg-card p-6">
        <div class="mb-4 flex items-center justify-between">
          <h3 class="text-lg font-black uppercase text-ink">{{ subscribing.nombre }}</h3>
          <button type="button" class="text-sm text-muted hover:text-ink" @click="closeSubscribe">✕</button>
        </div>

        <template v-if="subscribeSucceeded && subscribeWaiting">
          <p class="rounded-xl border border-line bg-ink/[0.03] p-5 text-center text-sm text-muted">
            Pago confirmado, activando tu membresía…
          </p>
        </template>
        <template v-else-if="subscribeSucceeded">
          <p class="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-5 text-center text-sm text-emerald-300">
            Pago confirmado. Actualiza la página en unos momentos si todavía no ves tu membresía activa.
          </p>
        </template>
        <form v-else class="space-y-4" @submit.prevent="subscribeWithCard">
          <p class="text-2xl font-black text-gold">
            {{ fmtMoney(subscribing.precio_mensual) }}<span class="text-sm text-muted">/mes</span>
          </p>
          <div ref="cardElementRef" class="rounded-lg border border-line bg-main px-3 py-3" />
          <p v-if="subscribeError" role="alert" class="text-sm text-red-400">{{ subscribeError }}</p>
          <button type="submit" class="ui-btn w-full justify-center" :disabled="subscribeProcessing">
            {{ subscribeProcessing ? "Procesando…" : "Contratar y pagar el primer mes" }}
          </button>
        </form>
      </div>
    </div>
  </div>
</template>
