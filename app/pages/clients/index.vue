<script setup lang="ts">
/*
 * Fase 9.1 del plan (ver .claude/skills/nuxt-migration-plan/SKILL.md) — a
 * diferencia de las fases 1-7, no hay página Inertia/Vue de referencia:
 * clients/index.blade.php en barber sigue siendo Blade puro. Esta página se
 * construye directo desde el contrato de Api/Admin/Client/ClientAdminController,
 * que ya devuelve datos curados (segmento/totalGastado/totalCitas ya
 * calculados) — más rico que lo que muestra la tabla Blade, así que las
 * tarjetas de resumen usan segmentación (vip/nuevo/activo/inactivo) en vez
 * de los 4 contadores del Blade original (que requieren un cálculo distinto
 * no expuesto por esta API).
 */
definePageMeta({ middleware: ["auth", "admin"], layout: "dashboard" });

interface ClientRow {
  id: string;
  slug: string | null;
  name: string | null;
  email: string | null;
  telefono: string | null;
  segment: "vip" | "new" | "active" | "inactive";
  totalAppointments: number;
  totalSpent: number;
  lastAppointment: string | null;
  joinedAt: string | null;
}

interface ClientsResponse {
  success: boolean;
  data: ClientRow[];
  total: number;
  current_page?: number;
  last_page?: number;
  per_page?: number;
}

const SEGMENT_LABEL: Record<string, string> = {
  vip: "VIP",
  new: "Nuevo",
  active: "Activo",
  inactive: "Inactivo",
};
const SEGMENT_CLASS: Record<string, string> = {
  vip: "border-gold/25 bg-gold/10 text-gold",
  new: "border-blue-500/25 bg-blue-500/10 text-blue-400",
  active: "border-emerald-500/25 bg-emerald-500/10 text-emerald-400",
  inactive: "border-ink/10 bg-ink/5 text-muted",
};

const { apiFetch } = useApi();
const { confirm } = useConfirm();

const search = ref("");
const debouncedSearch = useDebounce(search, 350);
const segment = ref("");
const page = ref(1);

const {
  data: response,
  pending,
  error,
  refresh,
} = await useAsyncData<ClientsResponse>(
  "clients-list",
  () =>
    apiFetch<ClientsResponse>("/admin/clients", {
      query: {
        search: search.value || undefined,
        segment: segment.value || undefined,
        page: page.value,
        per_page: 15,
      },
    }),
  { watch: [debouncedSearch, segment, page], lazy: true },
);

const clients = computed(() => response.value?.data ?? []);
const lastPage = computed(() => response.value?.last_page ?? 1);

function resetAndSearch() {
  page.value = 1;
}

const { data: segmentation } = await useAsyncData(
  "clients-segmentation",
  () =>
    apiFetch<{
      success: boolean;
      data: Record<string, { count: number; percentage: number }>;
    }>("/admin/clients/segmentation/data"),
  { lazy: true },
);

const segmentCards = computed(() => {
  const d = segmentation.value?.data ?? {};

  return (["vip", "new", "active", "inactive"] as const).map((key) => ({
    key,
    label: SEGMENT_LABEL[key],
    count: d[key]?.count ?? 0,
  }));
});

// ── Crear / editar ──────────────────────────────────────────────────────
const showForm = ref(false);
const editing = ref<ClientRow | null>(null);
const form = reactive({ name: "", email: "", telefono: "", password: "" });
const formError = ref("");
const fieldErrors = ref<Record<string, string[]>>({});
const actionError = ref("");
const saving = ref(false);

function openCreate() {
  editing.value = null;
  form.name = "";
  form.email = "";
  form.telefono = "";
  form.password = "";
  formError.value = "";
  fieldErrors.value = {};
  showForm.value = true;
}

function openEdit(client: ClientRow) {
  editing.value = client;
  form.name = client.name ?? "";
  form.email = client.email ?? "";
  form.telefono = client.telefono ?? "";
  form.password = "";
  formError.value = "";
  fieldErrors.value = {};
  showForm.value = true;
}

async function submitForm() {
  saving.value = true;
  formError.value = "";
  fieldErrors.value = {};
  try {
    if (editing.value) {
      // La ruta liga por slug, no por id (Client usa HasSlug::getRouteKeyName()
      // -> 'slug') — usar editing.value.id aquí da 404 aunque el registro exista.
      await apiFetch(`/admin/clients/${editing.value.slug}`, {
        method: "PUT",
        body: { name: form.name, email: form.email, telefono: form.telefono },
      });
    } else {
      await apiFetch("/admin/clients", {
        method: "POST",
        body: {
          name: form.name,
          email: form.email,
          telefono: form.telefono,
          password: form.password,
        },
      });
    }
    showForm.value = false;
    await refresh();
  } catch (err: unknown) {
    const dataErr = (
      err as { data?: { message?: string; errors?: Record<string, string[]> } }
    )?.data;
    fieldErrors.value = dataErr?.errors ?? {};
    formError.value =
      dataErr?.message ?? "No se pudo guardar. Verifica los datos.";
  } finally {
    saving.value = false;
  }
}

async function removeClient(client: ClientRow) {
  const accepted = await confirm({
    title: "Eliminar cliente",
    message: `¿Eliminar a ${client.name ?? "este cliente"}? Esta acción no se puede deshacer.`,
    confirmText: "Sí, eliminar",
    isDanger: true,
  });
  if (!accepted) return;

  actionError.value = "";
  try {
    await apiFetch(`/admin/clients/${client.slug}`, { method: "DELETE" });
    await refresh();
  } catch (err: unknown) {
    actionError.value =
      (err as { data?: { message?: string } })?.data?.message ??
      "No se pudo eliminar el cliente.";
  }
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";

  return new Date(iso).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
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
          Gestión de <span class="text-gold">Clientes</span>
        </h1>
        <p class="mt-1 text-sm text-muted">
          Base de datos completa de clientes registrados.
        </p>
      </div>
      <button
        type="button"
        class="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-black hover:bg-gold-dim"
        @click="openCreate"
      >
        + Nuevo Cliente
      </button>
    </header>

    <section class="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
      <button
        v-for="card in segmentCards"
        :key="card.key"
        type="button"
        class="rounded-2xl border p-4 text-left transition"
        :class="
          segment === card.key
            ? 'border-gold/40 bg-gold/5'
            : 'border-line bg-card hover:border-gold-dim'
        "
        @click="
          segment = segment === card.key ? '' : card.key;
          resetAndSearch();
        "
      >
        <p
          class="mb-1 text-[10px] font-black uppercase tracking-wider text-muted"
        >
          {{ card.label }}
        </p>
        <p class="text-2xl font-black text-ink">{{ card.count }}</p>
      </button>
    </section>

    <section class="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
      <input
        v-model="search"
        type="text"
       placeholder="Nombre o email..."
        class="w-full rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink sm:max-w-xs"
        @input="resetAndSearch"
      />
      <button
        v-if="search || segment"
        type="button"
        class="text-xs font-bold uppercase tracking-widest text-muted hover:text-ink"
        @click="
          search = '';
          segment = '';
          resetAndSearch();
        "
      >
        Limpiar filtros
      </button>
    </section>

    <p v-if="pending" class="text-sm text-muted">Cargando clientes…</p>
    <p v-else-if="error" class="text-sm text-red-400">
      No se pudo cargar la lista de clientes.
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
            <th class="px-4 py-3">Cliente</th>
            <th class="px-4 py-3">Email</th>
            <th class="px-4 py-3">Teléfono</th>
            <th class="px-4 py-3 text-center">Segmento</th>
            <th class="px-4 py-3 text-center">Citas</th>
            <th class="px-4 py-3">Registrado</th>
            <th class="px-4 py-3 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="client in clients"
            :key="client.id"
            class="border-b border-line/60 last:border-0"
          >
            <td class="px-4 py-3">
              <div class="flex items-center gap-3">
                <div
                  class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line bg-ink/5 text-[10px] font-black text-ink"
                >
                  {{ (client.name ?? "CL").slice(0, 2).toUpperCase() }}
                </div>
                <span class="font-bold text-ink">{{
                  client.name ?? "Sin usuario"
                }}</span>
              </div>
            </td>
            <td class="px-4 py-3 text-muted">{{ client.email ?? "—" }}</td>
            <td class="px-4 py-3 text-muted">{{ client.telefono ?? "—" }}</td>
            <td class="px-4 py-3 text-center">
              <span
                class="rounded-full border px-2 py-0.5 text-[10px] font-black"
                :class="SEGMENT_CLASS[client.segment]"
                >{{ SEGMENT_LABEL[client.segment] }}</span
              >
            </td>
            <td class="px-4 py-3 text-center text-ink">
              {{ client.totalAppointments }}
            </td>
            <td class="px-4 py-3 text-muted">{{ fmtDate(client.joinedAt) }}</td>
            <td class="px-4 py-3">
              <div v-if="client.slug" class="flex justify-end gap-2">
                <button
                  type="button"
                  class="rounded-lg border border-line px-3 py-1 text-xs text-muted hover:text-ink"
                  @click="openEdit(client)"
                >
                  Editar
                </button>
                <button
                  type="button"
                  class="rounded-lg border border-red-500/20 px-3 py-1 text-xs text-red-400 hover:bg-red-500/10"
                  @click="removeClient(client)"
                >
                  Eliminar
                </button>
              </div>
            </td>
          </tr>
          <tr v-if="!clients.length">
            <td colspan="7" class="px-4 py-12 text-center text-sm text-muted">
              Sin clientes que mostrar.
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <div
      v-if="lastPage > 1"
      class="mt-4 flex items-center justify-center gap-3"
    >
      <button
        type="button"
        class="rounded-lg border border-line px-3 py-1.5 text-sm text-ink disabled:opacity-40"
        :disabled="page <= 1"
        @click="page--"
      >
        ←
      </button>
      <span class="text-sm text-muted"
        >Página {{ page }} de {{ lastPage }}</span
      >
      <button
        type="button"
        class="rounded-lg border border-line px-3 py-1.5 text-sm text-ink disabled:opacity-40"
        :disabled="page >= lastPage"
        @click="page++"
      >
        →
      </button>
    </div>

    <div
      v-if="showForm"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="client-form-title"
      @click.self="!saving && (showForm = false)"
    >
      <div class="w-full max-w-md rounded-2xl border border-line bg-card p-6">
        <h2 id="client-form-title" class="mb-4 text-lg font-semibold text-ink">
          {{ editing ? "Editar cliente" : "Nuevo cliente" }}
        </h2>
        <form class="space-y-3" @submit.prevent="submitForm">
          <div>
            <label for="client-name" class="mb-1 block text-xs text-muted"
              >Nombre</label
            >
            <input
              id="client-name"
              v-model="form.name"
              type="text"
              required
              :aria-invalid="!!fieldErrors.name"
              :aria-describedby="
                fieldErrors.name ? 'client-name-error' : undefined
              "
              :class="[
               'w-full rounded-lg border bg-main px-3 py-2 text-sm text-ink',
                fieldErrors.name ? 'border-red-500/60' : 'border-line',
              ]"
            />
            <p
              v-if="fieldErrors.name"
              id="client-name-error"
              class="mt-1 text-xs text-red-400"
            >
              {{ fieldErrors.name[0] }}
            </p>
          </div>
          <div>
            <label for="client-email" class="mb-1 block text-xs text-muted"
              >Email</label
            >
            <input
              id="client-email"
              v-model="form.email"
              type="email"
              required
              :aria-invalid="!!fieldErrors.email"
              :aria-describedby="
                fieldErrors.email ? 'client-email-error' : undefined
              "
              :class="[
               'w-full rounded-lg border bg-main px-3 py-2 text-sm text-ink',
                fieldErrors.email ? 'border-red-500/60' : 'border-line',
              ]"
            />
            <p
              v-if="fieldErrors.email"
              id="client-email-error"
              class="mt-1 text-xs text-red-400"
            >
              {{ fieldErrors.email[0] }}
            </p>
          </div>
          <div>
            <label for="client-phone" class="mb-1 block text-xs text-muted"
              >Teléfono</label
            >
            <input
              id="client-phone"
              v-model="form.telefono"
              type="tel"
              :aria-invalid="!!fieldErrors.telefono"
              :aria-describedby="
                fieldErrors.telefono ? 'client-phone-error' : undefined
              "
              :class="[
               'w-full rounded-lg border bg-main px-3 py-2 text-sm text-ink',
                fieldErrors.telefono ? 'border-red-500/60' : 'border-line',
              ]"
            />
            <p
              v-if="fieldErrors.telefono"
              id="client-phone-error"
              class="mt-1 text-xs text-red-400"
            >
              {{ fieldErrors.telefono[0] }}
            </p>
          </div>
          <div v-if="!editing">
            <label for="client-password" class="mb-1 block text-xs text-muted"
              >Contraseña</label
            >
            <input
              id="client-password"
              v-model="form.password"
              type="password"
              required
              minlength="8"
              autocomplete="new-password"
              :aria-invalid="!!fieldErrors.password"
              :aria-describedby="
                fieldErrors.password ? 'client-password-error' : undefined
              "
              :class="[
               'w-full rounded-lg border bg-main px-3 py-2 text-sm text-ink',
                fieldErrors.password ? 'border-red-500/60' : 'border-line',
              ]"
            />
            <p
              v-if="fieldErrors.password"
              id="client-password-error"
              class="mt-1 text-xs text-red-400"
            >
              {{ fieldErrors.password[0] }}
            </p>
          </div>
          <p v-if="formError" class="text-sm text-red-400">{{ formError }}</p>
          <div class="mt-5 flex gap-3">
            <button
              type="submit"
              :disabled="saving"
              class="flex-1 rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-black hover:bg-gold-dim disabled:opacity-50"
            >
              {{ saving ? "Guardando…" : "Guardar" }}
            </button>
            <button
              type="button"
              :disabled="saving"
              class="rounded-lg border border-line px-4 py-2 text-sm text-muted hover:text-ink disabled:opacity-50"
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
