<script setup lang="ts">
import type { DataTableColumn } from "~/components/ui/DataTable.vue";
/*
 * Fase 9.9 — Historial de sorteos mensuales, puerto de Loyalty\RaffleController
 * (web). No existía ninguna API para esto antes de esta fase.
 */
definePageMeta({ middleware: ['auth', 'admin'], layout: 'dashboard' })

useSeoMeta({ title: 'Sorteos — UrbanBlade', robots: 'noindex' })

interface RaffleRow {
  id: string
  mes: string
  premio: string
  nivel_ganador: string | null
  vence_en: string | null
  reclamado_en: string | null
  client: { id: string | null, user: { name: string | null } }
  is_claimed: boolean
  is_expired: boolean
}

interface Stats { total: number, reclamados: number, vigentes: number }

const { apiFetch } = useApi()

const { data: response, pending, error, refresh } = await useAsyncData(
  'raffles-list',
  () => apiFetch<{ data: RaffleRow[], stats: Stats }>('/raffles'),
  { lazy: true },
)
const raffles = computed(() => response.value?.data ?? [])
// El historial llega completo; se pagina de 10 en 10 en pantalla.
const PAGE_SIZE = 10;
const page = ref(1);
const lastPage = computed(() => Math.max(1, Math.ceil(raffles.value.length / PAGE_SIZE)));
const pageRows = computed(() => raffles.value.slice((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE));
const COLUMNAS: DataTableColumn[] = [
  { key: "mes", label: "Mes" },
  { key: "ganador", label: "Ganador" },
  { key: "nivel", label: "Nivel", hideBelow: "md" },
  { key: "premio", label: "Premio", hideBelow: "md" },
  { key: "estado", label: "Estado", align: "right" },
];
const stats = computed<Stats>(() => response.value?.stats ?? { total: 0, reclamados: 0, vigentes: 0 })

function fmtDate(iso: string | null) {
  if (!iso) return '—'

  return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

function statusOf(r: RaffleRow) {
  if (r.is_claimed) return { label: 'Reclamado', class: 'border-success/25 bg-success/10 text-success' }
  if (r.is_expired) return { label: 'Caducado', class: 'border-danger/25 bg-danger/10 text-danger' }

  return { label: `Vigente hasta ${fmtDate(r.vence_en)}`, class: 'border-warning/25 bg-warning/10 text-warning' }
}
</script>

<template>
  <div class="p-4 sm:p-6 lg:p-8">
    <header class="mb-6">
      <h1 class="mt-1 text-2xl font-semibold text-ink">Historial de <span class="text-gold">Sorteos</span></h1>
      <p class="mt-1 text-sm text-muted">Ganadores mensuales del sorteo de lealtad y estado de sus premios.</p>
    </header>

    <section v-if="!pending && !error" class="mb-6 grid grid-cols-1 gap-3 sm:w-fit sm:grid-cols-3">
      <div class="ui-card p-4"><p class="text-xs font-bold uppercase text-muted">Total</p><p class="mt-1 text-xl font-black text-ink">{{ stats.total }}</p></div>
      <div class="ui-card p-4"><p class="text-xs font-bold uppercase text-muted">Reclamados</p><p class="mt-1 text-xl font-black text-success">{{ stats.reclamados }}</p></div>
      <div class="ui-card p-4"><p class="text-xs font-bold uppercase text-muted">Vigentes</p><p class="mt-1 text-xl font-black text-gold">{{ stats.vigentes }}</p></div>
    </section>

    <BrandStatePanel v-if="error" mascot="bruno" state="error" tone="danger" title="No se pudo cargar el historial de sorteos" description="Inténtalo nuevamente en unos minutos." action-label="Reintentar" @action="refresh" />
    <UiDataTable
      v-else
      :columns="COLUMNAS"
      :rows="pageRows"
      :loading="pending"
      aria-label="Sorteos"
      empty-title="Todavía no hay resultados de sorteos"
      empty-description="Los próximos resultados aparecerán aquí."
    >
      <template #cell-mes="{ row }"><span class="text-ink">{{ row.mes }}</span></template>
      <template #cell-ganador="{ row }"><span class="font-bold text-ink">{{ row.client.user.name ?? '—' }}</span></template>
      <template #cell-nivel="{ row }"><span class="text-muted">{{ row.nivel_ganador ?? '—' }}</span></template>
      <template #cell-premio="{ row }"><span class="text-muted">{{ row.premio }}</span></template>
      <template #cell-estado="{ row }"><span class="rounded-full border px-2 py-0.5 text-xs font-black" :class="statusOf(row).class">{{ statusOf(row).label }}</span></template>
    </UiDataTable>
    <UiPagination
      v-if="raffles.length > PAGE_SIZE"
      v-model:current-page="page"
      :last-page="lastPage"
      :total="raffles.length"
      :per-page="PAGE_SIZE"
    />
  </div>
</template>
