<script setup lang="ts">
import type {
    CalendarOptions,
    EventClickArg,
    EventInput,
} from "@fullcalendar/core";
import { defineAsyncComponent, markRaw } from "vue";

const FullCalendar = defineAsyncComponent(async () => {
  const mod = await import("@fullcalendar/vue3");
  return mod.default ?? mod;
});

let _plugins: CalendarOptions["plugins"];
let _locale: CalendarOptions["locale"];
async function ensureCalendarDeps() {
  if (_plugins && _locale) return { plugins: _plugins, locale: _locale };
  const [dayGridMod, timeGridMod, listMod, interactionMod, localeMod] =
    await Promise.all([
      import("@fullcalendar/daygrid"),
      import("@fullcalendar/timegrid"),
      import("@fullcalendar/list"),
      import("@fullcalendar/interaction"),
      import("@fullcalendar/core/locales/es"),
    ]);
  _plugins = [
    markRaw(dayGridMod.default ?? dayGridMod),
    markRaw(timeGridMod.default ?? timeGridMod),
    markRaw(listMod.default ?? listMod),
    markRaw(interactionMod.default ?? interactionMod),
  ];
  _locale = localeMod.default ?? localeMod;
  return { plugins: _plugins, locale: _locale };
}

/*
 * Puerto de barber/resources/js/Pages/Appointments/Calendar.vue. Misma
 * librería, misma versión pinneada (6.1.21 — ver gotcha de compatibilidad en
 * .claude/skills/inertia-vue-migration/SKILL.md de ese repo). Diferencias
 * reales: el endpoint de datos ahora es la API JSON con Bearer token
 * (GET /appointments/calendar-data, agregado en esta fase — no existía antes
 * fuera de la ruta web con sesión), y el modal no tiene botón "Editar Cita"
 * porque /appointments/{id}/edit no existe en este frontend todavía.
 */
definePageMeta({ middleware: ["auth", "staff"], layout: "dashboard" });

interface Barber {
  id: string;
  name: string;
}
interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  color: string;
  textColor: string;
  extendedProps: {
    cliente: string;
    servicio: string;
    barbero: string;
    estado: string;
  };
}

const { apiFetch } = useApi();

type FcHandle = { getApi: () => { refetchEvents: () => void } };

const barbers = ref<Barber[]>([]);
const selectedBarber = ref("");
const fc = ref<FcHandle | null>(null);
const calendarReady = ref(false);
const calendarOptions = ref<CalendarOptions>({
  initialView: "dayGridMonth",
  headerToolbar: {
    left: "prev,next today",
    center: "title",
    right: "dayGridMonth,timeGridWeek,timeGridDay,listWeek",
  },
  buttonText: {
    today: "Hoy",
    month: "Mes",
    week: "Semana",
    day: "Día",
    list: "Lista",
  },
  height: "auto",
  slotMinTime: "08:00:00",
  slotMaxTime: "22:00:00",
  events: fetchEvents,
  eventClick: onEventClick,
  eventDidMount(info) {
    info.el.title = `${info.event.extendedProps.cliente} · ${info.event.extendedProps.servicio}`;
  },
  dayCellDidMount(info) {
    info.el.style.minHeight = "80px";
  },
});

onMounted(async () => {
  try {
    const [barbersRes, deps] = await Promise.all([
      apiFetch<{ data: Array<{ id: string; user: { name: string } | null }> }>(
        "/barbers",
      ).catch(() => null),
      ensureCalendarDeps(),
    ]);
    if (barbersRes) {
      barbers.value = barbersRes.data.map((b) => ({
        id: b.id,
        name: b.user?.name ?? "Barbero",
      }));
    }
    calendarOptions.value = {
      ...calendarOptions.value,
      plugins: deps.plugins,
      locale: deps.locale,
    };
    calendarReady.value = true;
  } catch {
    calendarReady.value = true;
  }
});

function refetchEvents() {
  fc.value?.getApi().refetchEvents();
}

async function fetchEvents(
  info: { startStr: string; endStr: string },
  successCallback: (events: EventInput[]) => void,
  failureCallback: (error: Error) => void,
) {
  try {
    const events = await apiFetch<CalendarEvent[]>(
      "/appointments/calendar-data",
      {
        query: {
          start: info.startStr,
          end: info.endStr,
          barber_id: selectedBarber.value || undefined,
        },
      },
    );
    successCallback(events);
  } catch (err) {
    failureCallback(err as Error);
  }
}

const legend = [
  { color: "#d97706", label: "Pendiente" },
  { color: "#3b82f6", label: "Confirmada" },
  { color: "#06b6d4", label: "En Proceso" },
  { color: "#10b981", label: "Completada" },
  { color: "#ef4444", label: "Cancelada" },
  { color: "#6b7280", label: "No Asistió" },
];

const modal = reactive({
  open: false,
  id: "",
  color: "",
  title: "",
  time: "",
  cliente: "",
  servicio: "",
  barbero: "",
});

function onEventClick(info: EventClickArg) {
  const p = info.event.extendedProps as CalendarEvent["extendedProps"];
  const start = info.event.start;
  const end = info.event.end;

  modal.id = info.event.id;
  modal.color = info.event.backgroundColor;
  modal.title = info.event.title;
  modal.time = start
    ? start.toLocaleDateString("es", {
        weekday: "long",
        day: "2-digit",
        month: "short",
      }) +
      " · " +
      start.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" }) +
      (end
        ? " – " +
          end.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })
        : "")
    : "";
  modal.cliente = p.cliente;
  modal.servicio = p.servicio;
  modal.barbero = p.barbero;
  modal.open = true;
}
</script>

<template>
  <div class="p-4 sm:p-6 lg:p-8">
    <header
      class="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div>
        <p class="text-sm uppercase tracking-widest text-muted">UrbanBlade</p>
        <h1 class="mt-1 text-2xl font-semibold text-ink">
          Calendario de <span class="text-gold">Citas</span>
        </h1>
        <p class="mt-1 text-sm text-muted">
          Vista mensual, semanal y diaria de la agenda.
        </p>
      </div>
    </header>

    <div class="space-y-5">
      <div
        class="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center"
      >
        <div class="flex flex-wrap gap-3">
          <span
            v-for="item in legend"
            :key="item.label"
            class="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted"
          >
            <span
              class="h-2.5 w-2.5 rounded-full"
              :style="{ background: item.color }"
            />
            {{ item.label }}
          </span>
        </div>

        <div class="flex items-center gap-3">
          <label
            class="text-[10px] font-black uppercase tracking-widest text-muted"
            >Barbero:</label
          >
          <select
            v-model="selectedBarber"
            class="min-w-[180px] rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink"
            @change="refetchEvents"
          >
            <option value="">Todos los barberos</option>
            <option v-for="b in barbers" :key="b.id" :value="b.id">
              {{ b.name }}
            </option>
          </select>
        </div>
      </div>

      <div class="ui-card-premium p-4 sm:p-6">
        <ClientOnly>
          <p v-if="!calendarReady" class="py-20 text-center text-sm text-muted">
            Cargando calendario…
          </p>
          <FullCalendar v-else ref="fc" :options="calendarOptions" />
        </ClientOnly>
      </div>

      <div
        v-if="modal.open"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
        @click.self="modal.open = false"
      >
        <div
          class="relative w-full max-w-md rounded-3xl border border-line bg-card p-8 shadow-[0_30px_80px_rgba(0,0,0,0.7)]"
        >
          <button
            aria-label="Cerrar"
            class="absolute right-4 top-4 text-muted transition hover:text-ink"
            @click="modal.open = false"
          >
            <svg
              class="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
          <div
            class="absolute inset-x-0 top-0 h-px rounded-t-3xl bg-gradient-to-r from-transparent via-gold/30 to-transparent"
          />

          <div
            class="mb-4 h-3 w-3 rounded-full"
            :style="{ background: modal.color }"
          />
          <h3 class="mb-1 text-xl font-black uppercase tracking-tight text-ink">
            {{ modal.title }}
          </h3>
          <p
            class="mb-6 text-[10px] font-bold uppercase tracking-widest text-muted"
          >
            {{ modal.time }}
          </p>

          <div class="space-y-4">
            <div class="flex items-center gap-3">
              <div
                class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gold/10 text-gold"
              >
                <svg
                  class="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
              </div>
              <div>
                <p
                  class="text-[9px] font-bold uppercase tracking-widest text-muted"
                >
                  Cliente
                </p>
                <p class="text-sm font-bold text-ink">{{ modal.cliente }}</p>
              </div>
            </div>
            <div class="flex items-center gap-3">
              <div
                class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gold/10 text-gold"
              >
                <svg
                  class="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="1.5"
                    d="M6 9a3 3 0 100-6 3 3 0 000 6zm0 12a3 3 0 100-6 3 3 0 000 6zm14-15L8.5 15M9 6l11 12"
                  />
                </svg>
              </div>
              <div>
                <p
                  class="text-[9px] font-bold uppercase tracking-widest text-muted"
                >
                  Servicio
                </p>
                <p class="text-sm font-bold text-ink">{{ modal.servicio }}</p>
              </div>
            </div>
            <div class="flex items-center gap-3">
              <div
                class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gold/10 text-gold"
              >
                <svg
                  class="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </div>
              <div>
                <p
                  class="text-[9px] font-bold uppercase tracking-widest text-muted"
                >
                  Barbero
                </p>
                <p class="text-sm font-bold text-ink">{{ modal.barbero }}</p>
              </div>
            </div>
          </div>

          <div class="mt-8 flex gap-3">
            <NuxtLink
              :to="`/appointments?edit=${modal.id}`"
              class="flex-1 rounded-xl bg-gold py-3 text-center text-[11px] font-black uppercase tracking-widest text-black transition-all hover:bg-gold-dim"
            >
              Editar Cita
            </NuxtLink>
            <button
              type="button"
              class="rounded-xl border border-line bg-ink/5 px-5 py-3 text-center text-[11px] font-black uppercase tracking-widest text-muted transition-all hover:text-ink"
              @click="modal.open = false"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
/*
 * FullCalendar theme overrides — portados de barber, pero usando las
 * variables CSS de nuestro sistema de temas en vez de hex fijos: el
 * original solo corría bajo el tema oscuro de Blade/Inertia, aquí los 4
 * temas son reales (ver el mismo gotcha ya corregido en charts/lealtad).
 * Sin scoped a propósito: los selectores :root / .fc-* deben aplicar
 * globalmente, igual que en el original.
 */
:root {
  --fc-border-color: var(--line);
  --fc-button-bg-color: var(--bg-card);
  --fc-button-border-color: var(--line);
  --fc-button-text-color: var(--muted);
  --fc-button-hover-bg-color: var(--gold);
  --fc-button-hover-border-color: var(--gold);
  --fc-button-hover-text-color: #000;
  --fc-button-active-bg-color: var(--gold);
  --fc-button-active-border-color: var(--gold);
  --fc-button-active-text-color: #000;
  --fc-today-bg-color: rgb(var(--gold-rgb) / 0.06);
  --fc-page-bg-color: transparent;
  --fc-neutral-bg-color: rgb(var(--ink-rgb) / 0.02);
  --fc-list-event-hover-bg-color: rgb(var(--gold-rgb) / 0.08);
}
.fc {
  color: var(--muted);
  font-family: "Figtree", sans-serif;
}
.fc-col-header-cell {
  background: rgb(var(--ink-rgb) / 0.02);
}
.fc-col-header-cell-cushion,
.fc-daygrid-day-number,
.fc-list-event-title {
  color: var(--muted) !important;
  text-decoration: none !important;
}
.fc-toolbar-title {
  font-weight: 900 !important;
  font-size: 1.1rem !important;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--ink);
}
.fc-event {
  cursor: pointer;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 700;
  padding: 1px 4px;
  border: none !important;
}
.fc-daygrid-day.fc-day-today .fc-daygrid-day-number {
  color: var(--gold) !important;
  font-weight: 900;
}
.fc-button {
  border-radius: 10px !important;
  font-size: 11px !important;
  font-weight: 900 !important;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  transition: all 0.2s !important;
}
.fc-h-event .fc-event-main {
  color: #fff;
}
</style>
