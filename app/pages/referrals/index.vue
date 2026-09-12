<script setup lang="ts">
/*
 * Programa de referidos (roadmap de mercado, ver barber/.claude/skills/
 * urbanblade-market-web/SKILL.md): cada cliente tiene un código propio
 * para invitar; quien invita gana puntos de lealtad cuando la persona
 * referida completa su PRIMERA cita real (nunca por solo registrarse, ver
 * ReferralService en barber). Sin Stripe -- puntos de lealtad ya
 * existentes, no dinero nuevo.
 */
definePageMeta({ middleware: ["auth", "client"], layout: "dashboard" });

interface Referido {
  referido: string;
  estado: "pendiente" | "completado";
  recompensa_otorgada_en: string | null;
}

interface MineResponse {
  codigo_referido: string;
  puntos_por_referido: number;
  referidos: Referido[];
  completados: number;
}

const ESTADO_LABEL: Record<string, string> = { pendiente: "Pendiente", completado: "Completado" };
const ESTADO_CLASS: Record<string, string> = {
  pendiente: "border-amber-500/25 bg-amber-500/10 text-amber-300",
  completado: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
};

const { apiFetch } = useApi();

const { data: response, pending, error } = await useAsyncData(
  "referrals-mine",
  () => apiFetch<{ data: MineResponse }>("/referrals/mine"),
);
const data = computed(() => response.value?.data ?? null);

function fmtDate(iso: string | null) {
  if (!iso) return "—";

  return new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

const copied = ref(false);
async function copyCode() {
  if (!data.value) return;
  try {
    await navigator.clipboard.writeText(data.value.codigo_referido);
    copied.value = true;
    setTimeout(() => (copied.value = false), 2000);
  } catch {
    // Portapapeles no disponible (permiso denegado, contexto no seguro) --
    // el código ya está visible en pantalla, así que no hay nada más que
    // hacer aquí más que dejar de intentarlo en silencio.
  }
}

// ── Vincular quién me refirió ────────────────────────────────────────────
const linkCode = ref("");
const linkError = ref("");
const linkSuccess = ref(false);
const linking = ref(false);

async function submitLink() {
  const codigo = linkCode.value.trim();
  if (!codigo) return;

  linking.value = true;
  linkError.value = "";
  linkSuccess.value = false;
  try {
    await apiFetch("/referrals/link", { method: "POST", body: { codigo } });
    linkSuccess.value = true;
    linkCode.value = "";
  } catch (err: unknown) {
    linkError.value =
      (err as { data?: { message?: string } })?.data?.message ??
      "No se pudo vincular el código.";
  } finally {
    linking.value = false;
  }
}
</script>

<template>
  <div class="p-4 sm:p-6 lg:p-8">
    <header class="mb-6">
      <p class="text-sm uppercase tracking-widest text-muted">UrbanBlade</p>
      <h1 class="mt-1 text-2xl font-semibold text-ink">
        Programa de <span class="text-gold">Referidos</span>
      </h1>
      <p class="mt-1 text-sm text-muted">Invita a tus amigos y gana puntos de lealtad.</p>
    </header>

    <p v-if="pending" class="text-sm text-muted">Cargando…</p>
    <p v-else-if="error" class="text-sm text-red-400">No se pudo cargar tu información de referidos.</p>

    <div v-else-if="data" class="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <section class="ui-card p-6 text-center">
        <p class="text-[10px] font-black uppercase tracking-widest text-gold/70">Tu código</p>
        <p class="mt-2 font-mono text-4xl font-black tracking-widest text-ink">{{ data.codigo_referido }}</p>
        <button type="button" class="ui-btn-secondary mt-4" @click="copyCode">
          {{ copied ? "¡Copiado!" : "Copiar código" }}
        </button>
        <p class="mt-4 text-xs text-muted">
          Cuando alguien use tu código y complete su primera cita, ganas
          <span class="font-black text-gold">{{ data.puntos_por_referido }} puntos</span> de lealtad.
        </p>
      </section>

      <section class="ui-card p-6">
        <h2 class="text-sm font-black uppercase text-ink">¿A ti te invitó alguien?</h2>
        <p class="mt-1 text-xs text-muted">
          Ingresa el código de quien te invitó. Solo puedes hacerlo una vez.
        </p>
        <form class="mt-4 flex gap-2" @submit.prevent="submitLink">
          <input
            v-model="linkCode"
            type="text"
            placeholder="Ej. A1B2C3"
            class="flex-1 rounded-lg border border-line bg-main px-3 py-2 text-sm uppercase text-ink"
          >
          <button type="submit" class="ui-btn shrink-0" :disabled="linking">
            {{ linking ? "…" : "Vincular" }}
          </button>
        </form>
        <p v-if="linkSuccess" class="mt-3 text-sm text-emerald-300">
          ¡Listo! Cuando completes tu primera cita, tu referido ganará sus puntos.
        </p>
        <p v-else-if="linkError" role="alert" class="mt-3 text-sm text-red-400">{{ linkError }}</p>
      </section>

      <section class="ui-card p-6 lg:col-span-2">
        <div class="mb-4 flex items-center justify-between">
          <h2 class="text-sm font-black uppercase text-ink">Tus referidos</h2>
          <span class="text-xs text-muted">{{ data.completados }} completado{{ data.completados === 1 ? "" : "s" }}</span>
        </div>
        <p v-if="!data.referidos.length" class="rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">
          Todavía no has referido a nadie.
        </p>
        <div v-else class="space-y-2">
          <div
            v-for="(r, i) in data.referidos"
            :key="i"
            class="flex items-center justify-between rounded-xl border border-line bg-ink/[0.02] p-3"
          >
            <div>
              <p class="text-sm font-bold text-ink">{{ r.referido }}</p>
              <p v-if="r.recompensa_otorgada_en" class="text-[10px] text-muted">
                Puntos otorgados {{ fmtDate(r.recompensa_otorgada_en) }}
              </p>
            </div>
            <span
              class="rounded-full border px-2 py-0.5 text-[9px] font-black uppercase"
              :class="ESTADO_CLASS[r.estado]"
            >{{ ESTADO_LABEL[r.estado] ?? r.estado }}</span>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
