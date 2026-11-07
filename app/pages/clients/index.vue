<script setup lang="ts">
import type { DataTableColumn } from "~/components/ui/DataTable.vue";
import type { CsvColumn } from "~/composables/useCsvExport";
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
// 'staff' (administrador + recepcionista): quien está en el mostrador es
// quien necesita el contexto del cliente que tiene enfrente. Lo sensible
// sigue siendo admin y se oculta abajo: segmentación comercial y baja de
// clientes. El backend es la autoridad real (authorizeCounterStaff()
// vs authorizeAdmin() por acción en ClientAdminController).
definePageMeta({ middleware: ["auth", "staff"], layout: "dashboard" });
useSeoMeta({ title: 'Clientes — UrbanBlade', robots: 'noindex' })


interface ClientRow {
  id: string;
  slug: string | null;
  name: string | null;
  avatar_url?: string | null;
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
  new: "border-info/25 bg-info/10 text-info",
  active: "border-success/25 bg-success/10 text-success",
  inactive: "border-ink/10 bg-ink/5 text-muted",
};

const exportColumns: CsvColumn<ClientRow>[] = [
  { header: "Nombre", value: (c) => c.name },
  { header: "Correo", value: (c) => c.email },
  { header: "Teléfono", value: (c) => c.telefono },
  { header: "Segmento", value: (c) => SEGMENT_LABEL[c.segment] ?? c.segment },
  { header: "Citas", value: (c) => c.totalAppointments },
  { header: "Total gastado", value: (c) => c.totalSpent },
  { header: "Última cita", value: (c) => c.lastAppointment },
  { header: "Alta", value: (c) => c.joinedAt },
];

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
  buildDataKey("clients-list", {
    search: search.value || undefined,
    segment: segment.value || undefined,
    page: page.value,
    per_page: 10,
  }),
  () =>
    apiFetch<ClientsResponse>("/admin/clients", {
      query: {
        search: search.value || undefined,
        segment: segment.value || undefined,
        page: page.value,
        per_page: 10,
      },
    }),
  { watch: [debouncedSearch, segment, page], lazy: true },
);

const COLUMNAS: DataTableColumn[] = [
  { key: "name", label: "Cliente" },
  { key: "email", label: "Email", hideBelow: "md" },
  { key: "telefono", label: "Teléfono", hideBelow: "lg" },
  { key: "segment", label: "Segmento", align: "center" },
  { key: "totalAppointments", label: "Citas", align: "center", hideBelow: "md" },
  { key: "joinedAt", label: "Registrado", hideBelow: "lg" },
];
async function onRowAction(action: string, client: ClientRow) {
  if (action === "view") await navigateTo(`/clients/${client.slug}`);
  else if (action === "edit") openEdit(client);
  else if (action === "delete") await removeClient(client);
}
const clients = computed(() => response.value?.data ?? []);
const pagination = computed(() => ({
  current_page: response.value?.current_page ?? page.value,
  last_page: response.value?.last_page ?? 1,
  total: response.value?.total ?? 0,
  per_page: response.value?.per_page ?? 10,
}));

watch([debouncedSearch, segment], () => {
  page.value = 1;
});

function resetAndSearch() {
  page.value = 1;
}

// La segmentación es solo de administración: pedirla como recepcionista
// devolvería 403 y ensuciaría la pantalla con un error por algo que ese rol
// no debe ver. Las tarjetas se ocultan más abajo con el mismo booleano.
const { hasRole } = useAuth();
const isAdmin = computed(() => hasRole("administrador"));

const { data: segmentation } = await useAsyncData(
  "clients-segmentation",
  () =>
    isAdmin.value
      ? apiFetch<{
          success: boolean;
          data: Record<string, { count: number; percentage: number }>;
        }>("/admin/clients/segmentation/data")
      : Promise.resolve(null),
  { lazy: true, watch: [isAdmin] },
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
const cErr = (field: string) => fieldErrors.value[field]?.[0] ?? null;
const cInput = (field: string) => [
  "ui-input w-full",
  fieldErrors.value[field] ? "border-danger/60" : "border-line",
];
const clientInitials = computed(
  () =>
    form.name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase() || "—",
);
const clientProgress = computed(() => {
  const need = [
    !!form.name.trim(),
    form.email.includes("@") && form.email.includes("."),
    !!form.telefono.trim(),
    editing.value ? true : form.password.length >= 8,
  ];
  return Math.round((need.filter(Boolean).length / need.length) * 100);
});
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
    confirmText: "Sí, eliminar cliente",
    cancelText: "Volver",
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

    <!-- Segmentación comercial: solo administración (ver authorizeAdmin()
         en ClientAdminController::getSegmentation). -->
    <section v-if="isAdmin" class="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
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
          class="mb-1 text-xs font-black uppercase tracking-wider text-muted"
        >
          {{ card.label }}
        </p>
        <p class="text-2xl font-black text-ink">{{ card.count }}</p>
      </button>
    </section>

    <section class="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
      <UiSearchInput
        v-model="search"
        label="Nombre o email"
        placeholder="Buscar por nombre o correo…"
        @update:model-value="resetAndSearch"
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
      <!-- Exportar saca datos personales de todos los clientes: solo administración. -->
      <div v-if="isAdmin" class="sm:ml-auto">
        <UiExportCsvButton
          endpoint="/admin/clients"
          :query="{ search: search || undefined, segment: segment || undefined }"
          :columns="exportColumns"
          filename="clientes"
        />
      </div>
    </section>

    <BrandStatePanel
      v-if="error"
      mascot="bruno"
      state="error"
      tone="danger"
      title="No se pudo cargar la lista de clientes"
      description="Inténtalo nuevamente en unos minutos."
      action-label="Reintentar"
      @action="refresh"
    />
    <p v-if="actionError" role="alert" class="mb-4 text-sm text-danger">
      {{ actionError }}
    </p>

    <UiDataTable
      v-if="!error"
      :columns="COLUMNAS"
      :rows="clients"
      :loading="pending"
      aria-label="Clientes"
      empty-title="Sin clientes que mostrar"
      empty-description="Cambia la búsqueda o el segmento para ver otros clientes."
    >
      <template #cell-name="{ row }">
        <div class="flex items-center gap-3">
          <UiAvatar :src="row.avatar_url" :name="row.name" />
          <span class="font-bold text-ink">{{ row.name ?? "Sin usuario" }}</span>
        </div>
      </template>
      <template #cell-email="{ row }"><span class="text-muted">{{ row.email ?? "—" }}</span></template>
      <template #cell-telefono="{ row }"><span class="text-muted">{{ row.telefono ?? "—" }}</span></template>
      <template #cell-segment="{ row }">
        <span class="rounded-full border px-2 py-0.5 text-xs font-black" :class="SEGMENT_CLASS[row.segment]">{{ SEGMENT_LABEL[row.segment] }}</span>
      </template>
      <template #cell-joinedAt="{ row }"><span class="text-muted">{{ fmtDate(row.joinedAt) }}</span></template>
      <template #actions="{ row }">
        <UiRowActions
          v-if="row.slug"
          :actions="[
            { key: 'view', label: `Ver ficha de ${row.name ?? 'este cliente'}`, icon: 'eye' },
            { key: 'edit', label: `Editar a ${row.name ?? 'este cliente'}`, icon: 'edit' },
            { key: 'delete', label: `Eliminar a ${row.name ?? 'este cliente'}`, icon: 'trash', danger: true, hidden: !isAdmin },
          ]"
          @action="onRowAction($event, row)"
        />
      </template>
    </UiDataTable>

    <UiPagination
      v-model:current-page="page"
      :last-page="pagination.last_page"
      :total="pagination.total"
      :per-page="pagination.per_page"
      :busy="pending"
    />

    <UiFormSheet
      v-if="showForm"
      :title="editing ? 'Editar cliente' : 'Nuevo cliente'"
      kicker="Directorio"
      icon="users"
      subtitle="Datos de contacto del cliente y acceso a su cuenta."
      hint="Se guarda con un solo clic"
      :badge="editing ? 'Edición' : 'Alta'"
      form-id="client-form"
      :submit-label="editing ? 'Guardar cambios' : 'Crear cliente'"
      :progress="clientProgress"
      :busy="saving"
      @close="showForm = false"
    >
      <form id="client-form" class="space-y-6" @submit.prevent="submitForm">
        <section class="space-y-4" aria-labelledby="cl-id">
          <p id="cl-id" class="ub-form-section__title">Identidad</p>
          <UiFormField field-id="client-name" label="Nombre completo" icon="user" :error="cErr('name')">
            <input
              id="client-name"
              v-model="form.name"
              aria-label="Nombre"
              type="text"
              required
              autocomplete="off"
              placeholder="Ej. Carlos Mendoza"
              :aria-invalid="!!cErr('name')"
              :aria-describedby="cErr('name') ? 'client-name-error' : undefined"
              :class="cInput('name')"
            >
          </UiFormField>
          <div class="ub-apptcard" aria-label="Vista previa en la lista">
            <span class="ub-apptcard__avatar">{{ clientInitials }}</span>
            <span class="min-w-0 flex-1">
              <b class="block truncate text-sm text-ink">{{ form.name || "Nombre del cliente" }}</b>
              <small class="block truncate text-xs text-muted">{{ form.email || "correo@ejemplo.com" }}</small>
            </span>
            <span class="ub-apptcard__pill">{{ editing ? "Cliente" : "Nuevo" }}</span>
          </div>
        </section>

        <section class="space-y-4" aria-labelledby="cl-contact">
          <p id="cl-contact" class="ub-form-section__title">Contacto</p>
          <UiFormField field-id="client-email" label="Correo" icon="mail" :error="cErr('email')">
            <input
              id="client-email"
              v-model="form.email"
              aria-label="Email"
              type="email"
              required
              autocomplete="off"
              placeholder="nombre@correo.com"
              :aria-invalid="!!cErr('email')"
              :aria-describedby="cErr('email') ? 'client-email-error' : undefined"
              :class="cInput('email')"
            >
          </UiFormField>
          <UiFormField field-id="client-phone" label="Teléfono" icon="phone" :error="cErr('telefono')">
            <input
              id="client-phone"
              v-model="form.telefono"
              aria-label="Teléfono"
              type="tel"
              autocomplete="tel"
              placeholder="55 1234 5678"
              :aria-invalid="!!cErr('telefono')"
              :aria-describedby="cErr('telefono') ? 'client-phone-error' : undefined"
              :class="cInput('telefono')"
            >
          </UiFormField>
        </section>

        <section v-if="!editing" class="space-y-4" aria-labelledby="cl-access">
          <p id="cl-access" class="ub-form-section__title">Acceso</p>
          <UiFormField
            field-id="client-password"
            label="Contraseña"
            icon="lock"
            :error="cErr('password')"
            hint="Mínimo 8 caracteres. El cliente podrá cambiarla desde su perfil."
          >
            <input
              id="client-password"
              v-model="form.password"
              aria-label="Contraseña"
              type="password"
              required
              minlength="8"
              autocomplete="new-password"
              placeholder="Mínimo 8 caracteres"
              :aria-invalid="!!cErr('password')"
              :aria-describedby="cErr('password') ? 'client-password-error' : undefined"
              :class="cInput('password')"
            >
          </UiFormField>
        </section>

        <p v-if="formError" role="alert" class="text-sm text-danger">{{ formError }}</p>
      </form>
    </UiFormSheet>
  </div>
</template>
