<script setup lang="ts">
import type { DataTableColumn } from "~/components/ui/DataTable.vue";
/*
 * Muro/Reseñas (fase post-9.9) — Reseñas de clientes a barberos, puerto de
 * Barber\ReviewController (web). Api\Review\ReviewController no existía
 * antes de esta fase — se construyó desde cero reutilizando el mismo
 * Sortable trait y cálculo de stats del lado servidor.
 */
definePageMeta({ middleware: ['auth', 'admin'], layout: 'dashboard' })

useSeoMeta({ title: 'Reseñas — UrbanBlade', robots: 'noindex' })

interface ReviewRow {
  id: string
  rating: number
  comment: string | null
  created_at: string | null
  barber: { id: string | null, name: string | null }
  client: { id: string | null, name: string | null }
}
interface Stats { total: number, promedio: number, bajas: number }
interface ReviewsResponse {
  data: ReviewRow[]
  meta: { current_page: number, last_page: number, total: number }
  filters: { barber_id: string | null, rating: string | null }
  barbers: { id: string, name: string | null }[]
  stats: Stats
}

const { apiFetch } = useApi()

const barberFilter = ref('')
const ratingFilter = ref('')
const sort = ref('created_at')
const dir = ref<'asc' | 'desc'>('desc')
const page = ref(1)

const { data: response, pending, error, refresh } = await useAsyncData(
  'reviews-list',
  () => apiFetch<ReviewsResponse>('/reviews', {
    query: {
      barber_id: barberFilter.value || undefined,
      rating: ratingFilter.value || undefined,
      sort: sort.value,
      dir: dir.value,
      page: page.value,
      per_page: 10,
    },
  }),
  { watch: [barberFilter, ratingFilter, sort, dir, page], lazy: true },
)

const COLUMNAS: DataTableColumn[] = [
  { key: "created_at", label: "Fecha", sortable: true },
  { key: "rating", label: "Calificación", sortable: true },
  { key: "barbero", label: "Barbero", hideBelow: "md" },
  { key: "cliente", label: "Cliente", hideBelow: "md" },
  { key: "comentario", label: "Comentario" },
];
const RATING_OPCIONES = [
  { value: "", label: "Todas", icon: "star" },
  ...[5, 4, 3, 2, 1].map((r) => ({ value: String(r), label: r + " ★" })),
];
// El orden lo hace el servidor (sobre todas las páginas); la tabla solo lo muestra y lo pide.
const tableSort = computed({
  get: () => ({ key: sort.value, dir: dir.value }),
  set: (v: { key: string; dir: "asc" | "desc" } | null) => {
    sort.value = v?.key ?? "created_at";
    dir.value = v?.dir ?? "desc";
  },
});
const reviews = computed(() => response.value?.data ?? [])
const pagination = computed(() => response.value?.meta)
const barbers = computed(() => response.value?.barbers ?? [])
const stats = computed<Stats>(() => response.value?.stats ?? { total: 0, promedio: 0, bajas: 0 })

watch([barberFilter, ratingFilter, sort, dir], () => {
  page.value = 1
})

function clearFilters() {
  barberFilter.value = ''
  ratingFilter.value = ''
  page.value = 1
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'

  return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <div class="p-4 sm:p-6 lg:p-8">
    <header class="mb-6">
      <h1 class="mt-1 text-2xl font-semibold text-ink">
        Reseñas de <span class="text-gold">Clientes</span>
      </h1>
      <p class="mt-1 text-sm text-muted">Calificaciones y comentarios de clientes sobre cada barbero.</p>
    </header>

    <section v-if="!pending && !error" class="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
      <div class="ui-card p-4"><p class="text-xs font-bold uppercase text-muted">Total</p><p class="mt-1 text-xl font-black text-ink">{{ stats.total }}</p></div>
      <div class="ui-card p-4"><p class="text-xs font-bold uppercase text-muted">Promedio</p><p class="mt-1 text-xl font-black text-gold">{{ stats.promedio }} ★</p></div>
      <div class="ui-card p-4"><p class="text-xs font-bold uppercase text-muted">Bajas (≤2★)</p><p class="mt-1 text-xl font-black text-danger">{{ stats.bajas }}</p></div>
    </section>


    <section class="mb-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
      <select v-model="barberFilter" class="w-full rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink sm:w-auto">
        <option value="">Todos los barberos</option>
        <option v-for="b in barbers" :key="b.id" :value="b.id">{{ b.name }}</option>
      </select>
      <UiFilterChips v-model="ratingFilter" label="Filtrar por calificación" :options="RATING_OPCIONES" />
      <button
        v-if="barberFilter || ratingFilter" type="button"
        class="text-xs font-bold uppercase tracking-widest text-muted hover:text-ink" @click="clearFilters"
      >
        Limpiar filtros
      </button>
    </section>

    <BrandStatePanel
      v-if="error"
      mascot="bruno"
      state="error"
      tone="danger"
      title="No se pudieron cargar las reseñas"
      description="Inténtalo nuevamente en unos minutos."
      action-label="Reintentar"
      @action="refresh"
    />
    <UiDataTable
      v-else
      v-model:sort="tableSort"
      :columns="COLUMNAS"
      :rows="reviews"
      :loading="pending"
      aria-label="Reseñas"
      empty-title="Todavía no hay reseñas que mostrar"
      empty-description="Las reseñas de los clientes aparecerán aquí."
    >
      <template #cell-created_at="{ row }"><span class="whitespace-nowrap text-muted">{{ fmtDate(row.created_at) }}</span></template>
      <template #cell-rating="{ row }"><span :class="row.rating <= 2 ? 'text-danger' : 'text-gold'">{{ row.rating }} ★</span></template>
      <template #cell-barbero="{ row }"><span class="text-ink">{{ row.barber.name ?? '—' }}</span></template>
      <template #cell-cliente="{ row }"><span class="text-ink">{{ row.client.name ?? '—' }}</span></template>
      <template #cell-comentario="{ row }"><span class="text-muted">{{ row.comment ?? '—' }}</span></template>
    </UiDataTable>
    <UiPagination
      v-if="pagination"
      v-model:current-page="page"
      :last-page="pagination.last_page"
      :total="pagination.total"
      :per-page="10"
      :busy="pending"
    />
  </div>
</template>
