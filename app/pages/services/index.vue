<script setup lang="ts">
import type { DataTableColumn } from "~/components/ui/DataTable.vue";
import type { CsvColumn } from "~/composables/useCsvExport";
/*
 * Fase 9.5 — catálogo de servicios, gestión admin. Api/Service/
 * ServiceManagementController maneja el CRUD completo bajo /services/manage.
 */
definePageMeta({ middleware: ["auth", "admin"], layout: "dashboard" });
useSeoMeta({ title: 'Servicios — UrbanBlade', robots: 'noindex' })


interface ServiceRow {
  id: string;
  slug: string;
  nombre: string;
  categoria: string;
  precio: number;
  duracion_min: number;
  descripcion: string | null;
  imagen: string | null;
  imagen_url: string | null;
  activo: boolean;
}

interface ServicesResponse {
  data: ServiceRow[];
  meta: { current_page: number; last_page: number; total: number };
  categories: string[];
}

const exportColumns: CsvColumn<ServiceRow>[] = [
  { header: "Servicio", value: (s) => s.nombre },
  { header: "Categoría", value: (s) => s.categoria },
  { header: "Precio", value: (s) => s.precio },
  { header: "Duración (min)", value: (s) => s.duracion_min },
  { header: "Activo", value: (s) => s.activo },
  { header: "Descripción", value: (s) => s.descripcion },
];

const { apiFetch } = useApi();
const { confirm } = useConfirm();

const search = ref("");
const debouncedSearch = useDebounce(search, 350);
const categoria = ref("");
const activo = ref("");
const page = ref(1);

const {
  data: response,
  pending,
  error,
  refresh,
} = await useAsyncData<ServicesResponse>(
  "services-list",
  () =>
    apiFetch<ServicesResponse>("/services/manage", {
      query: {
        q: search.value || undefined,
        categoria: categoria.value || undefined,
        activo: activo.value || undefined,
        page: page.value,
        per_page: 10,
      },
    }),
  { watch: [debouncedSearch, categoria, activo, page], lazy: true },
);
const COLUMNAS: DataTableColumn[] = [
  { key: "nombre", label: "Servicio" },
  { key: "categoria", label: "Categoría", hideBelow: "md" },
  { key: "duracion_min", label: "Duración", hideBelow: "md" },
  { key: "precio", label: "Precio", align: "right" },
  { key: "activo", label: "Estado", align: "center" },
];
const ESTADO_OPCIONES = [
  { value: "", label: "Todos", icon: "scissors" },
  { value: "1", label: "Activos", icon: "check" },
  { value: "0", label: "Inactivos", icon: "x" },
];
async function onRowAction(action: string, service: ServiceRow) {
  if (action === "edit") openEdit(service);
  else if (action === "delete") await removeService(service);
}
const services = computed(() => response.value?.data ?? []);
const categories = computed(() => response.value?.categories ?? []);
const categoriaOpciones = computed(() => [
  { value: "", label: "Todas" },
  ...categories.value.map((c) => ({ value: c, label: c })),
]);
const pagination = computed(() => response.value?.meta);

watch([debouncedSearch, categoria, activo], () => {
  page.value = 1;
});

function clearFilters() {
  search.value = "";
  categoria.value = "";
  activo.value = "";
  page.value = 1;
}

function fmtMoney(n: number) {
  return `$${Number(n ?? 0).toFixed(0)}`;
}

// ── Crear / editar ───────────────────────────────────────────────────────
const showForm = ref(false);
const editing = ref<ServiceRow | null>(null);
const form = reactive({
  nombre: "",
  categoria: "",
  precio: 0,
  duracion_min: 30,
  descripcion: "",
  imagenFile: null as File | null,
  activo: true,
});
const formError = ref("");
const sErr = (field: string) => fieldErrors.value[field]?.[0] ?? null;
const sInput = (field: string) => [
  "ui-input w-full",
  fieldErrors.value[field] ? "border-danger/60" : "border-line",
];
const fieldErrors = ref<Record<string, string[]>>({});
const saving = ref(false);

function openCreate() {
  editing.value = null;
  form.nombre = "";
  form.categoria = categories.value[0] ?? "corte";
  form.precio = 150;
  form.duracion_min = 30;
  form.descripcion = "";
  form.imagenFile = null;
  form.activo = true;
  formError.value = "";
  fieldErrors.value = {};
  showForm.value = true;
}

function openEdit(service: ServiceRow) {
  editing.value = service;
  form.nombre = service.nombre;
  form.categoria = service.categoria ?? "";
  form.precio = service.precio;
  form.duracion_min = service.duracion_min;
  form.descripcion = service.descripcion ?? "";
  form.imagenFile = null;
  form.activo = service.activo;
  formError.value = "";
  fieldErrors.value = {};
  showForm.value = true;
}

async function submitForm() {
  saving.value = true;
  formError.value = "";
  fieldErrors.value = {};

  try {
    // Multipart para poder mandar la imagen elegida; al editar va como POST con
    // _method=PUT porque PHP no lee archivos de un PUT. Sin imagen nueva no se
    // manda el campo y el servidor conserva la actual.
    const body = new FormData();
    body.append("nombre", form.nombre);
    body.append("categoria", form.categoria);
    body.append("precio", String(form.precio));
    body.append("duracion_min", String(form.duracion_min));
    body.append("descripcion", form.descripcion);
    body.append("activo", form.activo ? "1" : "0");
    if (form.imagenFile) body.append("imagen", form.imagenFile);

    if (editing.value) {
      body.append("_method", "PUT");
      await apiFetch(`/services/manage/${editing.value.slug}`, {
        method: "POST",
        body,
      });
    } else {
      await apiFetch("/services/manage", { method: "POST", body });
    }
    showForm.value = false;
    await refresh();
  } catch (err: unknown) {
    const dataErr = (
      err as { data?: { message?: string; errors?: Record<string, string[]> } }
    )?.data;
    if (dataErr?.errors) {
      fieldErrors.value = dataErr.errors;
    }
    formError.value =
      dataErr?.message ??
      "No se pudo guardar el servicio. Revisa los campos marcados.";
  } finally {
    saving.value = false;
  }
}

async function removeService(service: ServiceRow) {
  const ok = await confirm({
    title: "Eliminar servicio",
    message: `¿Estás seguro de que deseas eliminar el servicio "${service.nombre}" del catálogo? Esta acción no se puede deshacer.`,
    confirmText: "Sí, eliminar",
    isDanger: true,
  });
  if (!ok) return;

  try {
    await apiFetch(`/services/manage/${service.slug}`, { method: "DELETE" });
    await refresh();
  } catch (err: unknown) {
    const dataErr = (err as { data?: { message?: string } })?.data;
    formError.value = dataErr?.message ?? "No se pudo eliminar el servicio.";
  }
}
</script>

<template>
  <div class="p-4 sm:p-6 lg:p-8">
    <header
      class="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div>
        <h1 class="mt-1 text-2xl font-semibold text-ink">
          Catálogo de <span class="text-gold">Servicios</span>
        </h1>
        <p class="mt-1 text-sm text-muted">
          Administra los servicios, tiempos y precios ofrecidos en la barbería.
        </p>
      </div>
      <button
        type="button"
        class="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-black hover:bg-gold-dim"
        @click="openCreate"
      >
        + Nuevo Servicio
      </button>
    </header>
    <div class="mb-3">
      <UiExportCsvButton
        endpoint="/services/manage"
        :query="{ q: search || undefined, categoria: categoria || undefined, activo: activo || undefined }"
        :columns="exportColumns"
        filename="servicios"
      />
    </div>

    <section class="mb-5 flex flex-wrap items-center gap-3" aria-label="Filtros">
      <UiSearchInput v-model="search" label="Buscar servicios" placeholder="Buscar por nombre del servicio…" />
      <UiFilterChips v-model="activo" label="Filtrar por estado" :options="ESTADO_OPCIONES" />
      <UiFilterChips v-if="categories.length" v-model="categoria" label="Filtrar por categoría" :options="categoriaOpciones" />
      <button
        v-if="search || categoria || activo"
        type="button"
        class="text-xs font-bold uppercase tracking-widest text-muted hover:text-ink"
        @click="clearFilters"
      >
        Limpiar filtros
      </button>
    </section>

    <UiPagination
      v-if="pagination"
      v-model:current-page="page"
      :last-page="pagination.last_page"
      :total="pagination.total"
      :per-page="10"
      :busy="pending"
    />

    <UiSkeleton v-if="pending" variant="rows" :rows="8" label="Cargando servicios…" class="ui-card" />
    <BrandStatePanel
      v-else-if="error"
      mascot="bruno"
      state="error"
      tone="danger"
      title="No se pudo cargar el catálogo"
      description="Inténtalo nuevamente en unos minutos."
      action-label="Reintentar"
      @action="refresh"
    />

    <UiDataTable
      v-if="!error"
      :columns="COLUMNAS"
      :rows="services"
      :loading="pending"
      aria-label="Servicios"
      empty-title="Todavía no hay servicios registrados"
      empty-description="Crea el primer servicio o cambia los filtros."
    >
      <template #cell-nombre="{ row }">
        <div class="flex items-center gap-3">
          <img v-if="row.imagen_url" :src="row.imagen_url" :alt="row.nombre" class="h-9 w-9 rounded-lg border border-line object-cover">
          <span v-else class="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-ink/5 text-gold"><UiIcon name="scissors" /></span>
          <div class="min-w-0">
            <p class="font-bold text-ink">{{ row.nombre }}</p>
            <p v-if="row.descripcion" class="line-clamp-1 text-xs text-muted">{{ row.descripcion }}</p>
          </div>
        </div>
      </template>
      <template #cell-categoria="{ row }">
        <span class="rounded-full border border-line bg-ink/5 px-2 py-0.5 text-xs font-black uppercase text-muted">{{ row.categoria }}</span>
      </template>
      <template #cell-duracion_min="{ row }"><span class="text-muted">{{ row.duracion_min }} min</span></template>
      <template #cell-precio="{ row }"><span class="font-black text-success">{{ fmtMoney(row.precio) }}</span></template>
      <template #cell-activo="{ row }">
        <span
          class="rounded-full border px-2 py-0.5 text-xs font-black uppercase"
          :class="row.activo ? 'border-success/25 bg-success/10 text-success' : 'border-line bg-ink/5 text-muted'"
        >
          {{ row.activo ? "Activo" : "Inactivo" }}
        </span>
      </template>
      <template #actions="{ row }">
        <UiRowActions
          v-if="row.slug"
          :actions="[
            { key: 'edit', label: `Editar ${row.nombre}`, icon: 'edit' },
            { key: 'delete', label: `Eliminar ${row.nombre}`, icon: 'trash', danger: true },
          ]"
          @action="onRowAction($event, row)"
        />
      </template>
    </UiDataTable>
    <UiFormSheet
      v-if="showForm"
      :title="editing ? 'Editar servicio' : 'Nuevo servicio'"
      kicker="Catálogo comercial"
      icon="scissors"
      subtitle="Define cómo se mostrará, cuánto dura y qué precio tendrá al reservar."
      hint="Visible al reservar en cuanto lo guardas"
      :badge="editing ? 'Edición' : 'Nuevo'"
      form-id="service-form"
      submit-label="Guardar servicio"
      :busy="saving"
      @close="showForm = false"
    >
      <form id="service-form" class="space-y-6" @submit.prevent="submitForm">
        <section class="space-y-4" aria-labelledby="sv-info">
          <p id="sv-info" class="ub-form-section__title">Información</p>
          <UiFormField field-id="service-nombre" label="Nombre del servicio" icon="tag" :error="sErr('nombre')">
            <input
              id="service-nombre"
              v-model="form.nombre"
              aria-label="Nombre del servicio"
              type="text"
              required
              maxlength="120"
              placeholder="Ej. Corte Clásico + Barba"
              :class="sInput('nombre')"
            >
          </UiFormField>
          <UiFormField field-id="service-categoria" label="Categoría" icon="box" :error="sErr('categoria')">
            <input
              id="service-categoria"
              v-model="form.categoria"
              aria-label="Categoría"
              type="text"
              required
              maxlength="100"
              list="service-categories-list"
              placeholder="Ej. Cortes, Barba, Tratamientos…"
              :class="sInput('categoria')"
            >
          </UiFormField>
          <datalist id="service-categories-list">
            <option v-for="c in categories" :key="c" :value="c" />
          </datalist>
          <fieldset v-if="categories.length" class="m-0 flex min-w-0 flex-wrap gap-2 border-0 p-0">
            <legend class="sr-only">Categorías sugeridas</legend>
            <button
              v-for="cat in categories"
              :key="cat"
              type="button"
              class="ub-chip"
              :aria-pressed="form.categoria === cat"
              @click="form.categoria = cat"
            >
              {{ cat }}
            </button>
          </fieldset>
        </section>

        <section class="space-y-4" aria-labelledby="sv-price">
          <p id="sv-price" class="ub-form-section__title">Precio y duración</p>
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <UiFormField field-id="service-duracion" label="Duración (min)" icon="clock" :error="sErr('duracion_min')">
              <input
                id="service-duracion"
                v-model.number="form.duracion_min"
                aria-label="Duración (min)"
                type="number"
                min="5"
                max="600"
                required
                :class="sInput('duracion_min')"
              >
            </UiFormField>
            <UiFormField field-id="service-precio" label="Precio ($ MXN)" icon="cash" :error="sErr('precio')">
              <input
                id="service-precio"
                v-model.number="form.precio"
                aria-label="Precio ($ MXN)"
                type="number"
                step="0.01"
                min="0"
                required
                :class="sInput('precio')"
              >
            </UiFormField>
          </div>
          <div class="ub-apptcard" aria-label="Vista previa para el cliente">
            <span class="ub-apptcard__avatar"><UiIcon name="scissors" /></span>
            <span class="min-w-0 flex-1">
              <b class="block truncate text-sm text-ink">{{ form.nombre || "Nombre del servicio" }}</b>
              <small class="block truncate text-xs text-muted">{{ form.categoria || "Categoría" }} · {{ form.duracion_min || 0 }} min</small>
            </span>
            <span class="ub-apptcard__pill">{{ fmtMoney(form.precio || 0) }}</span>
          </div>
        </section>

        <section class="space-y-4" aria-labelledby="sv-pres">
          <p id="sv-pres" class="ub-form-section__title">Presentación</p>
          <UiImageUpload
            id="service-imagen"
            v-model="form.imagenFile"
            label="Imagen representativa (opcional)"
            :current-url="editing?.imagen_url"
            :error="fieldErrors.imagen?.[0]"
          />
          <UiFormField field-id="service-descripcion" label="Descripción del servicio (opcional)" icon="text" top>
            <textarea
              id="service-descripcion"
              v-model="form.descripcion"
              aria-label="Descripción del servicio (opcional)"
              rows="3"
              maxlength="2000"
              placeholder="Detalla qué incluye el corte o servicio…"
              class="ui-input w-full"
            />
          </UiFormField>
          <UiSwitch
            v-model="form.activo"
            label="Activo"
            description="Disponible para reserva por clientes"
          />
        </section>

        <p v-if="formError" role="alert" class="text-sm text-danger">{{ formError }}</p>
      </form>
    </UiFormSheet>
  </div>
</template>
