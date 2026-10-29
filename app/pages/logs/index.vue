<script setup lang="ts">
import type { CsvColumn } from "~/composables/useCsvExport";
import type { DataTableColumn } from "~/components/ui/DataTable.vue";
/*
 * Fase 9.9 — Auditoría/logs de actividad, puerto de Log\ActivityLogController
 * (web). Api\Log\LogController ya existía pero solo tenía q + log_name; se
 * amplió en esta misma fase con event/fecha_desde/fecha_hasta/causer y el
 * bloque de stats para llegar a paridad con la vista Blade.
 */
definePageMeta({ middleware: ["auth", "engineer"], layout: "dashboard" });
useSeoMeta({ title: 'Logs — UrbanBlade', robots: 'noindex' })


interface LogRow {
  id: string;
  log_name: string | null;
  description: string | null;
  event: string | null;
  subject_type: string | null;
  subject_id: string | null;
  created_at: string | null;
  causer: { id: string; name: string; email: string } | null;
}

interface Stats {
  total: number;
  hoy: number;
  creates: number;
  updates: number;
  deletes: number;
}

interface LogsResponse {
  data: LogRow[];
  meta: { current_page: number; last_page: number; total: number };
  log_names: string[];
  events: string[];
  stats: Stats;
}

const MODULO_LABEL: Record<string, string> = {
  appointments: "Citas",
  inventory: "Inventario",
  payments: "Pagos",
  products: "Productos",
  users: "Usuarios",
};
const EVENT_LABEL: Record<string, string> = {
  created: "Creado",
  updated: "Actualizado",
  deleted: "Eliminado",
};
const EVENT_CLASS: Record<string, string> = {
  created: "border-success/25 bg-success/10 text-success",
  updated: "border-warning/25 bg-warning/10 text-warning",
  deleted: "border-danger/25 bg-danger/10 text-danger",
};

const exportColumns: CsvColumn<LogRow>[] = [
  { header: "Fecha", value: (l) => l.created_at },
  { header: "Módulo", value: (l) => (l.log_name ? (MODULO_LABEL[l.log_name] ?? l.log_name) : null) },
  { header: "Evento", value: (l) => l.event },
  { header: "Descripción", value: (l) => l.description },
  { header: "Usuario", value: (l) => l.causer?.name },
  { header: "Correo", value: (l) => l.causer?.email },
  { header: "Entidad", value: (l) => l.subject_type },
];

const { apiFetch } = useApi();

const search = ref("");
const debouncedSearch = useDebounce(search, 350);
const logNameFilter = ref("");
const eventFilter = ref("");
const causerFilter = ref("");
const fechaDesde = ref("");
const fechaHasta = ref("");
const page = ref(1);

const {
  data: response,
  pending,
  error,
  refresh,
} = await useAsyncData(
  buildDataKey("logs-list", {
    q: search.value || undefined,
    log_name: logNameFilter.value || undefined,
    event: eventFilter.value || undefined,
    causer: causerFilter.value || undefined,
    fecha_desde: fechaDesde.value || undefined,
    fecha_hasta: fechaHasta.value || undefined,
    page: page.value,
    per_page: 15,
  }),
  () =>
    apiFetch<LogsResponse>("/logs", {
      query: {
        q: search.value || undefined,
        log_name: logNameFilter.value || undefined,
        event: eventFilter.value || undefined,
        causer: causerFilter.value || undefined,
        fecha_desde: fechaDesde.value || undefined,
        fecha_hasta: fechaHasta.value || undefined,
        page: page.value,
        per_page: 15,
      },
    }),
  {
    watch: [
      debouncedSearch,
      logNameFilter,
      eventFilter,
      causerFilter,
      fechaDesde,
      fechaHasta,
      page,
    ],
    lazy: true,
  },
);

const logs = computed(() => response.value?.data ?? []);
const pagination = computed(() => response.value?.meta);
// Orden en el cliente sobre la página cargada; la fecha y la categoría son las columnas útiles para ordenar.
const orden = ref<{ key: string, dir: "asc" | "desc" } | null>(null);
const COLUMNAS: DataTableColumn[] = [
  { key: "created_at", label: "Fecha", sortable: true },
  { key: "log_name", label: "Módulo", sortable: true },
  { key: "event", label: "Evento" },
  { key: "description", label: "Descripción" },
  { key: "causer", label: "Usuario" },
];
const logNames = computed(() => response.value?.log_names ?? []);
const events = computed(() => response.value?.events ?? []);
const stats = computed<Stats>(
  () =>
    response.value?.stats ?? {
      total: 0,
      hoy: 0,
      creates: 0,
      updates: 0,
      deletes: 0,
    },
);

watch(
  [debouncedSearch, logNameFilter, eventFilter, causerFilter, fechaDesde, fechaHasta],
  () => {
    page.value = 1;
  },
);

function clearFilters() {
  search.value = "";
  logNameFilter.value = "";
  eventFilter.value = "";
  causerFilter.value = "";
  fechaDesde.value = "";
  fechaHasta.value = "";
  page.value = 1;
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";

  return new Date(iso).toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
</script>

<template>
  <div class="p-4 sm:p-6 lg:p-8">
    <header class="mb-6">
      <h1 class="mt-1 text-2xl font-semibold text-ink">
        Auditoría / <span class="text-gold">Logs</span>
      </h1>
      <p class="mt-1 text-sm text-muted">Historial de actividad del sistema.</p>
    </header>
    <div class="mb-3">
      <UiExportCsvButton
        endpoint="/logs"
        :query="{ q: search || undefined, log_name: logNameFilter || undefined, event: eventFilter || undefined, causer: causerFilter || undefined, fecha_desde: fechaDesde || undefined, fecha_hasta: fechaHasta || undefined }"
        :columns="exportColumns"
        filename="auditoria"
      />
    </div>

    <section
      v-if="!pending && !error"
      class="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5"
    >
      <div class="ui-card p-4">
        <p class="text-xs font-bold uppercase text-muted">Total</p>
        <p class="mt-1 text-xl font-black text-ink">{{ stats.total }}</p>
      </div>
      <div class="ui-card p-4">
        <p class="text-xs font-bold uppercase text-muted">Hoy</p>
        <p class="mt-1 text-xl font-black text-gold">{{ stats.hoy }}</p>
      </div>
      <div class="ui-card p-4">
        <p class="text-xs font-bold uppercase text-muted">Creados</p>
        <p class="mt-1 text-xl font-black text-success">
          {{ stats.creates }}
        </p>
      </div>
      <div class="ui-card p-4">
        <p class="text-xs font-bold uppercase text-muted">Actualizados</p>
        <p class="mt-1 text-xl font-black text-warning">
          {{ stats.updates }}
        </p>
      </div>
      <div class="ui-card p-4">
        <p class="text-xs font-bold uppercase text-muted">Eliminados</p>
        <p class="mt-1 text-xl font-black text-danger">{{ stats.deletes }}</p>
      </div>
    </section>

    <section class="mb-5 flex flex-wrap gap-3">
      <input
        v-model="search"
        type="text"
        placeholder="Buscar…"
        class="rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink"
      >
      <select
        v-model="logNameFilter"
        class="rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink"
      >
        <option value="">Todas las categorías</option>
        <option v-for="n in logNames" :key="n" :value="n">{{ MODULO_LABEL[n] ?? n }}</option>
      </select>
      <select
        v-model="eventFilter"
        class="rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink"
      >
        <option value="">Todos los eventos</option>
        <option v-for="e in events" :key="e" :value="e">
          {{ EVENT_LABEL[e] ?? e }}
        </option>
      </select>
      <input
        v-model="causerFilter"
        type="text"
        placeholder="Usuario…"
        class="rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink"
      >
      <UiDateRange v-model:from="fechaDesde" v-model:to="fechaHasta" from-label="Fecha desde" to-label="Fecha hasta" />
      <button
        v-if="
          search ||
          logNameFilter ||
          eventFilter ||
          causerFilter ||
          fechaDesde ||
          fechaHasta
        "
        type="button"
        class="text-xs font-bold uppercase tracking-widest text-muted hover:text-ink"
        @click="clearFilters"
      >
        Limpiar filtros
      </button>
    </section>

    <BrandStatePanel
      v-if="error"
      mascot="bruno"
      state="error"
      tone="danger"
      title="No se pudo cargar el historial"
      description="Inténtalo nuevamente en unos minutos."
      action-label="Reintentar"
      @action="refresh"
    />

    <UiDataTable
      v-if="!error"
      v-model:sort="orden"
      :columns="COLUMNAS"
      :rows="logs"
      :loading="pending"
      aria-label="Registro de auditoría"
      empty-title="Sin registros que mostrar"
      empty-description="Cambia los filtros o el rango de fechas para ver otra actividad."
    >
      <template #cell-created_at="{ row }">
        <span class="whitespace-nowrap text-muted">{{ fmtDate(row.created_at) }}</span>
      </template>
      <template #cell-log_name="{ row }">
        <span class="text-ink">{{ row.log_name ? (MODULO_LABEL[row.log_name] ?? row.log_name) : "—" }}</span>
      </template>
      <template #cell-event="{ row }">
        <span v-if="row.event" class="rounded-full border px-2 py-0.5 text-xs font-black" :class="EVENT_CLASS[row.event]">{{ EVENT_LABEL[row.event] ?? row.event }}</span>
        <span v-else>—</span>
      </template>
      <template #cell-description="{ row }">
        <span class="text-muted">{{ row.description ?? "—" }}</span>
      </template>
      <template #cell-causer="{ row }">
        <span class="text-muted">{{ row.causer?.name ?? "Sistema" }}</span>
      </template>
    </UiDataTable>

    <UiPagination
      v-if="pagination"
      v-model:current-page="page"
      :last-page="pagination.last_page"
      :total="pagination.total"
      :per-page="15"
      :busy="pending"
    />
  </div>
</template>
