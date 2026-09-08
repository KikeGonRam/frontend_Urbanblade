<script setup lang="ts">
/*
 * Fase 9.4 — bandeja de pedidos de recepción/administración, puerto de
 * Reception\OrderController (web): listar (con stats), entregar (cobro +
 * método de pago) y cancelar (devuelve stock, delegado en
 * OrderService::cancel()).
 */
definePageMeta({ middleware: ['auth', 'staff'], layout: 'dashboard' })

const METODO_LABEL: Record<string, string> = { efectivo: 'Efectivo', tarjeta: 'Tarjeta', transferencia: 'Transferencia', qr: 'QR' }
const ESTADO_LABEL: Record<string, string> = { pendiente: 'Pendiente', entregado: 'Entregado', cancelado: 'Cancelado' }
const ESTADO_CLASS: Record<string, string> = {
  pendiente: 'border-amber-500/25 bg-amber-500/10 text-amber-300',
  entregado: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300',
  cancelado: 'border-red-500/25 bg-red-500/10 text-red-400',
}

interface OrderRow {
  id: string
  folio: string
  estado: string
  tipo: string
  total: number
  metodo_pago: string | null
  created_at: string | null
  items: Array<{ nombre: string | null, cantidad: number, precio: number }>
  client: { id: string | null, name: string | null }
}

interface OrdersResponse {
  data: OrderRow[]
  meta: { current_page: number, last_page: number, total: number, stats?: { pendientes: number, entregados: number, por_cobrar: number } }
}

const { apiFetch } = useApi()
const { confirm } = useConfirm()

const estadoFilter = ref('')
const search = ref('')

const { data: response, pending, error, refresh } = await useAsyncData<OrdersResponse>(
  'orders-list',
  () => apiFetch<OrdersResponse>('/orders', { query: { estado: estadoFilter.value || undefined, q: search.value || undefined } }),
  { watch: [estadoFilter, search] },
)
const orders = computed(() => response.value?.data ?? [])
const stats = computed(() => response.value?.meta.stats)

function fmtMoney(n: number) {
  return `$${Number(n ?? 0).toFixed(2)}`
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'

  return new Date(iso).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

// ── Entregar ──────────────────────────────────────────────────────────────
const delivering = ref<OrderRow | null>(null)
const metodoPago = ref('efectivo')
const busy = ref<string | null>(null)
const actionError = ref('')

function openDeliver(order: OrderRow) {
  delivering.value = order
  metodoPago.value = 'efectivo'
  actionError.value = ''
}

async function confirmDeliver() {
  if (!delivering.value) return

  busy.value = delivering.value.id
  actionError.value = ''
  try {
    await apiFetch(`/orders/${delivering.value.id}/deliver`, { method: 'PATCH', body: { metodo_pago: metodoPago.value } })
    delivering.value = null
    await refresh()
  } catch (err: unknown) {
    actionError.value = (err as { data?: { message?: string } })?.data?.message ?? 'No se pudo entregar el pedido.'
  } finally {
    busy.value = null
  }
}

async function cancelOrder(order: OrderRow) {
  const accepted = await confirm({
    title: 'Cancelar pedido',
    message: `¿Cancelar el pedido ${order.folio}? El stock se devolverá automáticamente.`,
    confirmText: 'Sí, cancelar',
    isDanger: true,
  })
  if (!accepted) return

  busy.value = order.id
  actionError.value = ''
  try {
    await apiFetch(`/orders/${order.id}/cancel`, { method: 'PATCH' })
    await refresh()
  } catch (err: unknown) {
    actionError.value = (err as { data?: { message?: string } })?.data?.message ?? 'No se pudo cancelar el pedido.'
  } finally {
    busy.value = null
  }
}

async function downloadReceipt(order: OrderRow) {
  try {
    const blob = await apiFetch<Blob>(`/orders/${order.id}/receipt`, { responseType: 'blob' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `pedido-${order.folio}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  } catch {
    actionError.value = 'No se pudo generar el recibo.'
  }
}
</script>

<template>
  <div class="p-4 sm:p-6 lg:p-8">
    <header class="mb-5">
      <p class="text-sm uppercase tracking-widest text-muted">UrbanBlade</p>
      <h1 class="mt-1 text-2xl font-semibold text-ink">Bandeja de <span class="text-gold">Pedidos</span></h1>
      <p class="mt-1 text-sm text-muted">Gestión de pedidos de la tienda: entrega, cobro y cancelación.</p>
    </header>

    <section v-if="stats" class="mb-5 grid grid-cols-3 gap-4">
      <div class="rounded-2xl border border-line bg-card p-4">
        <p class="mb-1 text-[10px] font-black uppercase tracking-wider text-muted">Pendientes</p>
        <p class="text-2xl font-black text-amber-400">{{ stats.pendientes }}</p>
      </div>
      <div class="rounded-2xl border border-line bg-card p-4">
        <p class="mb-1 text-[10px] font-black uppercase tracking-wider text-muted">Entregados</p>
        <p class="text-2xl font-black text-emerald-400">{{ stats.entregados }}</p>
      </div>
      <div class="rounded-2xl border border-line bg-card p-4">
        <p class="mb-1 text-[10px] font-black uppercase tracking-wider text-muted">Por Cobrar</p>
        <p class="text-2xl font-black text-ink">{{ fmtMoney(stats.por_cobrar) }}</p>
      </div>
    </section>

    <section class="mb-5 flex flex-wrap items-center gap-3">
      <input v-model="search" type="text" placeholder="Buscar folio…" class="w-full rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink sm:max-w-xs">
      <select v-model="estadoFilter" class="rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink">
        <option value="">Todos los estados</option>
        <option v-for="(label, val) in ESTADO_LABEL" :key="val" :value="val">{{ label }}</option>
      </select>
      <button v-if="search || estadoFilter" type="button" class="text-xs font-bold uppercase tracking-widest text-muted hover:text-ink" @click="search = ''; estadoFilter = ''">
        Limpiar filtros
      </button>
    </section>

    <p v-if="pending" class="text-sm text-muted">Cargando pedidos…</p>
    <p v-else-if="error" class="text-sm text-red-400">No se pudo cargar la bandeja de pedidos.</p>

    <section v-else class="ui-card overflow-x-auto">
      <table class="w-full text-left text-sm">
        <thead>
          <tr class="border-b border-line text-[10px] uppercase tracking-wider text-muted">
            <th class="px-4 py-3">Folio / Fecha</th>
            <th class="px-4 py-3">Cliente</th>
            <th class="px-4 py-3">Items</th>
            <th class="px-4 py-3">Estado</th>
            <th class="px-4 py-3 text-right">Total</th>
            <th class="px-4 py-3 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="order in orders" :key="order.id" class="border-b border-line/60 last:border-0">
            <td class="px-4 py-3">
              <div class="flex flex-col">
                <span class="font-black text-ink">{{ order.folio }}</span>
                <span class="text-[10px] font-bold uppercase text-muted">{{ fmtDate(order.created_at) }}</span>
              </div>
            </td>
            <td class="px-4 py-3 text-ink/80">{{ order.client.name ?? '—' }}</td>
            <td class="px-4 py-3 text-muted">{{ order.items.reduce((s, i) => s + i.cantidad, 0) }} pzas</td>
            <td class="px-4 py-3">
              <span class="rounded-full border px-2 py-0.5 text-[9px] font-black uppercase" :class="ESTADO_CLASS[order.estado]">{{ ESTADO_LABEL[order.estado] ?? order.estado }}</span>
              <span v-if="order.metodo_pago" class="ml-1 text-[9px] text-muted">({{ METODO_LABEL[order.metodo_pago] ?? order.metodo_pago }})</span>
            </td>
            <td class="px-4 py-3 text-right font-black text-emerald-400">{{ fmtMoney(order.total) }}</td>
            <td class="px-4 py-3">
              <div class="flex justify-end gap-2">
                <template v-if="order.estado === 'pendiente'">
                  <button type="button" :disabled="busy === order.id" class="rounded-lg bg-emerald-500 px-3 py-1 text-xs font-bold text-black hover:bg-emerald-400 disabled:opacity-50" @click="openDeliver(order)">Entregar</button>
                  <button type="button" :disabled="busy === order.id" class="rounded-lg border border-red-500/20 px-3 py-1 text-xs text-red-400 hover:bg-red-500/10 disabled:opacity-50" @click="cancelOrder(order)">Cancelar</button>
                </template>
                <button v-else-if="order.estado === 'entregado'" type="button" class="rounded-lg border border-line px-3 py-1 text-xs text-muted hover:text-gold" @click="downloadReceipt(order)">Recibo</button>
              </div>
            </td>
          </tr>
          <tr v-if="!orders.length">
            <td colspan="6" class="px-4 py-12 text-center text-sm text-muted">Sin pedidos que mostrar.</td>
          </tr>
        </tbody>
      </table>
    </section>

    <div v-if="delivering" class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" @click.self="delivering = null">
      <div class="w-full max-w-sm rounded-2xl border border-line bg-card p-6">
        <h2 class="mb-1 text-lg font-semibold text-ink">Entregar {{ delivering.folio }}</h2>
        <p class="mb-4 text-sm text-muted">Total a cobrar: <span class="font-black text-gold">{{ fmtMoney(delivering.total) }}</span></p>
        <label class="mb-1 block text-xs text-muted">Método de pago</label>
        <select v-model="metodoPago" class="mb-4 w-full rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink">
          <option v-for="(label, val) in METODO_LABEL" :key="val" :value="val">{{ label }}</option>
        </select>
        <p v-if="actionError" class="mb-3 text-sm text-red-400">{{ actionError }}</p>
        <div class="flex gap-3">
          <button type="button" :disabled="busy === delivering.id" class="flex-1 rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-black hover:bg-gold-dim disabled:opacity-50" @click="confirmDeliver">
            {{ busy === delivering.id ? 'Guardando…' : 'Confirmar entrega' }}
          </button>
          <button type="button" class="rounded-lg border border-line px-4 py-2 text-sm text-muted hover:text-ink" @click="delivering = null">Cancelar</button>
        </div>
      </div>
    </div>
  </div>
</template>
