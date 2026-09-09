<script setup lang="ts">
/*
 * Fase 9.4 — "Mis Pedidos" del cliente, puerto de Client\OrderController
 * (web): lista los pedidos propios y permite cancelar los que sigan
 * pendientes (con devolución de stock, delegada en OrderService::cancel()
 * del lado servidor).
 */
definePageMeta({ middleware: ['auth', 'client'], layout: 'dashboard' })

interface OrderRow {
  id: string
  folio: string
  estado: string
  total: number
  created_at: string | null
  items: Array<{ nombre: string | null, cantidad: number, precio: number }>
}

const ESTADO_LABEL: Record<string, string> = { pendiente: 'Pendiente', entregado: 'Entregado', cancelado: 'Cancelado' }
const ESTADO_CLASS: Record<string, string> = {
  pendiente: 'border-amber-500/25 bg-amber-500/10 text-amber-300',
  entregado: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300',
  cancelado: 'border-red-500/25 bg-red-500/10 text-red-400',
}

const { apiFetch } = useApi()
const { confirm } = useConfirm()
const route = useRoute()

const { data: response, pending, error, refresh } = await useAsyncData(
  'my-orders',
  () => apiFetch<{ data: OrderRow[] }>('/orders'),
  { lazy: true },
)
const orders = computed(() => response.value?.data ?? [])

function fmtMoney(n: number) {
  return `$${Number(n ?? 0).toFixed(2)}`
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'

  return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

const cancelling = ref<string | null>(null)
const actionError = ref('')

async function cancelOrder(order: OrderRow) {
  const accepted = await confirm({
    title: 'Cancelar pedido',
    message: `¿Cancelar el pedido ${order.folio}?`,
    confirmText: 'Sí, cancelar',
    isDanger: true,
  })
  if (!accepted) return

  cancelling.value = order.id
  actionError.value = ''
  try {
    await apiFetch(`/orders/${order.id}/cancel`, { method: 'PATCH' })
    await refresh()
  } catch (err: unknown) {
    actionError.value = (err as { data?: { message?: string } })?.data?.message ?? 'No se pudo cancelar el pedido.'
  } finally {
    cancelling.value = null
  }
}
</script>

<template>
  <div class="p-4 sm:p-6 lg:p-8">
    <header class="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p class="text-sm uppercase tracking-widest text-muted">UrbanBlade</p>
        <h1 class="mt-1 text-2xl font-semibold text-ink">Mis <span class="text-gold">Pedidos</span></h1>
        <p class="mt-1 text-sm text-muted">Historial de tus compras en la tienda.</p>
      </div>
      <NuxtLink to="/store" class="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-black hover:bg-gold-dim">
        Ir a la tienda
      </NuxtLink>
    </header>

    <p v-if="route.query.created" class="mb-5 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm text-emerald-300">
      Pedido {{ route.query.created }} creado. Paga y recoge en sucursal.
    </p>

    <p v-if="pending" class="text-sm text-muted">Cargando pedidos…</p>
    <p v-else-if="error" class="text-sm text-red-400">No se pudieron cargar tus pedidos.</p>
    <p v-if="actionError" role="alert" class="mb-4 text-sm text-red-400">{{ actionError }}</p>
    <p v-else-if="!orders.length" class="rounded-2xl border border-dashed border-line p-12 text-center text-sm text-muted">
      Todavía no tienes pedidos.
    </p>

    <div v-else class="space-y-4">
      <div v-for="order in orders" :key="order.id" class="ui-card p-5">
        <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p class="font-black text-ink">{{ order.folio }}</p>
            <p class="text-[10px] font-bold uppercase text-muted">{{ fmtDate(order.created_at) }}</p>
          </div>
          <div class="flex items-center gap-3">
            <span class="rounded-full border px-2 py-0.5 text-[10px] font-black uppercase" :class="ESTADO_CLASS[order.estado]">{{ ESTADO_LABEL[order.estado] ?? order.estado }}</span>
            <span class="font-black text-gold">{{ fmtMoney(order.total) }}</span>
          </div>
        </div>
        <ul class="mb-3 space-y-1 text-sm text-muted">
          <li v-for="(item, idx) in order.items" :key="idx">{{ item.cantidad }}× {{ item.nombre }}</li>
        </ul>
        <button
          v-if="order.estado === 'pendiente'" type="button" :disabled="cancelling === order.id"
          class="rounded-lg border border-red-500/20 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 disabled:opacity-50"
          @click="cancelOrder(order)"
        >
          Cancelar pedido
        </button>
      </div>
    </div>
  </div>
</template>
