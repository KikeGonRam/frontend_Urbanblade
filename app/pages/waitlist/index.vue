<script setup lang="ts">
/*
 * Lista de espera (roadmap de mercado, ver barber/.claude/skills/
 * urbanblade-market-web/SKILL.md): un cliente se anota cuando un
 * barbero+servicio+fecha ya no tiene horarios libres, para que se le
 * avise si se libera uno (ver WaitlistService::notifyIfAny() en barber,
 * disparado cuando una cita se cancela/reprograma). Staff ve la misma
 * lista sin filtro de client_id -- visibilidad de demanda, sin acción
 * propia aquí (el aviso ya es automático).
 */
definePageMeta({ middleware: ["auth"], layout: "dashboard" });

interface BarberRow {
  id: string;
  user: { id: string; name: string } | null;
}
interface ServiceRow {
  id: string;
  nombre: string;
}
interface WaitlistEntry {
  id: string;
  estado: "activo" | "notificado" | "reservado" | "expirado" | "cancelado";
  fecha: string;
  notificado_en: string | null;
  client: { id: string | null; name: string | null };
  barber: { id: string | null; name: string | null };
  service: { id: string | null; nombre: string | null };
}

const ESTADO_LABEL: Record<string, string> = {
  activo: "En espera",
  notificado: "Avisado",
  reservado: "Ya reservó",
  expirado: "Expirada",
  cancelado: "Cancelada",
};
const ESTADO_CLASS: Record<string, string> = {
  activo: "border-amber-500/25 bg-amber-500/10 text-amber-300",
  notificado: "border-sky-500/25 bg-sky-500/10 text-sky-300",
  reservado: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
  expirado: "border-ink/15 bg-ink/5 text-ink/50",
  cancelado: "border-red-500/25 bg-red-500/10 text-red-400",
};

const { apiFetch } = useApi();
const { user, hasRole, fetchMe } = useAuth();
const { confirm } = useConfirm();

// Igual que /gift-cards, /packages: si se entra directo, "auth_user"
// todavía no existe -- ver dashboard/index.vue.
await callOnce("waitlist-fetch-me", () => (user.value ? null : fetchMe()));

const isClient = computed(() => hasRole("cliente"));
const isStaff = computed(() => hasRole("administrador") || hasRole("recepcionista"));

function fmtDate(iso: string | null) {
  if (!iso) return "—";

  return new Date(`${iso}T00:00:00`).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const { data: entriesResponse, pending, error, refresh } = await useAsyncData(
  "waitlist-entries",
  () => apiFetch<{ data: WaitlistEntry[] }>("/waitlist"),
);
const entries = computed(() => entriesResponse.value?.data ?? []);

// ── Anotarse (solo cliente) ──────────────────────────────────────────────
const { data: barbersResponse } = await useAsyncData(
  "waitlist-barbers",
  () => (isClient.value ? apiFetch<{ data: BarberRow[] }>("/barbers") : Promise.resolve({ data: [] })),
);
const barbers = computed(() => barbersResponse.value?.data ?? []);

const { data: servicesResponse } = await useAsyncData(
  "waitlist-services",
  () => (isClient.value ? apiFetch<{ data: ServiceRow[] }>("/services") : Promise.resolve({ data: [] })),
);
const services = computed(() => servicesResponse.value?.data ?? []);

const form = reactive({ barberId: "", serviceId: "", fecha: "" });
const joinError = ref("");
const joining = ref(false);

async function submitJoin() {
  if (!form.barberId || !form.serviceId || !form.fecha) return;

  joining.value = true;
  joinError.value = "";
  try {
    await apiFetch("/waitlist", {
      method: "POST",
      body: { barber_id: form.barberId, service_id: form.serviceId, fecha: form.fecha },
    });
    form.barberId = "";
    form.serviceId = "";
    form.fecha = "";
    await refresh();
  } catch (err: unknown) {
    joinError.value =
      (err as { data?: { message?: string } })?.data?.message ??
      "No se pudo anotar en la lista de espera.";
  } finally {
    joining.value = false;
  }
}

// ── Cancelar (dueño de la anotación) ──────────────────────────────────────
const cancelling = ref<string | null>(null);

async function cancelEntry(entry: WaitlistEntry) {
  const accepted = await confirm({
    title: "Salir de la lista de espera",
    message: `¿Cancelar tu anotación para ${entry.service.nombre ?? "este servicio"} el ${fmtDate(entry.fecha)}?`,
    confirmText: "Sí, cancelar",
    isDanger: true,
  });
  if (!accepted) return;

  cancelling.value = entry.id;
  try {
    await apiFetch(`/waitlist/${entry.id}`, { method: "DELETE" });
    await refresh();
  } finally {
    cancelling.value = null;
  }
}
</script>

<template>
  <div class="p-4 sm:p-6 lg:p-8">
    <header class="mb-6">
      <p class="text-sm uppercase tracking-widest text-muted">UrbanBlade</p>
      <h1 class="mt-1 text-2xl font-semibold text-ink">
        Lista de <span class="text-gold">Espera</span>
      </h1>
      <p class="mt-1 text-sm text-muted">
        {{ isClient ? "Anótate cuando no haya horarios libres y te avisamos si se libera uno." : "Demanda de horarios ya llenos." }}
      </p>
    </header>

    <section v-if="isClient" class="ui-card mb-6 p-5">
      <h2 class="mb-3 text-sm font-black uppercase text-ink">Anotarme</h2>
      <form class="grid grid-cols-1 gap-3 sm:grid-cols-4" @submit.prevent="submitJoin">
        <select v-model="form.barberId" required class="rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink">
          <option value="" disabled>Barbero…</option>
          <option v-for="b in barbers" :key="b.id" :value="b.id">{{ b.user?.name }}</option>
        </select>
        <select v-model="form.serviceId" required class="rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink">
          <option value="" disabled>Servicio…</option>
          <option v-for="s in services" :key="s.id" :value="s.id">{{ s.nombre }}</option>
        </select>
        <input v-model="form.fecha" type="date" required class="rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink">
        <button type="submit" class="ui-btn justify-center" :disabled="joining">
          {{ joining ? "…" : "Anotarme" }}
        </button>
      </form>
      <p v-if="joinError" role="alert" class="mt-3 text-sm text-red-400">{{ joinError }}</p>
    </section>

    <section>
      <h2 class="mb-3 text-sm font-black uppercase text-ink">
        {{ isStaff ? "Demanda en lista de espera" : "Mis anotaciones" }}
      </h2>
      <p v-if="pending" class="text-sm text-muted">Cargando…</p>
      <p v-else-if="error" class="text-sm text-red-400">No se pudo cargar la lista de espera.</p>
      <p v-else-if="!entries.length" class="rounded-2xl border border-dashed border-line p-8 text-center text-sm text-muted">
        {{ isClient ? "No tienes anotaciones en lista de espera." : "No hay nadie en lista de espera." }}
      </p>
      <div v-else class="space-y-2">
        <div
          v-for="entry in entries"
          :key="entry.id"
          class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-ink/[0.02] p-4"
        >
          <div>
            <p class="text-sm font-bold text-ink">
              {{ entry.service.nombre }}
              <span class="text-muted">con {{ entry.barber.name }}</span>
            </p>
            <p class="text-[10px] font-bold uppercase text-muted">
              {{ fmtDate(entry.fecha) }}
              <span v-if="isStaff"> · {{ entry.client.name }}</span>
            </p>
          </div>
          <div class="flex items-center gap-3">
            <span
              class="rounded-full border px-2 py-0.5 text-[9px] font-black uppercase"
              :class="ESTADO_CLASS[entry.estado]"
            >{{ ESTADO_LABEL[entry.estado] ?? entry.estado }}</span>
            <button
              v-if="isClient && (entry.estado === 'activo' || entry.estado === 'notificado')"
              type="button"
              class="text-xs text-red-400 hover:underline"
              :disabled="cancelling === entry.id"
              @click="cancelEntry(entry)"
            >
              {{ cancelling === entry.id ? "Cancelando…" : "Salir" }}
            </button>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
