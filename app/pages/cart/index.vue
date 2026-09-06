<script setup lang="ts">
/*
 * Fase 9.4 — carrito del cliente. El carrito vive en localStorage
 * (useCart()); esta página solo lo muestra/edita y, al pagar, manda los
 * items reales a POST /orders (Client\CartController::checkout() en
 * barber hace lo mismo con su carrito de sesión). El precio mostrado aquí
 * es el que se congeló al agregar cada línea — informativo, igual que en
 * la versión Blade — el que realmente se cobra lo recalcula
 * OrderService::place() del lado servidor.
 */
definePageMeta({ middleware: ['auth', 'client'], layout: 'dashboard' })

const { apiFetch } = useApi()
const router = useRouter()
const cart = useCart()

const checkingOut = ref(false)
const checkoutError = ref('')

function fmtMoney(n: number) {
  return `$${Number(n ?? 0).toFixed(2)}`
}

async function checkout() {
  if (!cart.items.value.length) return

  checkingOut.value = true
  checkoutError.value = ''
  try {
    const res = await apiFetch<{ message: string, data: { folio: string } }>('/orders', {
      method: 'POST',
      body: { items: cart.items.value.map((i) => ({ product_id: i.product_id, cantidad: i.cantidad })) },
    })
    cart.clear()
    await router.push({ path: '/my/orders', query: { created: res.data.folio } })
  } catch (err: unknown) {
    checkoutError.value = (err as { data?: { message?: string } })?.data?.message ?? 'No se pudo completar el pedido. Intenta de nuevo.'
  } finally {
    checkingOut.value = false
  }
}
</script>

<template>
  <div class="p-4 sm:p-6 lg:p-8">
    <header class="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p class="text-sm uppercase tracking-widest text-muted">UrbanBlade</p>
        <h1 class="mt-1 text-2xl font-semibold text-ink">Tu <span class="text-gold">Carrito</span></h1>
        <p class="mt-1 text-sm text-muted">Revisa tu pedido antes de pagar y recoger en sucursal.</p>
      </div>
      <NuxtLink to="/store" class="text-xs font-bold uppercase tracking-widest text-muted hover:text-ink">
        ← Seguir comprando
      </NuxtLink>
    </header>

    <div v-if="!cart.items.value.length" class="rounded-2xl border border-dashed border-line p-16 text-center">
      <p class="text-sm font-bold uppercase tracking-widest text-muted">Tu carrito está vacío</p>
      <NuxtLink to="/store" class="mt-4 inline-block rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-black hover:bg-gold-dim">Ir a la tienda</NuxtLink>
    </div>

    <div v-else class="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <section class="ui-card divide-y divide-line lg:col-span-2">
        <div v-for="item in cart.items.value" :key="item.product_id" class="flex items-center gap-4 p-4">
          <div class="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-ink/5">
            <img v-if="item.imagen" :src="item.imagen" :alt="item.nombre" class="h-full w-full object-cover">
            <span v-else class="text-xl text-ink/15">✂</span>
          </div>
          <div class="min-w-0 flex-1">
            <p class="truncate font-bold text-ink">{{ item.nombre }}</p>
            <p class="text-sm text-muted">{{ fmtMoney(item.precio) }} c/u</p>
          </div>
          <div class="flex items-center gap-2">
            <button type="button" class="h-7 w-7 rounded-lg border border-line text-ink hover:bg-ink/5" @click="cart.updateQty(item.product_id, item.cantidad - 1)">−</button>
            <span class="w-6 text-center text-sm text-ink">{{ item.cantidad }}</span>
            <button type="button" class="h-7 w-7 rounded-lg border border-line text-ink hover:bg-ink/5 disabled:opacity-30" :disabled="item.cantidad >= item.stockActual" @click="cart.updateQty(item.product_id, item.cantidad + 1)">+</button>
          </div>
          <p class="w-20 text-right font-black text-ink">{{ fmtMoney(item.precio * item.cantidad) }}</p>
          <button type="button" class="text-muted hover:text-red-400" title="Quitar" @click="cart.remove(item.product_id)">✕</button>
        </div>
      </section>

      <aside class="ui-card-premium h-fit space-y-4 p-6">
        <h2 class="text-xs font-black uppercase tracking-widest text-ink">Resumen</h2>
        <div class="flex justify-between text-sm">
          <span class="text-muted">{{ cart.count.value }} artículo{{ cart.count.value === 1 ? '' : 's' }}</span>
          <span class="font-black text-gold">{{ fmtMoney(cart.total.value) }}</span>
        </div>
        <p v-if="checkoutError" class="text-sm text-red-400">{{ checkoutError }}</p>
        <button type="button" :disabled="checkingOut" class="w-full rounded-lg bg-gold py-2.5 text-sm font-semibold text-black hover:bg-gold-dim disabled:opacity-50" @click="checkout">
          {{ checkingOut ? 'Procesando…' : 'Confirmar pedido' }}
        </button>
        <p class="text-[10px] italic text-muted">Pagas y recoges en sucursal. El total final se confirma al momento de la entrega.</p>
      </aside>
    </div>
  </div>
</template>
