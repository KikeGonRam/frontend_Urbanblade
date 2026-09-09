<script setup lang="ts">
/*
 * Fase 9.2 del plan (ver .claude/skills/nuxt-migration-plan/SKILL.md) —
 * como en 9.1, no hay página Inertia/Vue de referencia: appointments/
 * index.blade.php en barber sigue siendo Blade puro. Construida contra
 * Api/Appointment/AppointmentController, enriquecido en esta misma fase con
 * filtros opcionales (estado/barber_id/fecha) que antes no existían.
 *
 * Las tarjetas de resumen del Blade original (Total/Hoy/Pendientes/
 * Completadas) se omiten a propósito: son agregados globales que el
 * controlador Blade calcula con queries dedicadas, pero la API solo
 * devuelve como máximo 50 citas — mostrar un conteo "Total" calculado
 * sobre esas 50 sería un número falso, no una limitación cosmética.
 */
definePageMeta({ middleware: ["auth", "staff"], layout: "dashboard" });

interface AppointmentRow {
  id: string;
  code: string | null;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  estado: string;
  notas: string | null;
  precio_cobrado: number | null;
  client: { id: string | null; user: { name: string | null } };
  barber: {
    id: string | null;
    slug: string | null;
    user: { name: string | null };
  };
  service: {
    id: string | null;
    nombre: string | null;
    precio: number | null;
    duracion_min: number | null;
  };
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
const ESTADOS = Object.keys(ESTADO_LABEL);

const { apiFetch } = useApi();
const { confirm } = useConfirm();
const route = useRoute();
const router = useRouter();

const estadoFilter = ref("");
const barberFilter = ref("");

const {
  data: response,
  pending,
  error,
  refresh,
} = await useAsyncData(
  buildDataKey("appointments-list", {
    estado: estadoFilter.value || undefined,
    barber_id: barberFilter.value || undefined,
  }),
  () =>
    apiFetch<{ data: AppointmentRow[] }>("/appointments", {
      query: {
        estado: estadoFilter.value || undefined,
        barber_id: barberFilter.value || undefined,
      },
    }),
  { watch: [estadoFilter, barberFilter], lazy: true },
);
const appointments = computed(() => response.value?.data ?? []);

interface Barber {
  id: string;
  name: string;
}
interface Service {
  id: string;
  nombre: string;
  precio: number;
  duracion_min: number;
}
interface ClientOption {
  id: string;
  name: string;
  email: string;
}

const { data: barbersRes } = await useAsyncData(
  "appointments-barbers",
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

const { data: servicesRes } = await useAsyncData(
  "appointments-services",
  () => apiFetch<{ data: Service[] }>("/services"),
  { lazy: true },
);
const services = computed(() => servicesRes.value?.data ?? []);

// ── Buscador de cliente (debounced) ─────────────────────────────────────
const clientQuery = ref("");
const clientOptions = ref<ClientOption[]>([]);
let clientSearchTimer: ReturnType<typeof setTimeout> | undefined;
watch(clientQuery, (q) => {
  clearTimeout(clientSearchTimer);
  if (!q || q.length < 2) {
    clientOptions.value = [];
    return;
  }
  clientSearchTimer = setTimeout(async () => {
    try {
      const res = await apiFetch<{
        data: Array<{
          id: string;
          user: { name: string; email: string } | null;
        }>;
      }>("/clients", { query: { q } });
      clientOptions.value = res.data.map((c) => ({
        id: c.id,
        name: c.user?.name ?? "Cliente",
        email: c.user?.email ?? "",
      }));
    } catch {
      clientOptions.value = [];
    }
  }, 350);
});

// ── Crear / editar ───────────────────────────────────────────────────────
const showForm = ref(false);
const editing = ref<AppointmentRow | null>(null);
const form = reactive({
  client_id: "",
  client_label: "",
  barber_id: "",
  service_id: "",
  fecha: "",
  hora_inicio: "",
  estado: "pendiente",
  notas: "",
});
const formError = ref("");
const actionError = ref("");
const saving = ref(false);

// ── Disponibilidad (guía, no restricción) ─────────────────────────────────
// A diferencia del modal del cliente (pages/my/appointments), aquí la hora
// sigue siendo un campo libre a propósito: recepción necesita poder capturar
// una cita que se acordó por teléfono o encajar un hueco fuera del horario
// calculado. Los horarios libres se ofrecen como sugerencia (datalist) y se
// avisa cuando la hora escrita no está entre ellos, pero nunca se bloquea el
// envío -- la última palabra la sigue teniendo el backend (índice único de
// Fase 3 + el 422 de AppointmentController::store()).
interface Slot {
  time: string;
  label: string;
}

const slots = ref<Slot[]>([]);
const slotsLoaded = ref(false);

async function loadSlots() {
  if (!form.barber_id || !form.service_id || !form.fecha) {
    slots.value = [];
    slotsLoaded.value = false;

    return;
  }

  try {
    const res = await apiFetch<{ slots: Slot[] }>("/availability/slots", {
      query: {
        barber_id: form.barber_id,
        service_id: form.service_id,
        date: form.fecha,
      },
    });
    slots.value = res.slots ?? [];
    slotsLoaded.value = true;
  } catch {
    // Sin sugerencias, pero el campo sigue siendo usable.
    slots.value = [];
    slotsLoaded.value = false;
  }
}

watch(() => [form.barber_id, form.service_id, form.fecha], loadSlots);

// Al editar, la cita ocupa su propio horario, así que el backend lo reporta
// tomado; no debe salir como advertencia.
const horaOcupada = computed(() => {
  if (!slotsLoaded.value || !form.hora_inicio) return false;
  if (editing.value?.hora_inicio?.slice(0, 5) === form.hora_inicio)
    return false;

  return !slots.value.some((s) => s.time === form.hora_inicio);
});

function openCreate() {
  editing.value = null;
  form.client_id = "";
  form.client_label = "";
  form.barber_id = "";
  form.service_id = "";
  form.fecha = "";
  form.hora_inicio = "";
  form.estado = "pendiente";
  form.notas = "";
  clientQuery.value = "";
  clientOptions.value = [];
  formError.value = "";
  showForm.value = true;
}

function openEdit(appt: AppointmentRow) {
  editing.value = appt;
  form.client_id = appt.client.id ?? "";
  form.client_label = appt.client.user.name ?? "";
  form.barber_id = appt.barber.id ?? "";
  form.service_id = appt.service.id ?? "";
  form.fecha = appt.fecha;
  form.hora_inicio = appt.hora_inicio?.slice(0, 5) ?? "";
  form.estado = appt.estado;
  form.notas = appt.notas ?? "";
  clientQuery.value = "";
  clientOptions.value = [];
  formError.value = "";
  showForm.value = true;
}

function pickClient(c: ClientOption) {
  form.client_id = c.id;
  form.client_label = `${c.name} (${c.email})`;
  clientQuery.value = "";
  clientOptions.value = [];
}

async function submitForm() {
  saving.value = true;
  formError.value = "";
  try {
    if (editing.value) {
      // Appointment usa HasPublicCode -> getRouteKeyName() = 'code', no
      // 'id' — mismo gotcha que Client/Barber/Service con HasSlug (ver
      // .claude/skills/nuxt-migration-plan/SKILL.md, Fase 9.1/9.2).
      await apiFetch(`/appointments/${editing.value.code}`, {
        method: "PUT",
        body: {
          client_id: form.client_id,
          barber_id: form.barber_id,
          service_id: form.service_id,
          fecha: form.fecha,
          hora_inicio: form.hora_inicio,
          estado: form.estado,
          notas: form.notas || undefined,
        },
      });
    } else {
      await apiFetch("/appointments", {
        method: "POST",
        body: {
          client_id: form.client_id,
          barber_id: form.barber_id,
          service_id: form.service_id,
          fecha: form.fecha,
          hora_inicio: form.hora_inicio,
          estado: form.estado,
          notas: form.notas || undefined,
        },
      });
    }
    showForm.value = false;
    await refresh();
  } catch (err: unknown) {
    formError.value =
      (err as { data?: { message?: string } })?.data?.message ??
      "No se pudo guardar. Verifica los datos.";
  } finally {
    saving.value = false;
  }
}

async function cancelAppointment(appt: AppointmentRow) {
  const accepted = await confirm({
    title: "Cancelar cita",
    message: `¿Cancelar la cita de ${appt.client.user.name ?? "este cliente"}?`,
    confirmText: "Sí, cancelar",
    isDanger: true,
  });
  if (!accepted) return;

  actionError.value = "";
  try {
    await apiFetch(`/appointments/${appt.code}`, {
      method: "PUT",
      body: {
        client_id: appt.client.id,
        barber_id: appt.barber.id,
        service_id: appt.service.id,
        fecha: appt.fecha,
        hora_inicio: appt.hora_inicio?.slice(0, 5),
        estado: "cancelada",
        notas: appt.notas ?? undefined,
      },
    });
    await refresh();
  } catch (err: unknown) {
    actionError.value =
      (err as { data?: { message?: string } })?.data?.message ??
      "No se pudo cancelar la cita.";
  }
}

// Deep-link desde el modal de Calendar.vue: /appointments?edit={id} abre el
// formulario de edición directo, cerrando el hueco que antes dejaba
// modal.editUrl sin destino.
onMounted(() => {
  const editId = route.query.edit;
  if (typeof editId === "string") {
    const target = appointments.value.find((a) => a.id === editId);
    if (target) openEdit(target);
    router.replace({ query: {} });
  }
});

onBeforeUnmount(() => {
  if (clientSearchTimer) {
    clearTimeout(clientSearchTimer);
    clientSearchTimer = undefined;
  }
});
</script>

<template>
  <div class="p-4 sm:p-6 lg:p-8">
    <header
      class="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div>
        <p class="text-sm uppercase tracking-widest text-muted">UrbanBlade</p>
        <h1 class="mt-1 text-2xl font-semibold text-ink">
          Citas & <span class="text-gold">Reservas</span>
        </h1>
        <p class="mt-1 text-sm text-muted">
          Gestiona la agenda completa de la barbería.
        </p>
      </div>
      <button
        type="button"
        class="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-black hover:bg-gold-dim"
        @click="openCreate"
      >
        + Nueva Cita
      </button>
    </header>

    <section class="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
      <select
        v-model="estadoFilter"
        class="rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink"
      >
        <option value="">Todos los estados</option>
        <option v-for="e in ESTADOS" :key="e" :value="e">
          {{ ESTADO_LABEL[e] }}
        </option>
      </select>
      <select
        v-model="barberFilter"
        class="rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink"
      >
        <option value="">Todos los barberos</option>
        <option v-for="b in barbers" :key="b.id" :value="b.id">
          {{ b.name }}
        </option>
      </select>
      <button
        v-if="estadoFilter || barberFilter"
        type="button"
        class="text-xs font-bold uppercase tracking-widest text-muted hover:text-ink"
        @click="
          estadoFilter = '';
          barberFilter = '';
        "
      >
        Limpiar filtros
      </button>
      <span class="text-xs text-muted sm:ml-auto"
        >Mostrando hasta 50 citas más recientes.</span
      >
    </section>

    <p v-if="pending" class="text-sm text-muted">Cargando citas…</p>
    <p v-else-if="error" class="text-sm text-red-400">
      No se pudo cargar la lista de citas.
    </p>
    <p v-if="actionError" role="alert" class="mb-4 text-sm text-red-400">
      {{ actionError }}
    </p>

    <section v-else class="ui-card overflow-x-auto">
      <table class="w-full text-left text-sm">
        <thead>
          <tr
            class="border-b border-line text-[10px] uppercase tracking-wider text-muted"
          >
            <th class="px-4 py-3">Fecha</th>
            <th class="px-4 py-3">Hora</th>
            <th class="px-4 py-3">Cliente</th>
            <th class="px-4 py-3">Servicio</th>
            <th class="px-4 py-3">Barbero</th>
            <th class="px-4 py-3 text-center">Estado</th>
            <th class="px-4 py-3 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="appt in appointments"
            :key="appt.id"
            class="border-b border-line/60 last:border-0"
          >
            <td class="px-4 py-3 text-ink">{{ appt.fecha }}</td>
            <td class="px-4 py-3 text-muted">
              {{ appt.hora_inicio?.slice(0, 5) }}
            </td>
            <td class="px-4 py-3 font-bold text-ink">
              {{ appt.client.user.name ?? "—" }}
            </td>
            <td class="px-4 py-3 text-muted">
              {{ appt.service.nombre ?? "—" }}
            </td>
            <td class="px-4 py-3 text-muted">
              {{ appt.barber.user.name ?? "—" }}
            </td>
            <td class="px-4 py-3 text-center">
              <span
                class="rounded-full border px-2 py-0.5 text-[10px] font-black"
                :class="ESTADO_CLASS[appt.estado]"
                >{{ ESTADO_LABEL[appt.estado] ?? appt.estado }}</span
              >
            </td>
            <td class="px-4 py-3">
              <div class="flex justify-end gap-2">
                <button
                  type="button"
                  class="rounded-lg border border-line px-3 py-1 text-xs text-muted hover:text-ink"
                  @click="openEdit(appt)"
                >
                  Editar
                </button>
                <button
                  v-if="
                    appt.estado !== 'cancelada' && appt.estado !== 'completada'
                  "
                  type="button"
                  class="rounded-lg border border-red-500/20 px-3 py-1 text-xs text-red-400 hover:bg-red-500/10"
                  @click="cancelAppointment(appt)"
                >
                  Cancelar
                </button>
              </div>
            </td>
          </tr>
          <tr v-if="!appointments.length">
            <td colspan="7" class="px-4 py-12 text-center text-sm text-muted">
              Sin citas que mostrar.
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <div
      v-if="showForm"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      @click.self="showForm = false"
    >
      <div
        class="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-line bg-card p-6"
      >
        <h2 class="mb-4 text-lg font-semibold text-ink">
          {{ editing ? "Editar cita" : "Nueva cita" }}
        </h2>
        <form class="space-y-3" @submit.prevent="submitForm">
          <div>
            <label class="mb-1 block text-xs text-muted">Cliente</label>
            <div
              v-if="form.client_label"
              class="flex items-center justify-between rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink"
            >
              <span>{{ form.client_label }}</span>
              <button
                type="button"
                class="text-xs text-muted hover:text-ink"
                @click="
                  form.client_id = '';
                  form.client_label = '';
                "
              >
                Cambiar
              </button>
            </div>
            <template v-else>
              <input
                v-model="clientQuery"
                type="text"
                placeholder="Buscar por nombre o email…"
                class="w-full rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink"
              >
              <ul
                v-if="clientOptions.length"
                class="mt-1 max-h-40 overflow-y-auto rounded-lg border border-line bg-main"
              >
                <li v-for="c in clientOptions" :key="c.id">
                  <button
                    type="button"
                    class="block w-full px-3 py-2 text-left text-sm text-ink hover:bg-accent"
                    @click="pickClient(c)"
                  >
                    {{ c.name }} <span class="text-muted">({{ c.email }})</span>
                  </button>
                </li>
              </ul>
            </template>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="mb-1 block text-xs text-muted">Barbero</label>
              <select
                v-model="form.barber_id"
                required
                class="w-full rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink"
              >
                <option value="" disabled>Selecciona…</option>
                <option v-for="b in barbers" :key="b.id" :value="b.id">
                  {{ b.name }}
                </option>
              </select>
            </div>
            <div>
              <label class="mb-1 block text-xs text-muted">Servicio</label>
              <select
                v-model="form.service_id"
                required
                class="w-full rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink"
              >
                <option value="" disabled>Selecciona…</option>
                <option v-for="s in services" :key="s.id" :value="s.id">
                  {{ s.nombre }} — ${{ s.precio }}
                </option>
              </select>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="mb-1 block text-xs text-muted">Fecha</label>
              <input
                v-model="form.fecha"
                type="date"
                required
                class="w-full rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink"
              >
            </div>
            <div>
              <label class="mb-1 block text-xs text-muted">Hora</label>
              <input
                v-model="form.hora_inicio"
                type="time"
                required
                list="horarios-libres"
                class="w-full rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink"
              >
              <datalist id="horarios-libres">
                <option
                  v-for="slot in slots"
                  :key="slot.time"
                  :value="slot.time"
                >
                  {{ slot.label }}
                </option>
              </datalist>
              <p v-if="horaOcupada" class="mt-1 text-xs text-amber-400">
                Ese horario no aparece libre para este barbero. Puedes
                continuar; el sistema lo rechazará si ya está tomado.
              </p>
              <p v-else-if="slotsLoaded" class="mt-1 text-xs text-muted">
                {{ slots.length }} horario(s) libre(s) ese día.
              </p>
            </div>
          </div>
          <div>
            <label class="mb-1 block text-xs text-muted">Estado</label>
            <select
              v-model="form.estado"
              class="w-full rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink"
            >
              <option v-for="e in ESTADOS" :key="e" :value="e">
                {{ ESTADO_LABEL[e] }}
              </option>
            </select>
          </div>
          <div>
            <label class="mb-1 block text-xs text-muted">Notas</label>
            <textarea
              v-model="form.notas"
              rows="2"
              class="w-full rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink"
            />
          </div>
          <p v-if="formError" class="text-sm text-red-400">{{ formError }}</p>
          <div class="mt-5 flex gap-3">
            <button
              type="submit"
              :disabled="saving || !form.client_id"
              class="flex-1 rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-black hover:bg-gold-dim disabled:opacity-50"
            >
              {{ saving ? "Guardando…" : "Guardar" }}
            </button>
            <button
              type="button"
              class="rounded-lg border border-line px-4 py-2 text-sm text-muted hover:text-ink"
              @click="showForm = false"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
