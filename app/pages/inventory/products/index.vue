<script setup lang="ts">
/*
 * Fase 9.5 — gestión de inventario y productos, panel admin.
 * Api/Inventory/ProductController maneja el CRUD completo bajo
 * /inventory/products.
 */
definePageMeta({ middleware: ['auth', 'admin'], layout: 'dashboard' })

interface ProductRow {
  id: string
  nombre: string
  categoria: string
  descripcion: string | null
  precio_compra: number
  precio_venta: number
  stock_actual: number
  stock_minimo: number
  tipo: string
  imagen?: string | null
  activo?: boolean
}

interface Stats {
  total_productos: number
  valor_inventario: number
  bajo_stock: number
  sin_stock: number
}

interface LowStockItem {
  id: string
  nombre: string
  stock_actual: number
  stock_minimo: number
  categoria: string
  pending_restock: boolean
  ordered_at: string | null
}

interface ProductsResponse {
  data: ProductRow[]
  meta: {
    current_page: number
    last_page: number
    total: number
    stats: Stats
    categorias: string[]
    tipos: string[]
  }
}

const { apiFetch } = useApi()
const { confirm } = useConfirm()

const search = ref('')
const categoria = ref('')
const tipo = ref('')
const soloBajoStock = ref(false)

const { data: response, pending, error, refresh } = await useAsyncData<ProductsResponse>(
  'inventory-products',
  () => apiFetch<ProductsResponse>('/inventory/products', {
    query: { q: search.value || undefined, categoria: categoria.value || undefined, tipo: tipo.value || undefined, bajo_stock: soloBajoStock.value ? 1 : undefined },
  }),
  { watch: [search, categoria, tipo, soloBajoStock] },
)
const products = computed(() => response.value?.data ?? [])
const stats = computed(() => response.value?.meta.stats)
const categorias = computed(() => response.value?.meta.categorias ?? [])
const tipos = computed(() => response.value?.meta.tipos ?? [])

const { data: lowStockRes, refresh: refreshLowStock } = await useAsyncData('inventory-low-stock', () => apiFetch<{ data: LowStockItem[] }>('/inventory/low-stock'))
const lowStockItems = computed(() => lowStockRes.value?.data ?? [])

function clearFilters() {
  search.value = ''
  categoria.value = ''
  tipo.value = ''
  soloBajoStock.value = false
}

function fmtMoney(n: number) {
  return `$${Number(n ?? 0).toFixed(0)}`
}

const marking = ref<string | null>(null)
const actionNotice = ref('')

async function markOrdered(item: LowStockItem) {
  marking.value = item.id
  actionNotice.value = ''
  try {
    await apiFetch(`/inventory/products/${item.id}/mark-ordered`, { method: 'POST' })
    actionNotice.value = `Producto "${item.nombre}" marcado como pedido en curso.`
    await Promise.all([refreshLowStock(), refresh()])
  } catch (err: unknown) {
    const dataErr = (err as { data?: { message?: string } })?.data
    actionNotice.value = dataErr?.message ?? 'No se pudo marcar el producto como pedido.'
  } finally {
    marking.value = null
  }
}

// ── Crear / editar ───────────────────────────────────────────────────────
const showForm = ref(false)
const editing = ref<ProductRow | null>(null)
const form = reactive({
  nombre: '',
  categoria: '',
  descripcion: '',
  precio_compra: 0,
  precio_venta: 0,
  stock_actual: 0,
  stock_minimo: 0,
  tipo: 'venta_cliente',
  imagen: '',
  activo: true,
})
const formError = ref('')
const fieldErrors = ref<Record<string, string[]>>({})
const saving = ref(false)

function openCreate() {
  editing.value = null
  form.nombre = ''
  form.categoria = categorias.value[0] ?? 'Cuidado del Cabello'
  form.descripcion = ''
  form.precio_compra = 0
  form.precio_venta = 0
  form.stock_actual = 0
  form.stock_minimo = 5
  form.tipo = 'venta_cliente'
  form.imagen = ''
  form.activo = true
  formError.value = ''
  fieldErrors.value = {}
  showForm.value = true
}

function openEdit(product: ProductRow) {
  editing.value = product
  form.nombre = product.nombre
  form.categoria = product.categoria ?? ''
  form.descripcion = product.descripcion ?? ''
  form.precio_compra = product.precio_compra
  form.precio_venta = product.precio_venta
  form.stock_actual = product.stock_actual
  form.stock_minimo = product.stock_minimo
  form.tipo = product.tipo
  form.imagen = product.imagen ?? ''
  form.activo = product.activo ?? true
  formError.value = ''
  fieldErrors.value = {}
  showForm.value = true
}

async function submitForm() {
  saving.value = true
  formError.value = ''
  fieldErrors.value = {}

  try {
    const body = { ...form }
    if (editing.value) {
      await apiFetch(`/inventory/products/${editing.value.id}`, { method: 'PUT', body })
    } else {
      await apiFetch('/inventory/products', { method: 'POST', body })
    }
    showForm.value = false
    await Promise.all([refresh(), refreshLowStock()])
  } catch (err: unknown) {
    const dataErr = (err as { data?: { message?: string, errors?: Record<string, string[]> } })?.data
    if (dataErr?.errors) {
      fieldErrors.value = dataErr.errors
    }
    formError.value = dataErr?.message ?? 'No se pudo guardar el producto. Verifica los datos.'
  } finally {
    saving.value = false
  }
}

async function removeProduct(product: ProductRow) {
  const ok = await confirm({
    title: 'Eliminar producto',
    message: `¿Estás seguro de que deseas eliminar "${product.nombre}" del catálogo de inventario? Esta acción no se puede deshacer.`,
    confirmText: 'Sí, eliminar',
    isDanger: true,
  })
  if (!ok) return

  try {
    await apiFetch(`/inventory/products/${product.id}`, { method: 'DELETE' })
    await Promise.all([refresh(), refreshLowStock()])
  } catch (err: unknown) {
    const dataErr = (err as { data?: { message?: string } })?.data
    actionNotice.value = dataErr?.message ?? 'No se pudo eliminar el producto.'
  }
}
</script>

<template>
  <div class="p-4 sm:p-6 lg:p-8">
    <header class="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p class="text-sm uppercase tracking-widest text-muted">UrbanBlade</p>
        <h1 class="mt-1 text-2xl font-semibold text-ink">Gestión de <span class="text-gold">Inventario</span></h1>
        <p class="mt-1 text-sm text-muted">Control de stock, productos y suministros.</p>
      </div>
      <div class="flex items-center gap-3">
        <NuxtLink to="/inventory/movements" class="rounded-lg border border-line px-4 py-2 text-sm text-muted hover:text-ink">Movimientos</NuxtLink>
        <button type="button" class="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-black hover:bg-gold-dim" @click="openCreate">+ Nuevo Producto</button>
      </div>
    </header>

    <div v-if="actionNotice" class="mb-5 rounded-xl border border-gold/30 bg-gold/10 p-4 text-xs font-semibold text-gold">
      {{ actionNotice }}
    </div>

    <!-- Alerta de bajo stock -->
    <section v-if="lowStockItems.length" class="mb-5 overflow-hidden rounded-2xl border border-amber-500/25 bg-amber-500/5">
      <div class="flex items-center gap-3 border-b border-amber-500/15 px-5 py-3">
        <span class="text-sm font-black text-amber-300">Productos con stock bajo pendientes de atención</span>
      </div>
      <ul class="divide-y divide-amber-500/10">
        <li v-for="item in lowStockItems" :key="item.id" class="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p class="text-sm font-bold text-ink">{{ item.nombre }}</p>
            <p class="text-[10px] text-muted">{{ item.stock_actual }} en existencia / mín {{ item.stock_minimo }}</p>
          </div>
          <span v-if="item.pending_restock" class="w-fit rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-emerald-400">
            Pedido en curso
          </span>
          <button
            v-else
            type="button"
            :disabled="marking === item.id"
            class="w-fit rounded-lg border border-amber-500/30 px-3 py-1 text-xs font-bold text-amber-300 hover:bg-amber-500/10 disabled:opacity-50"
            @click="markOrdered(item)"
          >
            {{ marking === item.id ? 'Marcando…' : 'Marcar como pedido' }}
          </button>
        </li>
      </ul>
    </section>

    <!-- Tarjetas de resumen -->
    <section v-if="stats" class="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
      <div class="ui-card p-4">
        <p class="text-xs font-semibold uppercase tracking-wider text-muted">Productos</p>
        <p class="mt-2 text-2xl font-black text-ink">{{ stats.total_productos }}</p>
      </div>
      <div class="ui-card p-4">
        <p class="text-xs font-semibold uppercase tracking-wider text-muted">Valor Inventario</p>
        <p class="mt-2 text-2xl font-black text-emerald-400">{{ fmtMoney(stats.valor_inventario) }}</p>
      </div>
      <div class="ui-card p-4">
        <p class="text-xs font-semibold uppercase tracking-wider text-muted">Bajo Stock</p>
        <p class="mt-2 text-2xl font-black text-amber-400">{{ stats.bajo_stock }}</p>
      </div>
      <div class="ui-card p-4">
        <p class="text-xs font-semibold uppercase tracking-wider text-muted">Sin Stock</p>
        <p class="mt-2 text-2xl font-black text-red-400">{{ stats.sin_stock }}</p>
      </div>
    </section>

    <!-- Filtros -->
    <section class="mb-5 flex flex-wrap items-center gap-3">
      <input
        v-model="search"
        type="text"
        placeholder="Buscar producto…"
        class="w-full rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink focus:border-gold focus:outline-hidden sm:max-w-xs"
      >
      <select v-model="categoria" class="rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink focus:border-gold focus:outline-hidden">
        <option value="">Todas las categorías</option>
        <option v-for="c in categorias" :key="c" :value="c">{{ c }}</option>
      </select>
      <select v-model="tipo" class="rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink focus:border-gold focus:outline-hidden">
        <option value="">Todos los tipos</option>
        <option v-for="t in tipos" :key="t" :value="t">{{ t === 'venta_cliente' ? 'Venta' : 'Insumo' }}</option>
      </select>
      <label class="flex cursor-pointer items-center gap-2 text-xs font-semibold text-ink">
        <input v-model="soloBajoStock" type="checkbox" class="h-4 w-4 rounded border-line text-gold focus:ring-gold">
        Solo bajo stock
      </label>
      <button
        v-if="search || categoria || tipo || soloBajoStock"
        type="button"
        class="text-xs font-bold uppercase tracking-widest text-muted hover:text-ink"
        @click="clearFilters"
      >
        Limpiar filtros
      </button>
    </section>

    <div v-if="pending" class="flex items-center gap-3 py-12 text-sm text-muted">
      <div class="h-5 w-5 animate-spin rounded-full border-2 border-gold border-t-transparent" />
      <span>Cargando productos…</span>
    </div>

    <p v-else-if="error" class="text-sm text-red-400">No se pudo cargar el inventario.</p>

    <!-- Tabla de productos -->
    <section v-else class="ui-card overflow-x-auto">
      <table class="w-full text-left text-sm">
        <thead>
          <tr class="border-b border-line text-[10px] uppercase tracking-wider text-muted">
            <th class="px-4 py-3">Producto</th>
            <th class="px-4 py-3">Categoría</th>
            <th class="px-4 py-3 text-right">Precio</th>
            <th class="px-4 py-3 text-center">Stock</th>
            <th class="px-4 py-3 text-center">Tipo</th>
            <th class="px-4 py-3 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="product in products" :key="product.id" class="border-b border-line/60 last:border-0">
            <td class="px-4 py-3">
              <div class="flex items-center gap-3">
                <img
                  v-if="product.imagen"
                  :src="product.imagen"
                  :alt="product.nombre"
                  class="h-9 w-9 rounded-lg border border-line object-cover"
                >
                <div v-else class="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-ink/5 text-xs text-muted">
                  📦
                </div>
                <div>
                  <p class="font-bold text-ink">{{ product.nombre }}</p>
                  <p v-if="product.descripcion" class="line-clamp-1 text-xs text-muted">{{ product.descripcion }}</p>
                </div>
              </div>
            </td>
            <td class="px-4 py-3 text-muted">{{ product.categoria }}</td>
            <td class="px-4 py-3 text-right font-black text-ink">{{ fmtMoney(product.precio_venta) }}</td>
            <td class="px-4 py-3 text-center">
              <span
                class="rounded-full border px-2 py-0.5 text-[9px] font-black uppercase"
                :class="product.stock_actual <= product.stock_minimo ? 'border-amber-500/25 bg-amber-500/10 text-amber-300' : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'"
              >
                {{ product.stock_actual }}
              </span>
            </td>
            <td class="px-4 py-3 text-center">
              <span class="rounded-full border border-line bg-ink/5 px-2 py-0.5 text-[9px] font-black uppercase text-muted">
                {{ product.tipo === 'venta_cliente' ? 'Venta' : 'Insumo' }}
              </span>
            </td>
            <td class="px-4 py-3">
              <div class="flex justify-end gap-2">
                <button
                  type="button"
                  class="rounded-lg border border-line px-3 py-1 text-xs text-muted hover:text-ink"
                  @click="openEdit(product)"
                >
                  Editar
                </button>
                <button
                  type="button"
                  class="rounded-lg border border-red-500/20 px-3 py-1 text-xs text-red-400 hover:bg-red-500/10"
                  @click="removeProduct(product)"
                >
                  Eliminar
                </button>
              </div>
            </td>
          </tr>
          <tr v-if="!products.length">
            <td colspan="6" class="px-4 py-12 text-center text-sm text-muted">Sin productos registrados.</td>
          </tr>
        </tbody>
      </table>
    </section>

    <!-- Modal Crear / Editar Producto -->
    <div
      v-if="showForm"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-label="Formulario de producto"
      @click.self="showForm = false"
    >
      <div class="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-line bg-card p-6 shadow-2xl">
        <h2 class="mb-4 text-lg font-semibold text-ink">
          {{ editing ? 'Editar producto' : 'Nuevo producto' }}
        </h2>

        <form class="space-y-4" @submit.prevent="submitForm">
          <div>
            <label for="prod-nombre" class="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">Nombre del producto</label>
            <input
              id="prod-nombre"
              v-model="form.nombre"
              type="text"
              required
              placeholder="Ej. Cera Mate Fijación Fuerte"
              :class="['w-full rounded-lg border bg-main px-3 py-2 text-sm text-ink focus:outline-hidden', fieldErrors.nombre ? 'border-red-500/60 focus:border-red-500' : 'border-line focus:border-gold']"
            >
            <p v-if="fieldErrors.nombre" class="mt-1 text-xs text-red-400">{{ fieldErrors.nombre[0] }}</p>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label for="prod-categoria" class="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">Categoría</label>
              <input
                id="prod-categoria"
                v-model="form.categoria"
                type="text"
                required
                list="prod-categories-list"
                placeholder="Ej. Ceras, Shampoos…"
                :class="['w-full rounded-lg border bg-main px-3 py-2 text-sm text-ink focus:outline-hidden', fieldErrors.categoria ? 'border-red-500/60 focus:border-red-500' : 'border-line focus:border-gold']"
              >
              <datalist id="prod-categories-list">
                <option v-for="c in categorias" :key="c" :value="c" />
              </datalist>
              <p v-if="fieldErrors.categoria" class="mt-1 text-xs text-red-400">{{ fieldErrors.categoria[0] }}</p>
            </div>
            <div>
              <label for="prod-tipo" class="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">Tipo de producto</label>
              <select
                id="prod-tipo"
                v-model="form.tipo"
                class="w-full rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink focus:border-gold focus:outline-hidden"
              >
                <option value="venta_cliente">Venta al cliente</option>
                <option value="insumo_barberia">Insumo interno de barbería</option>
              </select>
            </div>
          </div>

          <div>
            <label for="prod-imagen" class="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">URL de Imagen del producto (opcional)</label>
            <input
              id="prod-imagen"
              v-model="form.imagen"
              type="text"
              placeholder="https://... o ruta de imagen"
              class="w-full rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink focus:border-gold focus:outline-hidden"
            >
          </div>

          <div>
            <label for="prod-descripcion" class="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">Descripción (opcional)</label>
            <textarea
              id="prod-descripcion"
              v-model="form.descripcion"
              rows="2"
              placeholder="Detalles sobre presentación, aroma o ingredientes…"
              class="w-full rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink focus:border-gold focus:outline-hidden"
            />
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label for="prod-precio-compra" class="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">Precio compra / Costo ($)</label>
              <input
                id="prod-precio-compra"
                v-model.number="form.precio_compra"
                type="number"
                step="0.01"
                min="0"
                required
                :class="['w-full rounded-lg border bg-main px-3 py-2 text-sm text-ink focus:outline-hidden', fieldErrors.precio_compra ? 'border-red-500/60 focus:border-red-500' : 'border-line focus:border-gold']"
              >
              <p v-if="fieldErrors.precio_compra" class="mt-1 text-xs text-red-400">{{ fieldErrors.precio_compra[0] }}</p>
            </div>
            <div>
              <label for="prod-precio-venta" class="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">Precio venta ($)</label>
              <input
                id="prod-precio-venta"
                v-model.number="form.precio_venta"
                type="number"
                step="0.01"
                min="0"
                required
                :class="['w-full rounded-lg border bg-main px-3 py-2 text-sm text-ink focus:outline-hidden', fieldErrors.precio_venta ? 'border-red-500/60 focus:border-red-500' : 'border-line focus:border-gold']"
              >
              <p v-if="fieldErrors.precio_venta" class="mt-1 text-xs text-red-400">{{ fieldErrors.precio_venta[0] }}</p>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label for="prod-stock-actual" class="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">Stock actual</label>
              <input
                id="prod-stock-actual"
                v-model.number="form.stock_actual"
                type="number"
                min="0"
                required
                :class="['w-full rounded-lg border bg-main px-3 py-2 text-sm text-ink focus:outline-hidden', fieldErrors.stock_actual ? 'border-red-500/60 focus:border-red-500' : 'border-line focus:border-gold']"
              >
              <p v-if="fieldErrors.stock_actual" class="mt-1 text-xs text-red-400">{{ fieldErrors.stock_actual[0] }}</p>
            </div>
            <div>
              <label for="prod-stock-minimo" class="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">Stock mínimo de alerta</label>
              <input
                id="prod-stock-minimo"
                v-model.number="form.stock_minimo"
                type="number"
                min="0"
                required
                :class="['w-full rounded-lg border bg-main px-3 py-2 text-sm text-ink focus:outline-hidden', fieldErrors.stock_minimo ? 'border-red-500/60 focus:border-red-500' : 'border-line focus:border-gold']"
              >
              <p v-if="fieldErrors.stock_minimo" class="mt-1 text-xs text-red-400">{{ fieldErrors.stock_minimo[0] }}</p>
            </div>
          </div>

          <label class="flex cursor-pointer items-center gap-2 text-sm text-ink">
            <input v-model="form.activo" type="checkbox" class="h-4 w-4 rounded border-line text-gold focus:ring-gold">
            <span>Activo en catálogo y tienda</span>
          </label>

          <p v-if="formError" class="text-xs text-red-400">{{ formError }}</p>

          <div class="mt-6 flex justify-end gap-3 pt-2">
            <button
              type="button"
              class="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-muted hover:text-ink"
              @click="showForm = false"
            >
              Cancelar
            </button>
            <button
              type="submit"
              :disabled="saving"
              class="rounded-lg bg-gold px-5 py-2 text-sm font-bold text-black hover:bg-gold-dim disabled:opacity-50"
            >
              {{ saving ? 'Guardando…' : 'Guardar producto' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
