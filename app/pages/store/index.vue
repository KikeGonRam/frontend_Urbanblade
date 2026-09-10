<script setup lang="ts">
/*
 * Fase 9.4 del plan (ver .claude/skills/nuxt-migration-plan/SKILL.md) —
 * como 9.1-9.3, Client\StoreController (web) sigue siendo Blade puro.
 * Construida contra el nuevo catálogo público GET /products (mismo
 * criterio Product::scopeAvailableForSale() que la vista Blade). El
 * carrito es local a este navegador (useCart(), ver ese archivo) — no
 * hay endpoint de carrito en el backend, solo POST /orders al pagar.
 */
definePageMeta({ middleware: ["auth", "client"], layout: "dashboard" });

interface StoreProduct {
  id: string;
  nombre: string;
  categoria: string | null;
  descripcion: string | null;
  precio_venta: number;
  stock_actual: number;
  imagen: string | null;
}

const { apiFetch } = useApi();
const cart = useCart();

const search = ref("");
const debouncedSearch = useDebounce(search, 350);
const categoria = ref("");

const {
  data: response,
  pending,
  error,
} = await useAsyncData(
  "store-products",
  () =>
    apiFetch<{ data: StoreProduct[] }>("/products", {
      query: {
        q: search.value || undefined,
        categoria: categoria.value || undefined,
      },
    }),
  { watch: [debouncedSearch, categoria], lazy: true },
);
const products = computed(() => response.value?.data ?? []);

const categorias = computed(() => [
  ...new Set(
    products.value
      .map((p) => p.categoria)
      .filter((c): c is string => Boolean(c)),
  ),
]);

function fmtMoney(n: number) {
  return `$${Number(n ?? 0).toFixed(2)}`;
}

function inCart(productId: string) {
  return (
    cart.items.value.find((i) => i.product_id === productId)?.cantidad ?? 0
  );
}

const justAdded = ref<string | null>(null);
let justAddedTimer: ReturnType<typeof setTimeout> | undefined;

function addToCart(product: StoreProduct) {
  cart.add({
    id: product.id,
    nombre: product.nombre,
    precio_venta: product.precio_venta,
    imagen: product.imagen,
    stock_actual: product.stock_actual,
  });
  clearTimeout(justAddedTimer);
  justAdded.value = product.id;
  justAddedTimer = setTimeout(() => {
    if (justAdded.value === product.id) justAdded.value = null;
  }, 1200);
}

onBeforeUnmount(() => {
  if (justAddedTimer) clearTimeout(justAddedTimer);
});
</script>

<template>
  <div class="p-4 sm:p-6 lg:p-8">
    <header
      class="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div>
        <p class="text-sm uppercase tracking-widest text-muted">UrbanBlade</p>
        <h1 class="mt-1 text-2xl font-semibold text-ink">
          Tienda <span class="text-gold">UrbanBlade</span>
        </h1>
        <p class="mt-1 text-sm text-muted">
          Productos de cuidado disponibles para llevar a casa.
        </p>
      </div>
      <NuxtLink
        to="/cart"
        class="relative rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-black hover:bg-gold-dim"
      >
        Ver carrito
        <span
          v-if="cart.count.value > 0"
          class="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-black px-1 text-[10px] font-black text-gold"
          >{{ cart.count.value }}</span
        >
      </NuxtLink>
    </header>

    <section class="mb-5 flex flex-wrap items-center gap-3">
      <input
        v-model="search"
        type="text"
        placeholder="Buscar producto…"
        class="w-full rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink sm:max-w-xs"
      >
      <select
        v-model="categoria"
        class="rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink"
      >
        <option value="">Todas las categorías</option>
        <option v-for="c in categorias" :key="c" :value="c">{{ c }}</option>
      </select>
      <button
        v-if="search || categoria"
        type="button"
        class="text-xs font-bold uppercase tracking-widest text-muted hover:text-ink"
        @click="
          search = '';
          categoria = '';
        "
      >
        Limpiar filtros
      </button>
    </section>

    <BrandStatePanel v-if="pending" mascot="bladebot" state="waiting" title="Cargando productos…" />
    <BrandStatePanel v-else-if="error" mascot="bruno" state="error" tone="danger" title="No se pudo cargar el catálogo" description="Inténtalo nuevamente en unos minutos." />
    <BrandStatePanel v-else-if="!products.length" mascot="nava" state="empty" title="Sin productos disponibles" description="Vuelve pronto para descubrir nuevos productos de cuidado." />

    <section
      v-else
      class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
    >
      <div
        v-for="product in products"
        :key="product.id"
        class="ui-card flex flex-col overflow-hidden"
      >
        <div class="flex aspect-square items-center justify-center bg-ink/5">
          <img
            v-if="product.imagen"
            :src="product.imagen"
            :alt="product.nombre"
            class="h-full w-full object-cover"
          >
          <span v-else class="text-3xl text-ink/15">✂</span>
        </div>
        <div class="flex flex-1 flex-col gap-2 p-4">
          <p class="text-[9px] font-black uppercase tracking-widest text-gold">
            {{ product.categoria ?? "General" }}
          </p>
          <p class="line-clamp-2 flex-1 text-sm font-bold text-ink">
            {{ product.nombre }}
          </p>
          <p class="text-lg font-black text-ink">
            {{ fmtMoney(product.precio_venta) }}
          </p>
          <p class="text-[10px] text-muted">
            {{ product.stock_actual }} disponibles<span
              v-if="inCart(product.id)"
            >
              · {{ inCart(product.id) }} en tu carrito</span
            >
          </p>
          <button
            type="button"
            class="mt-1 rounded-lg px-3 py-2 text-xs font-semibold transition"
            :class="
              justAdded === product.id
                ? 'bg-emerald-500 text-black'
                : 'bg-gold text-black hover:bg-gold-dim'
            "
            :disabled="inCart(product.id) >= product.stock_actual"
            @click="addToCart(product)"
          >
            {{
              justAdded === product.id
                ? "Agregado ✓"
                : inCart(product.id) >= product.stock_actual
                  ? "Sin stock disponible"
                  : "Agregar al carrito"
            }}
          </button>
        </div>
      </div>
    </section>
  </div>
</template>
