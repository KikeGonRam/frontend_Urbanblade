<script setup lang="ts" generic="T">
/*
 * Botón "Exportar CSV" para los listados de administración. Recibe el endpoint, los filtros
 * activos de la pantalla y las columnas; descarga todas las páginas (ver useCsvExport).
 */
import type { CsvColumn } from "~/composables/useCsvExport";

const props = withDefaults(
  defineProps<{
    endpoint: string;
    query?: Record<string, unknown>;
    columns: CsvColumn<T>[];
    filename: string;
    label?: string;
  }>(),
  { query: () => ({}), label: "Exportar CSV" },
);

const { exporting, error, truncated, exportCsv } = useCsvExport();

async function run() {
  await exportCsv<T>({ endpoint: props.endpoint, query: props.query, columns: props.columns, filename: props.filename });
}
</script>

<template>
  <div class="flex flex-wrap items-center justify-end gap-3">
    <p v-if="error" class="text-sm text-danger" role="alert">{{ error }}</p>
    <p v-else-if="truncated" class="text-sm text-warning" role="status">
      Se exportaron las primeras 2,000 filas; afina los filtros para el resto.
    </p>
    <button
      type="button"
      :disabled="exporting"
      class="inline-flex min-h-11 items-center gap-2 rounded-lg border border-line px-4 text-sm font-semibold text-ink transition-colors hover:border-gold/40 disabled:opacity-50"
      @click="run"
    >
      <svg class="h-4 w-4 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" /></svg>
      {{ exporting ? "Generando…" : label }}
    </button>
  </div>
</template>
