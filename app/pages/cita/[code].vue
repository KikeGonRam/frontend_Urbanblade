<script setup lang="ts">
/*
 * Gestión de cita por el enlace del recordatorio (P1 de
 * urbanblade-market-web): ver, mover o cancelar SU cita sin iniciar sesión.
 *
 * Antes el recordatorio mandaba a /my/appointments, detrás de middleware
 * ['auth','client']: quien no recordaba su contraseña simplemente no entraba,
 * y eso termina en no-show. Aquí la autorización es el token opaco de la
 * propia cita (?t=), que el backend valida contra ESA cita y deja de servir
 * en cuanto la cita empieza.
 *
 * El backend sigue siendo la autoridad: esta pantalla solo oculta botones
 * que el servidor rechazaría (puede_gestionar / dentro_de_politica) y muestra
 * su 422 literal cuando aun así responde que no.
 */
definePageMeta({ layout: "public" });

interface Cita {
  code: string;
  fecha: string | null;
  hora_inicio: string | null;
  estado: string;
  servicio: string | null;
  duracion_min: number | null;
  precio: number | null;
  barbero: string | null;
  barber_id: string;
  service_id: string;
  politica_horas: number;
  puede_gestionar: boolean;
  dentro_de_politica: boolean;
}
interface Slot {
  time: string;
  label: string;
}

const ESTADO_LABEL: Record<string, string> = {
  pendiente: "Pendiente de confirmar",
  confirmada: "Confirmada",
  en_proceso: "En proceso",
  completada: "Completada",
  cancelada: "Cancelada",
  no_asistio: "No asistió",
};

const route = useRoute();
const { apiFetch } = useApi();

const code = computed(() => String(route.params.code ?? ""));
const token = computed(() =>
  typeof route.query.t === "string" ? route.query.t : "",
);

const {
  data: response,
  pending,
  error,
  refresh,
} = await useAsyncData(
  () => `cita-${code.value}`,
  () =>
    apiFetch<{ data: Cita }>(`/appointments/${code.value}/manage`, {
      query: { t: token.value },
    }),
  // server: false a propósito: el token de gestión viaja en la URL, y
  // resolver esto en SSR lo metería en el proceso de Nitro (logs, trazas,
  // cualquier caché intermedia). Es un enlace privado, se resuelve en el
  // navegador de quien lo abrió.
  { server: false },
);
const cita = computed(() => response.value?.data ?? null);

useSeoMeta({
  title: "Tu cita — UrbanBlade",
  // Un enlace privado no debe quedar indexado ni aparecer en buscadores.
  robots: "noindex, nofollow",
});

const accionError = ref("");
const mensajeOk = ref("");
const working = ref(false);

// ── Cancelar ──────────────────────────────────────────────────────────────
const confirmandoCancelar = ref(false);

async function cancelar() {
  working.value = true;
  accionError.value = "";
  try {
    await apiFetch(`/appointments/${code.value}/manage/cancel`, {
      method: "POST",
      query: { t: token.value },
    });
    mensajeOk.value = "Tu cita fue cancelada. ¡Esperamos verte pronto!";
    confirmandoCancelar.value = false;
    await refresh();
  } catch (err: unknown) {
    accionError.value =
      (err as { data?: { message?: string } })?.data?.message ??
      "No se pudo cancelar la cita.";
  } finally {
    working.value = false;
  }
}

// ── Reagendar ─────────────────────────────────────────────────────────────
const moviendo = ref(false);
const nuevaFecha = ref("");
const nuevaHora = ref("");
const slots = ref<Slot[]>([]);
const slotsPending = ref(false);
const slotsFailed = ref(false);

function localISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const dias = computed(() =>
  Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);

    return {
      iso: localISO(d),
      weekday: d.toLocaleDateString("es-MX", { weekday: "short" }),
      day: d.getDate(),
      month: d.toLocaleDateString("es-MX", { month: "short" }),
      isToday: i === 0,
    };
  }),
);

async function cargarSlots() {
  if (!nuevaFecha.value || !cita.value) {
    slots.value = [];

    return;
  }
  slotsPending.value = true;
  slotsFailed.value = false;
  try {
    // Misma disponibilidad pública que usa /reservar: el horario ofrecido
    // siempre sale del backend, nunca de una lista inventada aquí.
    const res = await apiFetch<{ slots: Slot[] }>("/availability/slots", {
      query: {
        barber_id: cita.value.barber_id,
        service_id: cita.value.service_id,
        date: nuevaFecha.value,
      },
    });
    slots.value = res.slots ?? [];
    if (nuevaHora.value && !slots.value.some((s) => s.time === nuevaHora.value)) {
      nuevaHora.value = "";
    }
  } catch {
    slotsFailed.value = true;
    slots.value = [];
  } finally {
    slotsPending.value = false;
  }
}
watch(nuevaFecha, cargarSlots);

async function reagendar() {
  if (!nuevaFecha.value || !nuevaHora.value) return;
  working.value = true;
  accionError.value = "";
  try {
    await apiFetch(`/appointments/${code.value}/manage/reschedule`, {
      method: "POST",
      query: { t: token.value },
      body: { fecha: nuevaFecha.value, hora_inicio: nuevaHora.value },
    });
    mensajeOk.value =
      "Listo, movimos tu cita. La barbería la confirmará en breve.";
    moviendo.value = false;
    nuevaFecha.value = "";
    nuevaHora.value = "";
    await refresh();
  } catch (err: unknown) {
    accionError.value =
      (err as { data?: { message?: string } })?.data?.message ??
      "No se pudo mover la cita.";
    await cargarSlots();
  } finally {
    working.value = false;
  }
}

function fechaLarga(iso: string | null) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return "—";

  return new Date(y, m - 1, d).toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}
function money(n: number | null) {
  return n === null ? "" : `$${Math.round(Number(n)).toLocaleString("es-MX")}`;
}
</script>

<template>
  <div class="mx-auto max-w-2xl px-4 py-10 sm:px-6">
    <BrandStatePanel
      v-if="pending"
      mascot="bladebot"
      state="waiting"
      title="Buscando tu cita…"
    />

    <!-- El backend responde 404 tanto si el enlace es inválido como si ya
         venció: aquí se explica en términos que el cliente entienda. -->
    <BrandStatePanel
      v-else-if="error"
      mascot="nava"
      state="lost"
      title="Este enlace ya no es válido"
      description="Puede haber vencido o la cita ya pasó. Escríbenos y con gusto te ayudamos."
    />

    <template v-else-if="cita">
      <header class="mb-6 text-center">
        <p class="text-[10px] font-black uppercase tracking-[0.2em] text-gold">
          Tu cita
        </p>
        <h1 class="mt-2 text-2xl font-black uppercase tracking-tight text-ink">
          {{ fechaLarga(cita.fecha) }}
        </h1>
        <p class="mt-1 text-sm text-muted">
          {{ cita.hora_inicio?.slice(0, 5) }} · {{ cita.servicio }}
          <span v-if="cita.precio"> · {{ money(cita.precio) }}</span>
        </p>
      </header>

      <section class="ui-card p-5">
        <dl class="space-y-3 text-sm">
          <div class="flex justify-between">
            <dt class="text-muted">Barbero</dt>
            <dd class="font-bold text-ink">{{ cita.barbero ?? "—" }}</dd>
          </div>
          <div class="flex justify-between">
            <dt class="text-muted">Estado</dt>
            <dd class="font-bold text-ink">
              {{ ESTADO_LABEL[cita.estado] ?? cita.estado }}
            </dd>
          </div>
          <div class="flex justify-between">
            <dt class="text-muted">Código</dt>
            <dd class="font-black tracking-widest text-gold">{{ cita.code }}</dd>
          </div>
        </dl>

        <p v-if="mensajeOk" role="status" class="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm font-bold text-emerald-300">
          {{ mensajeOk }}
        </p>
        <p v-if="accionError" role="alert" class="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm font-bold text-red-300">
          {{ accionError }}
        </p>

        <!-- Fuera de política: se dice por qué y a dónde acudir, en vez de
             mostrar botones que el servidor va a rechazar. -->
        <p
          v-if="cita.puede_gestionar && !cita.dentro_de_politica"
          class="mt-4 rounded-xl border border-dashed border-line p-4 text-sm text-muted"
        >
          Los cambios se hacen con al menos {{ cita.politica_horas }} horas de
          anticipación. Comunícate con la barbería y lo vemos contigo.
        </p>

        <div
          v-else-if="cita.puede_gestionar"
          class="mt-5 flex flex-col gap-3 sm:flex-row"
        >
          <button
            type="button"
            class="ui-btn min-h-11 flex-1 py-3 text-[11px] tracking-widest"
            :disabled="working"
            @click="moviendo = !moviendo; confirmandoCancelar = false"
          >
            {{ moviendo ? "Cerrar" : "Mover mi cita" }}
          </button>
          <button
            type="button"
            class="min-h-11 flex-1 rounded-xl border border-red-500/30 py-3 text-[11px] font-black uppercase tracking-widest text-red-400 transition-colors hover:bg-red-500/10"
            :disabled="working"
            @click="confirmandoCancelar = true; moviendo = false"
          >
            Cancelar cita
          </button>
        </div>
      </section>

      <!-- Confirmación de cancelación: una acción irreversible no se dispara
           con un solo toque. -->
      <section v-if="confirmandoCancelar" class="ui-card mt-4 p-5">
        <h2 class="text-sm font-black uppercase tracking-widest text-ink">
          ¿Cancelar tu cita?
        </h2>
        <p class="mt-1 text-sm text-muted">
          Se liberará tu horario del {{ fechaLarga(cita.fecha) }} a las
          {{ cita.hora_inicio?.slice(0, 5) }}.
        </p>
        <div class="mt-4 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            class="min-h-11 flex-1 rounded-xl border border-red-500/40 py-3 text-[11px] font-black uppercase tracking-widest text-red-300 transition-colors hover:bg-red-500/10 disabled:opacity-50"
            :disabled="working"
            @click="cancelar"
          >
            {{ working ? "Cancelando…" : "Sí, cancelar" }}
          </button>
          <button
            type="button"
            class="ui-btn-secondary min-h-11 flex-1 py-3 text-[11px] tracking-widest"
            :disabled="working"
            @click="confirmandoCancelar = false"
          >
            Conservar mi cita
          </button>
        </div>
      </section>

      <!-- Reagendar: mismo barbero y servicio, solo cambia el horario -->
      <section v-if="moviendo" class="ui-card mt-4 p-5">
        <h2 class="text-sm font-black uppercase tracking-widest text-ink">
          Elige un nuevo horario
        </h2>
        <p class="mt-1 text-xs text-muted">
          Con {{ cita.barbero }}, mismo servicio.
        </p>

        <div class="-mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pb-2" role="group" aria-label="Elegir día">
          <button
            v-for="d in dias"
            :key="d.iso"
            type="button"
            class="flex min-h-11 w-16 shrink-0 flex-col items-center justify-center rounded-xl border py-2 transition-colors"
            :class="nuevaFecha === d.iso ? 'border-gold bg-gold/10 text-gold' : 'border-line text-muted hover:border-gold/30'"
            :aria-pressed="nuevaFecha === d.iso"
            @click="nuevaFecha = d.iso; nuevaHora = ''"
          >
            <span class="text-[9px] font-black uppercase tracking-widest">{{ d.isToday ? "Hoy" : d.weekday }}</span>
            <span class="text-lg font-black leading-none text-ink" :class="nuevaFecha === d.iso && 'text-gold'">{{ d.day }}</span>
            <span class="text-[9px] uppercase">{{ d.month }}</span>
          </button>
        </div>

        <BrandStatePanel
          v-if="!nuevaFecha"
          class="mt-4"
          mascot="nava"
          state="empty"
          title="Elige un día"
          description="Te mostramos los horarios libres de ese día."
        />
        <BrandStatePanel v-else-if="slotsPending" class="mt-4" mascot="bladebot" state="waiting" title="Buscando horarios…" />
        <BrandStatePanel
          v-else-if="slotsFailed"
          class="mt-4"
          mascot="bruno"
          state="error"
          tone="danger"
          title="No se pudieron cargar los horarios"
          description="Revisa tu conexión e inténtalo nuevamente."
        />
        <BrandStatePanel
          v-else-if="!slots.length"
          class="mt-4"
          mascot="nava"
          state="empty"
          title="Sin horarios libres ese día"
          description="Prueba con otra fecha."
        />
        <div v-else class="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5">
          <button
            v-for="slot in slots"
            :key="slot.time"
            type="button"
            class="min-h-11 rounded-xl border px-2 py-2 text-sm font-bold transition-colors"
            :class="nuevaHora === slot.time ? 'border-gold bg-gold/10 text-gold' : 'border-line text-ink hover:border-gold/30'"
            :aria-pressed="nuevaHora === slot.time"
            @click="nuevaHora = slot.time"
          >
            {{ slot.time }}
          </button>
        </div>

        <button
          type="button"
          class="ui-btn mt-5 min-h-11 w-full py-3 text-[11px] tracking-widest disabled:opacity-50"
          :disabled="working || !nuevaHora"
          @click="reagendar"
        >
          {{ working ? "Moviendo…" : "Confirmar nuevo horario" }}
        </button>
      </section>

      <!-- Cita ya cerrada (cancelada, completada o pasada) -->
      <section v-if="!cita.puede_gestionar" class="mt-4 text-center">
        <p class="text-sm text-muted">
          Esta cita ya no se puede modificar desde aquí.
        </p>
        <NuxtLink to="/reservar" class="ui-btn mt-4 inline-flex px-8 py-3 text-[11px] tracking-widest">
          Reservar una nueva cita
        </NuxtLink>
      </section>
    </template>
  </div>
</template>
