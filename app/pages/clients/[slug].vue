<script setup lang="ts">
/*
 * Ficha 360 del cliente (P0-4 de urbanblade-market-web).
 *
 * GET /admin/clients/{slug} ya devolvía historial, gasto, promedio, última
 * visita, días desde la última y barbero preferido desde hace tiempo, pero
 * ninguna pantalla lo mostraba: /clients era solo alta/edición/baja, así que
 * quien atiende no tenía forma de ver al cliente que tiene enfrente. Nivel de
 * lealtad, puntos y notas del staff se agregaron a esa respuesta para esta
 * pantalla.
 *
 * Abierta a recepción ('staff'), que es quien atiende el mostrador y necesita
 * el contexto del cliente que tiene enfrente. El backend lo permite por
 * acción: ClientAdminController::show()/update() usan authorizeCounterStaff(),
 * mientras exportar, segmentar y dar de baja siguen en authorizeAdmin().
 */
definePageMeta({ middleware: ["auth", "staff"], layout: "dashboard" });

interface HistoryRow {
  id: string;
  code: string | null;
  fecha: string | null;
  hora_inicio: string | null;
  barber: string | null;
  service: string | null;
  precio: number | null;
  estado: string;
}
interface ClientDetail {
  id: string;
  slug: string | null;
  name: string | null;
  email: string | null;
  telefono: string | null;
  segment: string | null;
  nivel: string | null;
  puntos: number;
  notas: string | null;
  joinedAt: string | null;
  totalAppointments: number;
  totalSpent: number;
  averageSpent: number;
  lastAppointment: string | null;
  daysSinceLastAppointment: number | null;
  preferredBarber: string | null;
  appointments: HistoryRow[];
}

const ESTADO_LABEL: Record<string, string> = {
  pendiente: "Pendiente",
  confirmada: "Confirmada",
  en_proceso: "En Proceso",
  completada: "Completada",
  cancelada: "Cancelada",
  no_asistio: "No Asistió",
};
const ESTADO_CLASS: Record<string, string> = {
  pendiente: "border-amber-500/25 bg-amber-500/10 text-amber-300",
  confirmada: "border-blue-500/25 bg-blue-500/10 text-blue-300",
  en_proceso: "border-sky-500/25 bg-sky-500/10 text-sky-300",
  completada: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
  cancelada: "border-red-500/25 bg-red-500/10 text-red-400",
  no_asistio: "border-orange-500/25 bg-orange-500/10 text-orange-300",
};
const SEGMENT_LABEL: Record<string, string> = {
  vip: "VIP",
  new: "Nuevo",
  active: "Activo",
  inactive: "Inactivo",
};

const route = useRoute();
const { apiFetch } = useApi();
const slug = computed(() => String(route.params.slug ?? ""));

const {
  data: response,
  pending,
  error,
  refresh,
} = await useAsyncData(
  () => `client-detail-${slug.value}`,
  () => apiFetch<{ data: ClientDetail }>(`/admin/clients/${slug.value}`),
);
const client = computed(() => response.value?.data ?? null);

useSeoMeta({
  title: () => `${client.value?.name ?? "Cliente"} — UrbanBlade`,
});

// ── Notas del staff ───────────────────────────────────────────────────────
const notas = ref("");
const notasGuardadas = ref(false);
const savingNotas = ref(false);
const notasError = ref("");

watch(
  client,
  (c) => {
    notas.value = c?.notas ?? "";
  },
  { immediate: true },
);

const notasSucias = computed(
  () => notas.value !== (client.value?.notas ?? ""),
);

async function guardarNotas() {
  savingNotas.value = true;
  notasError.value = "";
  notasGuardadas.value = false;
  try {
    // null, no "": mandar cadena vacía guardaría una nota en blanco en vez de
    // borrarla (el backend distingue con array_key_exists).
    await apiFetch(`/admin/clients/${slug.value}`, {
      method: "PUT",
      body: { notas: notas.value.trim() || null },
    });
    await refresh();
    notasGuardadas.value = true;
  } catch (err: unknown) {
    notasError.value =
      (err as { data?: { message?: string } })?.data?.message ??
      "No se pudieron guardar las notas.";
  } finally {
    savingNotas.value = false;
  }
}

function money(n: number | null | undefined) {
  return `$${Math.round(Number(n ?? 0)).toLocaleString("es-MX")}`;
}
function fecha(iso: string | null) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return "—";

  return new Date(y, m - 1, d).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
</script>

<template>
  <main class="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
    <NuxtLink
      to="/clients"
      class="inline-block text-xs font-bold uppercase tracking-widest text-muted transition-colors hover:text-gold"
    >
      ← Volver a clientes
    </NuxtLink>

    <BrandStatePanel
      v-if="pending"
      mascot="bladebot"
      state="waiting"
      title="Cargando la ficha del cliente…"
    />
    <BrandStatePanel
      v-else-if="error"
      mascot="bruno"
      state="error"
      tone="danger"
      title="No se pudo cargar la ficha"
      description="Verifica que el cliente siga existiendo e inténtalo de nuevo."
    />

    <template v-else-if="client">
      <!-- Identidad + lealtad -->
      <header class="ui-card p-5 sm:p-6">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div class="min-w-0">
            <h1 class="text-2xl font-black text-ink">{{ client.name ?? "—" }}</h1>
            <p class="mt-1 truncate text-sm text-muted">{{ client.email ?? "—" }}</p>
            <p v-if="client.telefono" class="text-sm text-muted">
              <a :href="`tel:${client.telefono.replace(/\s+/g, '')}`" class="transition-colors hover:text-gold">
                {{ client.telefono }}
              </a>
            </p>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <span
              v-if="client.segment"
              class="rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-gold"
            >
              {{ SEGMENT_LABEL[client.segment] ?? client.segment }}
            </span>
            <span
              v-if="client.nivel"
              class="rounded-full border border-line px-3 py-1 text-[10px] font-black uppercase tracking-widest text-ink"
            >
              Nivel {{ client.nivel }}
            </span>
            <span
              class="rounded-full border border-line px-3 py-1 text-[10px] font-black uppercase tracking-widest text-muted"
            >
              {{ client.puntos }} pts
            </span>
          </div>
        </div>
      </header>

      <!-- Métricas reales, todas calculadas en el backend -->
      <section class="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <div class="ui-card p-4">
          <p class="text-[10px] font-bold uppercase tracking-widest text-muted">Citas</p>
          <p class="mt-1 text-xl font-black text-ink">{{ client.totalAppointments }}</p>
        </div>
        <div class="ui-card p-4">
          <p class="text-[10px] font-bold uppercase tracking-widest text-muted">Gasto total</p>
          <p class="mt-1 text-xl font-black text-gold">{{ money(client.totalSpent) }}</p>
        </div>
        <div class="ui-card p-4">
          <p class="text-[10px] font-bold uppercase tracking-widest text-muted">Ticket promedio</p>
          <p class="mt-1 text-xl font-black text-ink">{{ money(client.averageSpent) }}</p>
        </div>
        <div class="ui-card p-4">
          <p class="text-[10px] font-bold uppercase tracking-widest text-muted">Última visita</p>
          <p class="mt-1 text-sm font-black text-ink">{{ fecha(client.lastAppointment) }}</p>
          <p v-if="client.daysSinceLastAppointment !== null" class="text-[10px] text-muted">
            hace {{ client.daysSinceLastAppointment }} días
          </p>
        </div>
        <div class="ui-card p-4">
          <p class="text-[10px] font-bold uppercase tracking-widest text-muted">Barbero preferido</p>
          <p class="mt-1 truncate text-sm font-black text-ink">{{ client.preferredBarber ?? "—" }}</p>
        </div>
      </section>

      <!-- Notas del staff -->
      <section class="ui-card p-5">
        <h2 class="text-sm font-black uppercase tracking-widest text-ink">Notas del equipo</h2>
        <p class="mt-1 text-xs text-muted">
          Alergias, tipo de corte, acuerdos. Solo las ve el equipo de la barbería.
        </p>
        <label class="sr-only" for="notas-cliente">Notas del equipo sobre este cliente</label>
        <textarea
          id="notas-cliente"
          v-model="notas"
          rows="4"
          maxlength="2000"
          class="mt-3 w-full rounded-xl border border-line bg-main p-3 text-sm text-ink"
          placeholder="Ej. Prefiere fade bajo. Alérgico al after shave con alcohol."
        />
        <div class="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            class="ui-btn min-h-11 px-5 py-2 text-[11px] tracking-widest disabled:opacity-50"
            :disabled="savingNotas || !notasSucias"
            @click="guardarNotas"
          >
            {{ savingNotas ? "Guardando…" : "Guardar notas" }}
          </button>
          <span v-if="notasGuardadas && !notasSucias" class="text-xs font-bold text-emerald-400">
            Notas guardadas
          </span>
          <span v-if="notasError" role="alert" class="text-xs font-bold text-red-400">
            {{ notasError }}
          </span>
        </div>
      </section>

      <!-- Historial -->
      <section class="ui-card overflow-x-auto">
        <h2 class="px-5 pt-5 text-sm font-black uppercase tracking-widest text-ink">
          Historial de citas
        </h2>
        <BrandStatePanel
          v-if="!client.appointments.length"
          class="m-5"
          mascot="nava"
          state="empty"
          title="Sin citas todavía"
          description="Cuando este cliente reserve, su historial aparecerá aquí."
        />
        <table v-else class="mt-4 w-full text-left text-sm">
          <thead class="border-b border-line text-[10px] uppercase tracking-widest text-muted">
            <tr>
              <th class="px-5 py-3">Fecha</th>
              <th class="px-5 py-3">Hora</th>
              <th class="px-5 py-3">Servicio</th>
              <th class="px-5 py-3">Barbero</th>
              <th class="px-5 py-3 text-center">Estado</th>
              <th class="px-5 py-3 text-right">Precio</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="appt in client.appointments"
              :key="appt.id"
              class="border-b border-line/60 last:border-0"
            >
              <td class="px-5 py-3 text-ink">{{ fecha(appt.fecha) }}</td>
              <td class="px-5 py-3 text-muted">{{ appt.hora_inicio?.slice(0, 5) ?? "—" }}</td>
              <td class="px-5 py-3 text-muted">{{ appt.service ?? "—" }}</td>
              <td class="px-5 py-3 text-muted">{{ appt.barber ?? "—" }}</td>
              <td class="px-5 py-3 text-center">
                <span
                  class="rounded-full border px-2 py-0.5 text-[10px] font-black"
                  :class="ESTADO_CLASS[appt.estado]"
                >{{ ESTADO_LABEL[appt.estado] ?? appt.estado }}</span>
              </td>
              <td class="px-5 py-3 text-right font-bold text-ink">
                {{ appt.precio ? money(appt.precio) : "—" }}
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    </template>
  </main>
</template>
