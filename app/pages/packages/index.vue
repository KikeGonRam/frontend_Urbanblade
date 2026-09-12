<script setup lang="ts">
/*
 * Paquetes prepagados (roadmap de mercado, ver barber/.claude/skills/
 * urbanblade-market-web/SKILL.md): "N usos de un servicio por $precio",
 * comprado por el cliente (tarjeta) o vendido en efectivo por staff. El
 * canje real ocurre al cobrar la cita (ver payments/index.vue), no aquí --
 * esta página solo compra y consulta usos restantes.
 */
import {
  loadStripe,
  type Stripe,
  type StripeCardElement,
  type StripeElements,
} from "@stripe/stripe-js";

definePageMeta({ middleware: ["auth"], layout: "dashboard" });

interface CatalogPackage {
  id: string;
  nombre: string;
  service: { id: string | null; nombre: string | null };
  cantidad_usos: number;
  precio: number;
  vigencia_dias: number | null;
}

interface MyPackage {
  id: string;
  nombre: string | null;
  service: { id: string | null; nombre: string | null };
  usos_totales: number;
  usos_restantes: number;
  precio_pagado: number;
  metodo_pago: string;
  comprado_en: string | null;
  expira_en: string | null;
  estado: string;
}

const ESTADO_LABEL: Record<string, string> = {
  activo: "Activo",
  agotado: "Agotado",
  expirado: "Expirado",
};
const ESTADO_CLASS: Record<string, string> = {
  activo: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
  agotado: "border-ink/15 bg-ink/5 text-ink/50",
  expirado: "border-amber-500/25 bg-amber-500/10 text-amber-300",
};

const { apiFetch } = useApi();
const { user, hasRole, fetchMe } = useAuth();
const config = useRuntimeConfig();
const stripeConfigured = Boolean(config.public.stripeKey);
const isClient = computed(() => hasRole("cliente"));

// Igual que /gift-cards: si se entra directo a esta URL, "auth_user"
// todavía no existe -- ver dashboard/index.vue y middleware/client.ts.
await callOnce("packages-fetch-me", () => (user.value ? null : fetchMe()));

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

// ── Catálogo ─────────────────────────────────────────────────────────────
const { data: catalogResponse, pending: catalogPending } = await useAsyncData(
  "packages-catalog",
  () => apiFetch<{ data: CatalogPackage[] }>("/packages/catalog"),
);
const catalog = computed(() => catalogResponse.value?.data ?? []);

// ── Mis paquetes (solo cliente) ───────────────────────────────────────────
const { data: mineResponse, refresh: refreshMine } = await useAsyncData(
  "packages-mine",
  () =>
    isClient.value
      ? apiFetch<{ data: MyPackage[] }>("/packages")
      : Promise.resolve({ data: [] }),
  { lazy: true },
);
const myPackages = computed(() => mineResponse.value?.data ?? []);

// ── Comprar con tarjeta ──────────────────────────────────────────────────
const buying = ref<CatalogPackage | null>(null);
const buyError = ref("");
const buyProcessing = ref(false);
const buySucceeded = ref(false);
const buyWaiting = ref(false);

let stripe: Stripe | null = null;
let elements: StripeElements | null = null;
let cardElement: StripeCardElement | null = null;
const cardElementRef = ref<HTMLDivElement | null>(null);

async function openBuy(pkg: CatalogPackage) {
  buying.value = pkg;
  buyError.value = "";
  buySucceeded.value = false;
  await nextTick();
  await ensureStripeMounted();
}

function closeBuy() {
  buying.value = null;
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
    buyError.value = elError?.message ?? "";
  });
}

function teardownStripe() {
  cardElement?.unmount();
  cardElement = null;
  elements = null;
}

onUnmounted(() => teardownStripe());

async function buyWithCard() {
  if (!buying.value || !stripe || !cardElement) return;

  buyProcessing.value = true;
  buyError.value = "";
  try {
    const intentRes = await apiFetch<{ data: { client_secret: string } }>(
      "/packages/stripe-intent",
      { method: "POST", body: { service_package_id: buying.value.id } },
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
      await waitForPackageToAppear();
    }
  } catch (err: unknown) {
    buyError.value =
      (err as { data?: { message?: string } })?.data?.message ??
      "No se pudo conectar con Stripe.";
  } finally {
    buyProcessing.value = false;
  }
}

// El webhook registra la compra en unos segundos (ver GiftCardController::
// mine() en barber para el mismo patrón, aquí sobre /packages).
async function waitForPackageToAppear() {
  const seen = new Set(myPackages.value.map((p) => p.id));

  buyWaiting.value = true;
  try {
    for (let attempt = 0; attempt < 6; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await refreshMine();
      if (myPackages.value.some((p) => !seen.has(p.id))) {
        closeBuy();

        return;
      }
    }
  } finally {
    buyWaiting.value = false;
  }
}
</script>

<template>
  <div class="p-4 sm:p-6 lg:p-8">
    <header class="mb-6">
      <p class="text-sm uppercase tracking-widest text-muted">UrbanBlade</p>
      <h1 class="mt-1 text-2xl font-semibold text-ink">
        Paquetes <span class="text-gold">Prepagados</span>
      </h1>
      <p class="mt-1 text-sm text-muted">
        Varios usos de un servicio, pagados por adelantado.
      </p>
    </header>

    <section>
      <h2 class="mb-3 text-lg font-black uppercase text-ink">Catálogo</h2>
      <p v-if="catalogPending" class="text-sm text-muted">Cargando…</p>
      <p v-else-if="!catalog.length" class="rounded-2xl border border-dashed border-line p-8 text-center text-sm text-muted">
        No hay paquetes disponibles por el momento.
      </p>
      <div v-else class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div v-for="pkg in catalog" :key="pkg.id" class="ui-card flex flex-col p-5">
          <p class="text-[9px] font-black uppercase tracking-widest text-gold/70">
            {{ pkg.service.nombre }}
          </p>
          <h3 class="mt-1 text-lg font-black text-ink">{{ pkg.nombre }}</h3>
          <p class="mt-2 text-2xl font-black text-gold">{{ fmtMoney(pkg.precio) }}</p>
          <p class="mt-1 text-xs text-muted">
            {{ pkg.cantidad_usos }} usos
            <span v-if="pkg.vigencia_dias">· vigente {{ pkg.vigencia_dias }} días</span>
          </p>
          <button
            v-if="isClient"
            type="button"
            class="ui-btn mt-4 justify-center"
            :disabled="!stripeConfigured"
            @click="openBuy(pkg)"
          >
            Comprar
          </button>
          <p v-else class="mt-4 text-[10px] italic text-muted">
            El cliente compra el paquete desde su cuenta.
          </p>
        </div>
      </div>
    </section>

    <section v-if="isClient" class="mt-8">
      <h2 class="mb-3 text-lg font-black uppercase text-ink">Mis paquetes</h2>
      <p v-if="!myPackages.length" class="rounded-2xl border border-dashed border-line p-8 text-center text-sm text-muted">
        Todavía no tienes paquetes prepagados.
      </p>
      <div v-else class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div v-for="pkg in myPackages" :key="pkg.id" class="ui-card p-4">
          <div class="flex items-center justify-between gap-2">
            <p class="font-black text-ink">{{ pkg.nombre }}</p>
            <span
              class="rounded-full border px-2 py-0.5 text-[9px] font-black uppercase"
              :class="ESTADO_CLASS[pkg.estado]"
            >{{ ESTADO_LABEL[pkg.estado] ?? pkg.estado }}</span>
          </div>
          <p class="text-xs text-muted">{{ pkg.service.nombre }}</p>
          <p class="mt-2 text-xl font-black text-gold">
            {{ pkg.usos_restantes }} / {{ pkg.usos_totales }} usos
          </p>
          <p class="text-[10px] font-bold uppercase text-muted">
            Comprado {{ fmtDate(pkg.comprado_en) }}
            <span v-if="pkg.expira_en"> · vence {{ fmtDate(pkg.expira_en) }}</span>
          </p>
        </div>
      </div>
    </section>

    <!-- Modal de compra -->
    <div v-if="buying" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div class="w-full max-w-md rounded-2xl border border-line bg-card p-6">
        <div class="mb-4 flex items-center justify-between">
          <h3 class="text-lg font-black uppercase text-ink">{{ buying.nombre }}</h3>
          <button type="button" class="text-sm text-muted hover:text-ink" @click="closeBuy">✕</button>
        </div>

        <template v-if="buySucceeded && buyWaiting">
          <p class="rounded-xl border border-line bg-ink/[0.03] p-5 text-center text-sm text-muted">
            Pago confirmado, activando tu paquete…
          </p>
        </template>
        <template v-else-if="buySucceeded">
          <p class="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-5 text-center text-sm text-emerald-300">
            Pago confirmado. Actualiza la página en unos momentos si todavía no ves tu paquete.
          </p>
        </template>
        <form v-else class="space-y-4" @submit.prevent="buyWithCard">
          <p class="text-2xl font-black text-gold">{{ fmtMoney(buying.precio) }}</p>
          <div ref="cardElementRef" class="rounded-lg border border-line bg-main px-3 py-3" />
          <p v-if="buyError" role="alert" class="text-sm text-red-400">{{ buyError }}</p>
          <button type="submit" class="ui-btn w-full justify-center" :disabled="buyProcessing">
            {{ buyProcessing ? "Procesando…" : `Comprar por ${fmtMoney(buying.precio)}` }}
          </button>
        </form>
      </div>
    </div>
  </div>
</template>
