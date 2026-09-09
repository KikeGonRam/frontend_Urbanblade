<script setup lang="ts">
/*
 * Fase 9.5 — historial de movimientos de inventario, puerto de
 * Inventory\InventoryMovementController (web). Admin puede registrar
 * entradas (reposición) y salidas; recepción solo salidas (consumo) —
 * misma regla que enforca Api/Inventory/InventoryController::storeMovement()
 * del lado servidor, aquí solo se oculta la opción para no invitar un 422.
 */
definePageMeta({ middleware: ["auth", "staff"], layout: "dashboard" });

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

const { apiFetch } = useApi();
const { hasRole } = useAuth();
const isAdmin = computed(() => hasRole("administrador"));

const search = ref("");
const debouncedSearch = useDebounce(search, 350);
const tipoFilter = ref("");
const productFilter = ref("");

const {
  data: response,
  pending,
  error,
  refresh,
} = await useAsyncData<MovementsResponse>(
  "inventory-movements",
  () =>
    apiFetch<MovementsResponse>("/inventory/movements", {
      query: {
        q: search.value || undefined,
        tipo: tipoFilter.value || undefined,
        product_id: productFilter.value || undefined,
      },
    }),
  { watch: [debouncedSearch, tipoFilter, productFilter], lazy: true },
);
const movements = computed(() => response.value?.data ?? []);
const stats = computed(() => response.value?.meta.stats);

const { data: productsRes } = await useAsyncData(
  "inventory-movements-products",
  () => apiFetch<{ data: ProductOption[] }>("/inventory/products"),
);
const products = computed<ProductOption[]>(
  () =>
    productsRes.value?.data.map((p) => ({ id: p.id, nombre: p.nombre })) ?? [],
);

const { data: lowStockRes, refresh: refreshLowStock } = await useAsyncData(
  "inventory-movements-low-stock",
  () => apiFetch<{ data: LowStockItem[] }>("/inventory/low-stock"),
);
const lowStockItems = computed(() => lowStockRes.value?.data ?? []);

function clearFilters() {
  search.value = "";
  tipoFilter.value = "";
  productFilter.value = "";
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
const form = reactive({
  product_id: "",
  tipo: "salida",
  cantidad: 1,
  motivo: "",
});
const formError = ref("");
const fieldErrors = ref<Record<string, string[]>>({});
const saving = ref(false);

function openCreate() {
  form.product_id = "";
  form.tipo = "salida";
  form.cantidad = 1;
  form.motivo = "";
  formError.value = "";
  fieldErrors.value = {};
  showForm.value = true;
}

function closeForm() {
  if (saving.value) return;
  showForm.value = false;
}

function onFormKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") closeForm();
}

onMounted(() => {
  if (import.meta.client) window.addEventListener("keydown", onFormKeydown);
});
onUnmounted(() => {
  if (import.meta.client) window.removeEventListener("keydown", onFormKeydown);
});

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
        <p class="text-sm uppercase tracking-widest text-muted">UrbanBlade</p>
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
    <p v-if="actionError" role="alert" class="mb-4 text-sm text-red-400">
      {{ actionError }}
    </p>

    <section
      v-if="lowStockItems.length"
      class="mb-5 overflow-hidden rounded-2xl border border-amber-500/25 bg-amber-500/5"
    >
      <div
        class="flex items-center gap-3 border-b border-amber-500/15 px-5 py-3"
      >
        <span class="text-sm font-black text-amber-300"
          >Productos con stock bajo pendientes de atención</span
        >
      </div>
      <ul class="divide-y divide-amber-500/10">
        <li
          v-for="item in lowStockItems"
          :key="item.id"
          class="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <p class="text-sm font-bold text-ink">{{ item.nombre }}</p>
            <p class="text-[10px] text-muted">
              {{ item.stock_actual }} / mín {{ item.stock_minimo }}
            </p>
          </div>
          <span
            v-if="item.pending_restock"
            class="w-fit rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-emerald-400"
          >
            Pedido en curso
          </span>
          <button
            v-else
            type="button"
            :disabled="marking === item.id"
            class="w-fit rounded-lg border border-amber-500/30 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-amber-300 hover:bg-amber-500/10 disabled:opacity-50"
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
          class="mb-1 text-[10px] font-black uppercase tracking-wider text-muted"
        >
          Total
        </p>
        <p class="text-2xl font-black text-ink">{{ stats.total }}</p>
      </div>
      <div class="rounded-2xl border border-line bg-card p-4">
        <p
          class="mb-1 text-[10px] font-black uppercase tracking-wider text-muted"
        >
          Entradas
        </p>
        <p class="text-2xl font-black text-emerald-400">{{ stats.entradas }}</p>
      </div>
      <div class="rounded-2xl border border-line bg-card p-4">
        <p
          class="mb-1 text-[10px] font-black uppercase tracking-wider text-muted"
        >
          Salidas
        </p>
        <p class="text-2xl font-black text-amber-400">{{ stats.salidas }}</p>
      </div>
      <div class="rounded-2xl border border-line bg-card p-4">
        <p
          class="mb-1 text-[10px] font-black uppercase tracking-wider text-muted"
        >
          Hoy
        </p>
        <p class="text-2xl font-black text-gold">{{ stats.hoy }}</p>
      </div>
    </section>

    <section class="mb-5 flex flex-wrap items-center gap-3">
      <label for="movement-search" class="sr-only"
        >Buscar producto o motivo</label
      >
      <input
        id="movement-search"
        v-model="search"
        type="text"
        placeholder="Producto o motivo…"
        class="w-full rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink sm:max-w-xs"
      />
      <label for="movement-filter-type" class="sr-only">Filtrar por tipo</label>
      <select
        id="movement-filter-type"
        v-model="tipoFilter"
        class="rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink"
      >
        <option value="">Todos los tipos</option>
        <option value="entrada">Entrada</option>
        <option value="salida">Salida</option>
      </select>
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
      <button
        v-if="search || tipoFilter || productFilter"
        type="button"
        class="text-xs font-bold uppercase tracking-widest text-muted hover:text-ink"
        @click="clearFilters"
      >
        Limpiar filtros
      </button>
    </section>

    <p v-if="pending" class="text-sm text-muted">Cargando movimientos…</p>
    <p v-else-if="error" class="text-sm text-red-400">
      No se pudo cargar el historial.
    </p>

    <section v-else class="ui-card overflow-x-auto">
      <table class="w-full text-left text-sm">
        <thead>
          <tr
            class="border-b border-line text-[10px] uppercase tracking-wider text-muted"
          >
            <th class="px-4 py-3">Fecha</th>
            <th class="px-4 py-3">Producto</th>
            <th class="px-4 py-3">Tipo</th>
            <th class="px-4 py-3 text-right">Cantidad</th>
            <th class="px-4 py-3">Motivo</th>
            <th class="px-4 py-3">Responsable</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="movement in movements"
            :key="movement.id"
            class="border-b border-line/60 last:border-0"
          >
            <td class="px-4 py-3 text-muted">
              {{ fmtDateTime(movement.fecha) }}
            </td>
            <td class="px-4 py-3 font-bold text-ink">
              {{ movement.product.nombre ?? "—" }}
            </td>
            <td class="px-4 py-3">
              <span
                class="rounded-full border px-2 py-0.5 text-[9px] font-black uppercase"
                :class="
                  movement.tipo === 'entrada'
                    ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
                    : 'border-amber-500/25 bg-amber-500/10 text-amber-300'
                "
              >
                {{ movement.tipo }}
              </span>
            </td>
            <td class="px-4 py-3 text-right font-black text-ink">
              {{ movement.tipo === "entrada" ? "+" : "−"
              }}{{ movement.cantidad }}
            </td>
            <td class="px-4 py-3 text-muted">{{ movement.motivo ?? "—" }}</td>
            <td class="px-4 py-3 text-muted">
              {{ movement.user.name ?? "—" }}
            </td>
          </tr>
          <tr v-if="!movements.length">
            <td colspan="6" class="px-4 py-12 text-center text-sm text-muted">
              Sin movimientos.
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <div
      v-if="showForm"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="movement-form-title"
      @click.self="closeForm"
    >
      <div class="w-full max-w-md rounded-2xl border border-line bg-card p-6">
        <h2
          id="movement-form-title"
          class="mb-4 text-lg font-semibold text-ink"
        >
          Nuevo movimiento
        </h2>
        <form class="space-y-3" @submit.prevent="submitForm">
          <div>
            <label for="movement-product" class="mb-1 block text-xs text-muted"
              >Producto</label
            >
            <select
              id="movement-product"
              v-model="form.product_id"
              required
              :aria-invalid="!!fieldErrors.product_id"
              :aria-describedby="
                fieldErrors.product_id ? 'movement-product-error' : undefined
              "
              :class="[
                'w-full rounded-lg border bg-main px-3 py-2 text-sm text-ink',
                fieldErrors.product_id ? 'border-red-500/60' : 'border-line',
              ]"
            >
              <option value="" disabled>Selecciona…</option>
              <option v-for="p in products" :key="p.id" :value="p.id">
                {{ p.nombre }}
              </option>
            </select>
            <p
              v-if="fieldErrors.product_id"
              id="movement-product-error"
              class="mt-1 text-xs text-red-400"
            >
              {{ fieldErrors.product_id[0] }}
            </p>
          </div>
          <div>
            <label for="movement-type" class="mb-1 block text-xs text-muted"
              >Tipo</label
            >
            <select
              id="movement-type"
              v-model="form.tipo"
              :aria-invalid="!!fieldErrors.tipo"
              :aria-describedby="
                fieldErrors.tipo ? 'movement-type-error' : undefined
              "
              :class="[
                'w-full rounded-lg border bg-main px-3 py-2 text-sm text-ink',
                fieldErrors.tipo ? 'border-red-500/60' : 'border-line',
              ]"
            >
              <option value="salida">Salida (consumo)</option>
              <option v-if="isAdmin" value="entrada">
                Entrada (reposición)
              </option>
            </select>
            <p
              v-if="fieldErrors.tipo"
              id="movement-type-error"
              class="mt-1 text-xs text-red-400"
            >
              {{ fieldErrors.tipo[0] }}
            </p>
            <p v-if="!isAdmin" class="mt-1 text-[10px] italic text-muted">
              Recepción solo puede registrar salidas.
            </p>
          </div>
          <div>
            <label for="movement-quantity" class="mb-1 block text-xs text-muted"
              >Cantidad</label
            >
            <input
              id="movement-quantity"
              v-model.number="form.cantidad"
              type="number"
              min="1"
              required
              :aria-invalid="!!fieldErrors.cantidad"
              :aria-describedby="
                fieldErrors.cantidad ? 'movement-quantity-error' : undefined
              "
              :class="[
                'w-full rounded-lg border bg-main px-3 py-2 text-sm text-ink',
                fieldErrors.cantidad ? 'border-red-500/60' : 'border-line',
              ]"
            />
            <p
              v-if="fieldErrors.cantidad"
              id="movement-quantity-error"
              class="mt-1 text-xs text-red-400"
            >
              {{ fieldErrors.cantidad[0] }}
            </p>
          </div>
          <div>
            <label for="movement-reason" class="mb-1 block text-xs text-muted"
              >Motivo (opcional)</label
            >
            <input
              id="movement-reason"
              v-model="form.motivo"
              type="text"
              maxlength="255"
              :aria-invalid="!!fieldErrors.motivo"
              :aria-describedby="
                fieldErrors.motivo ? 'movement-reason-error' : undefined
              "
              :class="[
                'w-full rounded-lg border bg-main px-3 py-2 text-sm text-ink',
                fieldErrors.motivo ? 'border-red-500/60' : 'border-line',
              ]"
            />
            <p
              v-if="fieldErrors.motivo"
              id="movement-reason-error"
              class="mt-1 text-xs text-red-400"
            >
              {{ fieldErrors.motivo[0] }}
            </p>
          </div>
          <p v-if="formError" role="alert" class="text-sm text-red-400">
            {{ formError }}
          </p>
          <div class="mt-5 flex gap-3">
            <button
              type="submit"
              :disabled="saving || !form.product_id"
              class="flex-1 rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-black hover:bg-gold-dim disabled:opacity-50"
            >
              {{ saving ? "Guardando…" : "Registrar" }}
            </button>
            <button
              type="button"
              :disabled="saving"
              class="rounded-lg border border-line px-4 py-2 text-sm text-muted hover:text-ink disabled:opacity-50"
              @click="closeForm"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
