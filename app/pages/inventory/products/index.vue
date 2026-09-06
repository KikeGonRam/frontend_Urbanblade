<script setup lang="ts">
/*
 * Fase 9.5 del plan (ver .claude/skills/nuxt-migration-plan/SKILL.md) —
 * como 9.1-9.4, Inventory\ProductController (web) sigue siendo Blade
 * puro. Construida contra Api/Inventory/InventoryController, enriquecido
 * en esta misma fase con filtros (q/bajo_stock) + stats + categorias/
 * tipos que antes no existían. CRUD de productos es admin-only (misma
 * regla que el backend: recepción puede LEER inventario pero no crear/
 * editar/borrar productos, solo registrar movimientos de salida).
 */
definePageMeta({ middleware: ['auth', 'admin'], layout: 'dashboard' })

interface ProductRow {
  id: string
  nombre: string
  categoria: string | null
  descripcion: string | null
  tipo: string
  stock_actual: number
  stock_minimo: number
  precio_compra: number
  precio_venta: number
  low_stock: boolean
  pending_restock: boolean
  imagen_url: string | null
}

interface ProductsResponse {
  data: ProductRow[]
  meta: {
    current_page: number
    last_page: number
    total: number
    stats: { total: number, bajo_stock: number, valor_total: number }
    categorias: string[]
    tipos: string[]
  }
}

interface LowStockItem { id: string, nombre: string, stock_actual: number, stock_minimo: number, pending_restock: boolean }

const { apiFetch } = useApi()

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
async function markOrdered(item: LowStockItem) {
  marking.value = item.id
  try {
    await apiFetch(`/inventory/products/${item.id}/mark-ordered`, { method: 'POST' })
    await Promise.all([refreshLowStock(), refresh()])
  } catch {
    alert('No se pudo marcar el producto como pedido.')
  } finally {
    marking.value = null
  }
}

// ── Crear / editar ───────────────────────────────────────────────────────
const showForm = ref(false)
const editing = ref<ProductRow | null>(null)
const form = reactive({ nombre: '', categoria: '', descripcion: '', precio_compra: 0, precio_venta: 0, stock_actual: 0, stock_minimo: 0, tipo: 'venta_cliente' })
const formError = ref('')
const saving = ref(false)

function openCreate() {
  editing.value = null
  form.nombre = ''
  form.categoria = ''
  form.descripcion = ''
  form.precio_compra = 0
  form.precio_venta = 0
  form.stock_actual = 0
  form.stock_minimo = 0
  form.tipo = 'venta_cliente'
  formError.value = ''
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
  formError.value = ''
  showForm.value = true
}

async function submitForm() {
  saving.value = true
  formError.value = ''
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
    formError.value = (err as { data?: { message?: string } })?.data?.message ?? 'No se pudo guardar. Verifica los datos.'
  } finally {
    saving.value = false
  }
}

async function removeProduct(product: ProductRow) {
  if (!confirm(`¿Eliminar ${product.nombre}?`)) return

  try {
    await apiFetch(`/inventory/products/${product.id}`, { method: 'DELETE' })
    await Promise.all([refresh(), refreshLowStock()])
  } catch (err: unknown) {
    alert((err as { data?: { message?: string } })?.data?.message ?? 'No se pudo eliminar el producto.')
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

    <section v-if="lowStockItems.length" class="mb-5 overflow-hidden rounded-2xl border border-amber-500/25 bg-amber-500/5">
      <div class="flex items-center gap-3 border-b border-amber-500/15 px-5 py-3">
        <span class="text-sm font-black text-amber-300">Productos con stock bajo pendientes de atención</span>
      </div>
      <ul class="divide-y divide-amber-500/10">
        <li v-for="item in lowStockItems" :key="item.id" class="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p class="text-sm font-bold text-ink">{{ item.nombre }}</p>
            <p class="text-[10px] text-muted">{{ item.stock_actual }} / mín {{ item.stock_minimo }}</p>
          </div>
          <span v-if="item.pending_restock" class="w-fit rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-emerald-400">
            Pedido en curso
          </span>
          <button v-else type="button" :disabled="marking === item.id" class="w-fit rounded-lg border border-amber-500/30 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-amber-300 hover:bg-amber-500/10 disabled:opacity-50" @click="markOrdered(item)">
            Marcar como pedido
          </button>
        </li>
      </ul>
    </section>

    <section v-if="stats" class="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
      <div class="rounded-2xl border border-line bg-card p-4">
        <p class="mb-1 text-[10px] font-black uppercase tracking-wider text-muted">Total Productos</p>
        <p class="text-2xl font-black text-ink">{{ stats.total }}</p>
      </div>
      <div class="rounded-2xl border p-4" :class="stats.bajo_stock > 0 ? 'border-amber-500/25 bg-amber-500/5' : 'border-line bg-card'">
        <p class="mb-1 text-[10px] font-black uppercase tracking-wider" :class="stats.bajo_stock > 0 ? 'text-amber-400/70' : 'text-muted'">Bajo Stock</p>
        <p class="text-2xl font-black" :class="stats.bajo_stock > 0 ? 'text-amber-400' : 'text-ink'">{{ stats.bajo_stock }}</p>
      </div>
      <div class="rounded-2xl border border-gold/20 bg-gold/5 p-4">
        <p class="mb-1 text-[10px] font-black uppercase tracking-wider text-gold/60">Valor Inventario</p>
        <p class="text-2xl font-black text-gold">{{ fmtMoney(stats.valor_total) }}</p>
      </div>
      <div class="rounded-2xl border border-line bg-card p-4">
        <p class="mb-1 text-[10px] font-black uppercase tracking-wider text-muted">Categorías</p>
        <p class="text-2xl font-black text-ink">{{ categorias.length }}</p>
      </div>
    </section>

    <section class="mb-5 flex flex-wrap items-center gap-3">
      <input v-model="search" type="text" placeholder="Nombre del producto…" class="w-full rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink sm:max-w-xs">
      <select v-model="categoria" class="rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink">
        <option value="">Todas las categorías</option>
        <option v-for="c in categorias" :key="c" :value="c">{{ c }}</option>
      </select>
      <select v-model="tipo" class="rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink">
        <option value="">Todos los tipos</option>
        <option v-for="t in tipos" :key="t" :value="t">{{ t }}</option>
      </select>
      <label class="flex cursor-pointer items-center gap-2 text-xs text-muted">
        <input v-model="soloBajoStock" type="checkbox" class="h-4 w-4 rounded border-line">
        Solo stock bajo
      </label>
      <button v-if="search || categoria || tipo || soloBajoStock" type="button" class="text-xs font-bold uppercase tracking-widest text-muted hover:text-ink" @click="clearFilters">
        Limpiar filtros
      </button>
    </section>

    <p v-if="pending" class="text-sm text-muted">Cargando productos…</p>
    <p v-else-if="error" class="text-sm text-red-400">No se pudo cargar el inventario.</p>

    <section v-else class="ui-card overflow-x-auto">
      <table class="w-full text-left text-sm">
        <thead>
          <tr class="border-b border-line text-[10px] uppercase tracking-wider text-muted">
            <th class="px-4 py-3">Producto</th>
            <th class="px-4 py-3">Categoría</th>
            <th class="px-4 py-3">Stock</th>
            <th class="px-4 py-3 text-right">Precio Compra</th>
            <th class="px-4 py-3 text-right">Precio Venta</th>
            <th class="px-4 py-3 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="product in products" :key="product.id" class="border-b border-line/60 last:border-0">
            <td class="px-4 py-3">
              <div class="flex items-center gap-3">
                <div class="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-ink/5">
                  <img v-if="product.imagen_url" :src="product.imagen_url" :alt="product.nombre" class="h-full w-full object-cover">
                  <span v-else class="text-lg text-ink/15">✂</span>
                </div>
                <div>
                  <p class="font-bold text-ink">{{ product.nombre }}</p>
                  <p class="text-[10px] uppercase text-muted">{{ product.tipo }}</p>
                </div>
              </div>
            </td>
            <td class="px-4 py-3">
              <span class="rounded-full border border-line bg-ink/5 px-2 py-0.5 text-[9px] font-black uppercase text-muted">{{ product.categoria }}</span>
            </td>
            <td class="px-4 py-3">
              <div class="flex items-center gap-2">
                <span class="font-black" :class="product.low_stock ? 'text-amber-400' : 'text-ink'">{{ product.stock_actual }}</span>
                <span class="text-[10px] text-muted">/ mín {{ product.stock_minimo }}</span>
                <span v-if="product.low_stock" class="rounded-full border border-amber-500/25 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-black uppercase text-amber-400">bajo</span>
              </div>
            </td>
            <td class="px-4 py-3 text-right text-muted">{{ fmtMoney(product.precio_compra) }}</td>
            <td class="px-4 py-3 text-right font-black text-emerald-400">{{ fmtMoney(product.precio_venta) }}</td>
            <td class="px-4 py-3">
              <div class="flex justify-end gap-2">
                <button type="button" class="rounded-lg border border-line px-3 py-1 text-xs text-muted hover:text-ink" @click="openEdit(product)">Editar</button>
                <button type="button" class="rounded-lg border border-red-500/20 px-3 py-1 text-xs text-red-400 hover:bg-red-500/10" @click="removeProduct(product)">Eliminar</button>
              </div>
            </td>
          </tr>
          <tr v-if="!products.length">
            <td colspan="6" class="px-4 py-12 text-center text-sm text-muted">Sin productos.</td>
          </tr>
        </tbody>
      </table>
    </section>

    <div v-if="showForm" class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" @click.self="showForm = false">
      <div class="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-line bg-card p-6">
        <h2 class="mb-4 text-lg font-semibold text-ink">{{ editing ? 'Editar producto' : 'Nuevo producto' }}</h2>
        <form class="space-y-3" @submit.prevent="submitForm">
          <div>
            <label class="mb-1 block text-xs text-muted">Nombre</label>
            <input v-model="form.nombre" type="text" required class="w-full rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink">
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="mb-1 block text-xs text-muted">Categoría</label>
              <input v-model="form.categoria" type="text" required class="w-full rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink">
            </div>
            <div>
              <label class="mb-1 block text-xs text-muted">Tipo</label>
              <select v-model="form.tipo" class="w-full rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink">
                <option value="venta_cliente">Venta a cliente</option>
                <option value="insumo_barberia">Insumo de barbería</option>
              </select>
            </div>
          </div>
          <div>
            <label class="mb-1 block text-xs text-muted">Descripción</label>
            <textarea v-model="form.descripcion" rows="2" class="w-full rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink" />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="mb-1 block text-xs text-muted">Precio compra</label>
              <input v-model.number="form.precio_compra" type="number" step="0.01" min="0" required class="w-full rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink">
            </div>
            <div>
              <label class="mb-1 block text-xs text-muted">Precio venta</label>
              <input v-model.number="form.precio_venta" type="number" step="0.01" min="0" required class="w-full rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink">
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="mb-1 block text-xs text-muted">Stock actual</label>
              <input v-model.number="form.stock_actual" type="number" min="0" required class="w-full rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink">
            </div>
            <div>
              <label class="mb-1 block text-xs text-muted">Stock mínimo</label>
              <input v-model.number="form.stock_minimo" type="number" min="0" required class="w-full rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink">
            </div>
          </div>
          <p v-if="formError" class="text-sm text-red-400">{{ formError }}</p>
          <div class="mt-5 flex gap-3">
            <button type="submit" :disabled="saving" class="flex-1 rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-black hover:bg-gold-dim disabled:opacity-50">
              {{ saving ? 'Guardando…' : 'Guardar' }}
            </button>
            <button type="button" class="rounded-lg border border-line px-4 py-2 text-sm text-muted hover:text-ink" @click="showForm = false">Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
