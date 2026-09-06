<script setup lang="ts">
/*
 * Muro/Reseñas (fase post-9.9) — Reseñas de clientes a barberos, puerto de
 * Barber\ReviewController (web). Api\Review\ReviewController no existía
 * antes de esta fase — se construyó desde cero reutilizando el mismo
 * Sortable trait y cálculo de stats del lado servidor.
 */
definePageMeta({ middleware: ['auth', 'admin'], layout: 'dashboard' })

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

const { data: response, pending, error } = await useAsyncData(
  'reviews-list',
  () => apiFetch<ReviewsResponse>('/reviews', {
    query: {
      barber_id: barberFilter.value || undefined,
      rating: ratingFilter.value || undefined,
      sort: sort.value,
      dir: dir.value,
    },
  }),
  { watch: [barberFilter, ratingFilter, sort, dir] },
)

const reviews = computed(() => response.value?.data ?? [])
const barbers = computed(() => response.value?.barbers ?? [])
const stats = computed<Stats>(() => response.value?.stats ?? { total: 0, promedio: 0, bajas: 0 })

function clearFilters() {
  barberFilter.value = ''
  ratingFilter.value = ''
}

function toggleSort(column: string) {
  if (sort.value === column) {
    dir.value = dir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sort.value = column
    dir.value = 'desc'
  }
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'

  return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <div class="p-4 sm:p-6 lg:p-8">
    <header class="mb-6">
      <p class="text-sm uppercase tracking-widest text-muted">UrbanBlade</p>
      <h1 class="mt-1 text-2xl font-semibold text-ink">
        Reseñas de <span class="text-gold">Clientes</span>
      </h1>
      <p class="mt-1 text-sm text-muted">Calificaciones y comentarios de clientes sobre cada barbero.</p>
    </header>

    <section v-if="!pending && !error" class="mb-6 grid grid-cols-3 gap-3">
      <div class="ui-card p-4"><p class="text-[10px] font-bold uppercase text-muted">Total</p><p class="mt-1 text-xl font-black text-ink">{{ stats.total }}</p></div>
      <div class="ui-card p-4"><p class="text-[10px] font-bold uppercase text-muted">Promedio</p><p class="mt-1 text-xl font-black text-gold">{{ stats.promedio }} ★</p></div>
      <div class="ui-card p-4"><p class="text-[10px] font-bold uppercase text-muted">Bajas (≤2★)</p><p class="mt-1 text-xl font-black text-red-400">{{ stats.bajas }}</p></div>
    </section>

    <section class="mb-5 flex flex-wrap gap-3">
      <select v-model="barberFilter" class="rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink">
        <option value="">Todos los barberos</option>
        <option v-for="b in barbers" :key="b.id" :value="b.id">{{ b.name }}</option>
      </select>
      <select v-model="ratingFilter" class="rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink">
        <option value="">Todas las calificaciones</option>
        <option v-for="r in [5, 4, 3, 2, 1]" :key="r" :value="r">{{ r }} ★</option>
      </select>
      <button
        v-if="barberFilter || ratingFilter" type="button"
        class="text-xs font-bold uppercase tracking-widest text-muted hover:text-ink" @click="clearFilters"
      >
        Limpiar filtros
      </button>
    </section>

    <p v-if="pending" class="text-sm text-muted">Cargando…</p>
    <p v-else-if="error" class="text-sm text-red-400">No se pudieron cargar las reseñas.</p>
    <p v-else-if="!reviews.length" class="rounded-2xl border border-dashed border-line p-12 text-center text-sm text-muted">
      Sin reseñas que mostrar.
    </p>

    <section v-else class="ui-card overflow-x-auto">
      <table class="w-full text-left text-sm">
        <thead>
          <tr class="border-b border-line text-[10px] uppercase tracking-wider text-muted">
            <th class="cursor-pointer px-4 py-3 select-none" @click="toggleSort('created_at')">
              Fecha {{ sort === 'created_at' ? (dir === 'asc' ? '↑' : '↓') : '' }}
            </th>
            <th class="cursor-pointer px-4 py-3 select-none" @click="toggleSort('rating')">
              Calificación {{ sort === 'rating' ? (dir === 'asc' ? '↑' : '↓') : '' }}
            </th>
            <th class="px-4 py-3">Barbero</th>
            <th class="px-4 py-3">Cliente</th>
            <th class="px-4 py-3">Comentario</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in reviews" :key="r.id" class="border-b border-line/60 last:border-0">
            <td class="px-4 py-3 whitespace-nowrap text-muted">{{ fmtDate(r.created_at) }}</td>
            <td class="px-4 py-3" :class="r.rating <= 2 ? 'text-red-400' : 'text-gold'">{{ r.rating }} ★</td>
            <td class="px-4 py-3 text-ink">{{ r.barber.name ?? '—' }}</td>
            <td class="px-4 py-3 text-ink">{{ r.client.name ?? '—' }}</td>
            <td class="px-4 py-3 text-muted">{{ r.comment ?? '—' }}</td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>
