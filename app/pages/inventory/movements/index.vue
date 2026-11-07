<script setup lang="ts">
import type { DataTableColumn } from "~/components/ui/DataTable.vue";
import type { CsvColumn } from "~/composables/useCsvExport";
/*
 * Fase 9.5 — historial de movimientos de inventario, puerto de
 * Inventory\InventoryMovementController (web). Admin puede registrar
 * entradas (reposición) y salidas; recepción solo salidas (consumo) —
 * misma regla que enforca Api/Inventory/InventoryController::storeMovement()
 * del lado servidor, aquí solo se oculta la opción para no invitar un 422.
 */
definePageMeta({ middleware: ["auth", "staff"], layout: "dashboard" });
useSeoMeta({ title: 'Movimientos de inventario — UrbanBlade', robots: 'noindex' })


interface MovementRow {
  id: string;
  tipo: string;
  cantidad: number;
  motivo: string | null;
  fecha: string | null;
  product: { id: string | null; nombre: string | null };
  user: { id: string | null; name: string | null };
  appointment: {
    id: string | null;
    fecha: string | null;
    client: string | null;
  };
}

interface MovementsResponse {
  data: MovementRow[];
  meta: {
    current_page: number;
    last_page: number;
    total: number;
    stats: { total: number; entradas: number; salidas: number; hoy: number };
  };
}

interface ProductOption {
  id: string;
  nombre: string;
}
interface LowStockItem {
  id: string;
  nombre: string;
  stock_actual: number;
  stock_minimo: number;
  pending_restock: boolean;
}

const exportColumns: CsvColumn<MovementRow>[] = [
  { header: "Fecha", value: (m) => m.fecha },
  { header: "Tipo", value: (m) => m.tipo },
  { header: "Producto", value: (m) => m.product.nombre },
  { header: "Cantidad", value: (m) => m.cantidad },
  { header: "Motivo", value: (m) => m.motivo },
  { header: "Registrado por", value: (m) => m.user.name },
  { header: "Cliente de la cita", value: (m) => m.appointment.client },
];

const { apiFetch } = useApi();
const { hasRole } = useAuth();
const isAdmin = computed(() => hasRole("administrador"));

const search = ref("");
const debouncedSearch = useDebounce(search, 350);
const tipoFilter = ref("");
const productFilter = ref("");
const fechaDesde = ref("");
const fechaHasta = ref("");
const page = ref(1);

const {
  data: response,
  pending,
  error,
  refresh,
} = await useAsyncData<MovementsResponse>(
  buildDataKey("inventory-movements", {
    q: search.value || undefined,
    tipo: tipoFilter.value || undefined,
    product_id: productFilter.value || undefined,
    fecha_desde: fechaDesde.value || undefined,
    fecha_hasta: fechaHasta.value || undefined,
    page: page.value,
    per_page: 10,
  }),
  () =>
    apiFetch<MovementsResponse>("/inventory/movements", {
      query: {
        q: search.value || undefined,
        tipo: tipoFilter.value || undefined,
        product_id: productFilter.value || undefined,
    fecha_desde: fechaDesde.value || undefined,
    fecha_hasta: fechaHasta.value || undefined,
        page: page.value,
        per_page: 10,
      },
    }),
  { watch: [debouncedSearch, tipoFilter, productFilter, fechaDesde, fechaHasta, page], lazy: true },
);
const movements = computed(() => response.value?.data ?? []);
const stats = computed(() => response.value?.meta.stats);
const pagination = computed(() => response.value?.meta);

watch([debouncedSearch, tipoFilter, productFilter, fechaDesde, fechaHasta], () => {
  page.value = 1;
});

const { data: productsRes } = await useAsyncData(
  "inventory-movements-products",
  () => apiFetch<{ data: ProductOption[] }>("/inventory/products"),
  { lazy: true },
);
const products = computed<ProductOption[]>(
  () =>
    productsRes.value?.data.map((p) => ({ id: p.id, nombre: p.nombre })) ?? [],
);

const { data: lowStockRes, refresh: refreshLowStock } = await useAsyncData(
  "inventory-movements-low-stock",
  () => apiFetch<{ data: LowStockItem[] }>("/inventory/low-stock"),
  { lazy: true },
);
const lowStockItems = computed(() => lowStockRes.value?.data ?? []);

function clearFilters() {
  search.value = "";
  tipoFilter.value = "";
  productFilter.value = "";
  fechaDesde.value = "";
  fechaHasta.value = "";
  page.value = 1;
}

function fmtDateTime(iso: string | null) {
  if (!iso) return "—";

  return new Date(iso).toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const marking = ref<string | null>(null);
const actionError = ref("");
async function markOrdered(item: LowStockItem) {
  marking.value = item.id;
  actionError.value = "";
  try {
    await apiFetch(`/inventory/products/${item.id}/mark-ordered`, {
      method: "POST",
    });
    await refreshLowStock();
  } catch (err: unknown) {
    actionError.value =
      (err as { data?: { message?: string } })?.data?.message ??
      "No se pudo marcar el producto como pedido.";
  } finally {
    marking.value = null;
  }
}

// ── Nuevo movimiento ──────────────────────────────────────────────────────
const showForm = ref(false);
const COLUMNAS: DataTableColumn[] = [
  { key: "fecha", label: "Fecha" },
  { key: "producto", label: "Producto" },
  { key: "tipo", label: "Tipo" },
  { key: "cantidad", label: "Cantidad", align: "right" },
  { key: "motivo", label: "Motivo", hideBelow: "md" },
  { key: "responsable", label: "Responsable", hideBelow: "lg" },
];
const TIPO_OPCIONES = [
  { value: "", label: "Todos", icon: "box" },
  { value: "entrada", label: "Entradas", icon: "plus" },
  { value: "salida", label: "Salidas", icon: "box" },
];

const form = reactive({
  product_id: "",
  tipo: "salida",
  cantidad: 1,
  motivo: "",
  appointment_id: "",
  fecha: "",
});
const formError = ref("");
const mErr = (field: string) => fieldErrors.value[field]?.[0] ?? null;
const mInput = (field: string) => [
  "ui-input w-full",
  fieldErrors.value[field] ? "border-danger/60" : "border-line",
];
const tipoOptions = computed(() => [
  { value: "salida", title: "Salida", detail: "Consumo del producto", icon: "box" },
  ...(isAdmin.value
    ? [{ value: "entrada", title: "Entrada", detail: "Reposición de stock", icon: "plus" }]
    : []),
]);
const movementProduct = computed(
  () => products.value.find((p) => p.id === form.product_id)?.nombre ?? "",
);
const fieldErrors = ref<Record<string, string[]>>({});
const saving = ref(false);

function openCreate() {
  form.product_id = "";
  form.tipo = "salida";
  form.cantidad = 1;
  form.motivo = "";
  form.appointment_id = "";
  form.fecha = "";
  formError.value = "";
  fieldErrors.value = {};
  showForm.value = true;
}

function closeForm() {
  if (saving.value) return;
  showForm.value = false;
}

async function submitForm() {
  saving.value = true;
  formError.value = "";
  fieldErrors.value = {};
  try {
    await apiFetch("/inventory/movements", {
      method: "POST",
      body: {
        product_id: form.product_id,
        tipo: form.tipo,
        cantidad: form.cantidad,
        motivo: form.motivo || undefined,
        appointment_id: form.appointment_id || undefined,
        fecha: form.fecha || undefined,
      },
    });
    showForm.value = false;
    await Promise.all([refresh(), refreshLowStock()]);
  } catch (err: unknown) {
    const data = (
      err as { data?: { message?: string; errors?: Record<string, string[]> } }
    )?.data;
    fieldErrors.value = data?.errors ?? {};
    formError.value = data?.message ?? "No se pudo registrar el movimiento.";
  } finally {
    saving.value = false;
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
          Movimientos de <span class="text-gold">Inventario</span>
        </h1>
        <p class="mt-1 text-sm text-muted">
          Entradas y salidas de stock, con trazabilidad completa.
        </p>
      </div>
      <div class="flex items-center gap-3">
        <NuxtLink
          v-if="isAdmin"
          to="/inventory/products"
          class="rounded-lg border border-line px-4 py-2 text-sm text-muted hover:text-ink"
          >Productos</NuxtLink
        >
        <button
          type="button"
          class="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-black hover:bg-gold-dim"
          @click="openCreate"
        >
          + Nuevo Movimiento
        </button>
      </div>
    </header>
    <div class="mb-3">
      <UiExportCsvButton
        endpoint="/inventory/movements"
        :query="{ q: search || undefined, tipo: tipoFilter || undefined, product_id: productFilter || undefined, fecha_desde: fechaDesde || undefined, fecha_hasta: fechaHasta || undefined }"
        :columns="exportColumns"
        filename="movimientos-inventario"
      />
    </div>
    <p v-if="actionError" role="alert" class="mb-4 text-sm text-danger">
      {{ actionError }}
    </p>

    <section
      v-if="lowStockItems.length"
      class="mb-5 overflow-hidden rounded-2xl border border-warning/25 bg-warning/5"
    >
      <div
        class="flex items-center gap-3 border-b border-warning/15 px-5 py-3"
      >
        <span class="text-sm font-black text-warning"
          >Productos con stock bajo pendientes de atención</span
        >
      </div>
      <ul class="divide-y divide-warning/10">
        <li
          v-for="item in lowStockItems"
          :key="item.id"
          class="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <p class="text-sm font-bold text-ink">{{ item.nombre }}</p>
            <p class="text-xs text-muted">
              {{ item.stock_actual }} / mín {{ item.stock_minimo }}
            </p>
          </div>
          <span
            v-if="item.pending_restock"
            class="w-fit rounded-full border border-success/25 bg-success/10 px-3 py-1 text-xs font-black uppercase tracking-widest text-success"
          >
            Pedido en curso
          </span>
          <button
            v-else
            type="button"
            :disabled="marking === item.id"
            class="w-fit rounded-lg border border-warning/30 px-3 py-1.5 text-xs font-black uppercase tracking-widest text-warning hover:bg-warning/10 disabled:opacity-50"
            @click="markOrdered(item)"
          >
            Marcar como pedido
          </button>
        </li>
      </ul>
    </section>

    <section v-if="stats" class="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
      <div class="rounded-2xl border border-line bg-card p-4">
        <p
          class="mb-1 text-xs font-black uppercase tracking-wider text-muted"
        >
          Total
        </p>
        <p class="text-2xl font-black text-ink">{{ stats.total }}</p>
      </div>
      <div class="rounded-2xl border border-line bg-card p-4">
        <p
          class="mb-1 text-xs font-black uppercase tracking-wider text-muted"
        >
          Entradas
        </p>
        <p class="text-2xl font-black text-success">{{ stats.entradas }}</p>
      </div>
      <div class="rounded-2xl border border-line bg-card p-4">
        <p
          class="mb-1 text-xs font-black uppercase tracking-wider text-muted"
        >
          Salidas
        </p>
        <p class="text-2xl font-black text-warning">{{ stats.salidas }}</p>
      </div>
      <div class="rounded-2xl border border-line bg-card p-4">
        <p
          class="mb-1 text-xs font-black uppercase tracking-wider text-muted"
        >
          Hoy
        </p>
        <p class="text-2xl font-black text-gold">{{ stats.hoy }}</p>
      </div>
    </section>

    <section class="mb-5 flex flex-wrap items-center gap-3">
      <UiSearchInput v-model="search" label="Buscar producto o motivo" placeholder="Buscar por producto o motivo…" />
      <UiFilterChips v-model="tipoFilter" label="Filtrar por tipo" :options="TIPO_OPCIONES" />
      <label for="movement-filter-product" class="sr-only"
        >Filtrar por producto</label
      >
      <select
        id="movement-filter-product"
        v-model="productFilter"
        class="rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink"
      >
        <option value="">Todos los productos</option>
        <option v-for="p in products" :key="p.id" :value="p.id">
          {{ p.nombre }}
        </option>
      </select>
      <UiDateRange v-model:from="fechaDesde" v-model:to="fechaHasta" from-label="Desde" to-label="Hasta" />
      <button
        v-if="search || tipoFilter || productFilter || fechaDesde || fechaHasta"
        type="button"
        class="text-xs font-bold uppercase tracking-widest text-muted hover:text-ink"
        @click="clearFilters"
      >
        Limpiar filtros
      </button>
    </section>

    <BrandStatePanel
      v-if="error"
      mascot="bruno"
      state="error"
      tone="danger"
      title="No se pudo cargar el historial"
      description="Inténtalo nuevamente en unos minutos."
      action-label="Reintentar"
      @action="refresh"
    />
    <UiDataTable
      v-else
      :columns="COLUMNAS"
      :rows="movements"
      :loading="pending"
      aria-label="Movimientos de inventario"
      empty-title="Todavía no hay movimientos"
      empty-description="Las entradas y salidas de inventario aparecerán aquí."
    >
      <template #cell-fecha="{ row }"><span class="text-muted">{{ fmtDateTime(row.fecha) }}</span></template>
      <template #cell-producto="{ row }"><span class="font-bold text-ink">{{ row.product.nombre ?? "—" }}</span></template>
      <template #cell-tipo="{ row }">
        <span
          class="rounded-full border px-2 py-0.5 text-xs font-black uppercase"
          :class="row.tipo === 'entrada' ? 'border-success/25 bg-success/10 text-success' : 'border-warning/25 bg-warning/10 text-warning'"
        >
          {{ row.tipo }}
        </span>
      </template>
      <template #cell-cantidad="{ row }">
        <span class="font-black text-ink">{{ row.tipo === "entrada" ? "+" : "−" }}{{ row.cantidad }}</span>
      </template>
      <template #cell-motivo="{ row }"><span class="text-muted">{{ row.motivo ?? "—" }}</span></template>
      <template #cell-responsable="{ row }"><span class="text-muted">{{ row.user.name ?? "—" }}</span></template>
    </UiDataTable>
    <UiPagination
      v-if="pagination"
      v-model:current-page="page"
      :last-page="pagination.last_page"
      :total="pagination.total"
      :per-page="10"
      :busy="pending"
    />

    <UiFormSheet
      v-if="showForm"
      title="Nuevo movimiento"
      kicker="Control de inventario"
      icon="box"
      subtitle="Registra una entrada o salida con los datos que admite el sistema."
      form-id="movement-form"
      submit-label="Registrar"
      hint="El stock se actualiza al registrar"
      :submit-disabled="!form.product_id"
      :busy="saving"
      @close="closeForm"
    >
        <form id="movement-form" class="space-y-6" @submit.prevent="submitForm">
          <section class="space-y-4" aria-labelledby="mv-what">
            <p id="mv-what" class="ub-form-section__title">Movimiento</p>
            <UiChoiceCards
              v-model="form.tipo"
              label="Tipo"
              hide-label
              :options="tipoOptions"
              :columns="2"
            />
            <p v-if="!isAdmin" class="ub-form-help">Recepción solo puede registrar salidas.</p>
            <p v-if="mErr('tipo')" class="text-xs text-danger">{{ mErr("tipo") }}</p>
            <UiFormField field-id="movement-product" label="Producto" icon="box" :error="mErr('product_id')">
              <select
                id="movement-product"
                v-model="form.product_id"
                aria-label="Producto"
                required
                :aria-invalid="!!mErr('product_id')"
                :aria-describedby="mErr('product_id') ? 'movement-product-error' : undefined"
                :class="mInput('product_id')"
              >
                <option value="" disabled>Selecciona…</option>
                <option v-for="p in products" :key="p.id" :value="p.id">
                  {{ p.nombre }}
                </option>
              </select>
            </UiFormField>
            <UiFormField field-id="movement-quantity" label="Cantidad" icon="plus" :error="mErr('cantidad')">
              <input
                id="movement-quantity"
                v-model.number="form.cantidad"
                aria-label="Cantidad"
                type="number"
                min="1"
                required
                :aria-invalid="!!mErr('cantidad')"
                :aria-describedby="mErr('cantidad') ? 'movement-quantity-error' : undefined"
                :class="mInput('cantidad')"
              >
            </UiFormField>
            <div class="ub-apptcard" aria-label="Resumen del movimiento">
              <span class="ub-apptcard__avatar"><UiIcon name="box" /></span>
              <span class="min-w-0 flex-1">
                <b class="block truncate text-sm text-ink">{{ movementProduct || "Producto sin elegir" }}</b>
                <small class="block truncate text-xs text-muted">{{ form.tipo === "entrada" ? "Reposición" : "Consumo" }}</small>
              </span>
              <span class="ub-apptcard__pill">{{ form.tipo === "entrada" ? "+" : "−" }}{{ form.cantidad || 0 }}</span>
            </div>
          </section>

          <section class="space-y-4" aria-labelledby="mv-more">
            <p id="mv-more" class="ub-form-section__title">Detalles</p>
            <UiFormField field-id="movement-reason" label="Motivo (opcional)" icon="text" :error="mErr('motivo')">
              <input
                id="movement-reason"
                v-model="form.motivo"
                aria-label="Motivo (opcional)"
                type="text"
                maxlength="255"
                :aria-invalid="!!mErr('motivo')"
                :aria-describedby="mErr('motivo') ? 'movement-reason-error' : undefined"
                :class="mInput('motivo')"
              >
            </UiFormField>
            <div class="grid gap-3 sm:grid-cols-2">
              <UiFormField
                field-id="movement-appointment"
                label="Cita asociada (opcional)"
                icon="calendar"
                hint="Úsalo si corresponde al consumo de una cita."
                :error="mErr('appointment_id')"
              >
                <input
                  id="movement-appointment"
                  v-model="form.appointment_id"
                  aria-label="Cita asociada (opcional)"
                  type="text"
                  placeholder="ID de la cita"
                  :aria-invalid="!!mErr('appointment_id')"
                  :class="mInput('appointment_id')"
                >
              </UiFormField>
              <UiFormField
                field-id="movement-date"
                label="Fecha del movimiento (opcional)"
                icon="clock"
                hint="Vacío = fecha actual."
                :error="mErr('fecha')"
              >
                <input
                  id="movement-date"
                  v-model="form.fecha"
                  aria-label="Fecha del movimiento (opcional)"
                  type="date"
                  :aria-invalid="!!mErr('fecha')"
                  :class="mInput('fecha')"
                >
              </UiFormField>
            </div>
          </section>

          <p v-if="formError" role="alert" class="text-sm text-danger">
            {{ formError }}
          </p>
        </form>
    </UiFormSheet>
  </div>
</template>
