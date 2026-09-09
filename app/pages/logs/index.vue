<script setup lang="ts">
/*
 * Fase 9.9 — Auditoría/logs de actividad, puerto de Log\ActivityLogController
 * (web). Api\Log\LogController ya existía pero solo tenía q + log_name; se
 * amplió en esta misma fase con event/fecha_desde/fecha_hasta/causer y el
 * bloque de stats para llegar a paridad con la vista Blade.
 */
definePageMeta({ middleware: ['auth', 'engineer'], layout: 'dashboard' })

interface LogRow {
  id: string
  log_name: string | null
  description: string | null
  event: string | null
  subject_type: string | null
  subject_id: string | null
  created_at: string | null
  causer: { id: string, name: string, email: string } | null
}

interface Stats { total: number, hoy: number, creates: number, updates: number, deletes: number }

interface LogsResponse {
  data: LogRow[]
  meta: { current_page: number, last_page: number, total: number }
  log_names: string[]
  events: string[]
  stats: Stats
}

const EVENT_LABEL: Record<string, string> = { created: 'Creado', updated: 'Actualizado', deleted: 'Eliminado' }
const EVENT_CLASS: Record<string, string> = {
  created: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300',
  updated: 'border-amber-500/25 bg-amber-500/10 text-amber-300',
  deleted: 'border-red-500/25 bg-red-500/10 text-red-400',
}

const { apiFetch } = useApi()

const search = ref('')
const debouncedSearch = useDebounce(search, 350)
const logNameFilter = ref('')
const eventFilter = ref('')
const causerFilter = ref('')
const fechaDesde = ref('')
const fechaHasta = ref('')

const { data: response, pending, error } = await useAsyncData(
  'logs-list',
  () => apiFetch<LogsResponse>('/logs', {
    query: {
      q: search.value || undefined,
      log_name: logNameFilter.value || undefined,
      event: eventFilter.value || undefined,
      causer: causerFilter.value || undefined,
      fecha_desde: fechaDesde.value || undefined,
      fecha_hasta: fechaHasta.value || undefined,
    },
  }),
  { watch: [debouncedSearch, logNameFilter, eventFilter, causerFilter, fechaDesde, fechaHasta] },
)

const logs = computed(() => response.value?.data ?? [])
const logNames = computed(() => response.value?.log_names ?? [])
const events = computed(() => response.value?.events ?? [])
const stats = computed<Stats>(() => response.value?.stats ?? { total: 0, hoy: 0, creates: 0, updates: 0, deletes: 0 })

function clearFilters() {
  search.value = ''
  logNameFilter.value = ''
  eventFilter.value = ''
  causerFilter.value = ''
  fechaDesde.value = ''
  fechaHasta.value = ''
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'

  return new Date(iso).toLocaleString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <div class="p-4 sm:p-6 lg:p-8">
    <header class="mb-6">
      <p class="text-sm uppercase tracking-widest text-muted">UrbanBlade</p>
      <h1 class="mt-1 text-2xl font-semibold text-ink">Auditoría / <span class="text-gold">Logs</span></h1>
      <p class="mt-1 text-sm text-muted">Historial de actividad del sistema.</p>
    </header>

    <section v-if="!pending && !error" class="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
      <div class="ui-card p-4"><p class="text-[10px] font-bold uppercase text-muted">Total</p><p class="mt-1 text-xl font-black text-ink">{{ stats.total }}</p></div>
      <div class="ui-card p-4"><p class="text-[10px] font-bold uppercase text-muted">Hoy</p><p class="mt-1 text-xl font-black text-gold">{{ stats.hoy }}</p></div>
      <div class="ui-card p-4"><p class="text-[10px] font-bold uppercase text-muted">Creados</p><p class="mt-1 text-xl font-black text-emerald-400">{{ stats.creates }}</p></div>
      <div class="ui-card p-4"><p class="text-[10px] font-bold uppercase text-muted">Actualizados</p><p class="mt-1 text-xl font-black text-amber-400">{{ stats.updates }}</p></div>
      <div class="ui-card p-4"><p class="text-[10px] font-bold uppercase text-muted">Eliminados</p><p class="mt-1 text-xl font-black text-red-400">{{ stats.deletes }}</p></div>
    </section>

    <section class="mb-5 flex flex-wrap gap-3">
      <input v-model="search" type="text" placeholder="Buscar…" class="rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink">
      <select v-model="logNameFilter" class="rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink">
        <option value="">Todas las categorías</option>
        <option v-for="n in logNames" :key="n" :value="n">{{ n }}</option>
      </select>
      <select v-model="eventFilter" class="rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink">
        <option value="">Todos los eventos</option>
        <option v-for="e in events" :key="e" :value="e">{{ EVENT_LABEL[e] ?? e }}</option>
      </select>
      <input v-model="causerFilter" type="text" placeholder="Usuario…" class="rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink">
      <input v-model="fechaDesde" type="date" class="rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink">
      <input v-model="fechaHasta" type="date" class="rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink">
      <button
        v-if="search || logNameFilter || eventFilter || causerFilter || fechaDesde || fechaHasta"
        type="button" class="text-xs font-bold uppercase tracking-widest text-muted hover:text-ink" @click="clearFilters"
      >
        Limpiar filtros
      </button>
    </section>

    <p v-if="pending" class="text-sm text-muted">Cargando…</p>
    <p v-else-if="error" class="text-sm text-red-400">No se pudo cargar el historial.</p>
    <p v-else-if="!logs.length" class="rounded-2xl border border-dashed border-line p-12 text-center text-sm text-muted">
      Sin registros que mostrar.
    </p>

    <section v-else class="ui-card overflow-x-auto">
      <table class="w-full text-left text-sm">
        <thead>
          <tr class="border-b border-line text-[10px] uppercase tracking-wider text-muted">
            <th class="px-4 py-3">Fecha</th>
            <th class="px-4 py-3">Categoría</th>
            <th class="px-4 py-3">Evento</th>
            <th class="px-4 py-3">Descripción</th>
            <th class="px-4 py-3">Usuario</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="log in logs" :key="log.id" class="border-b border-line/60 last:border-0">
            <td class="px-4 py-3 whitespace-nowrap text-muted">{{ fmtDate(log.created_at) }}</td>
            <td class="px-4 py-3 text-ink">{{ log.log_name ?? '—' }}</td>
            <td class="px-4 py-3">
              <span v-if="log.event" class="rounded-full border px-2 py-0.5 text-[10px] font-black" :class="EVENT_CLASS[log.event]">{{ EVENT_LABEL[log.event] ?? log.event }}</span>
              <span v-else>—</span>
            </td>
            <td class="px-4 py-3 text-muted">{{ log.description ?? '—' }}</td>
            <td class="px-4 py-3 text-muted">{{ log.causer?.name ?? 'Sistema' }}</td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>
