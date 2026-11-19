<script setup lang="ts">
import type { DataTableColumn } from "~/components/ui/DataTable.vue";
import { METODO_LABEL, type PaymentRow } from "~/types/payments";

defineProps<{
  payments: PaymentRow[];
  pending: boolean;
  hasError: boolean;
  isAdmin: boolean;
  pagination?: { last_page: number; total: number };
}>();
defineEmits<{
  retry: [];
  "row-action": [action: string, payment: PaymentRow];
}>();

const page = defineModel<number>("page", { required: true });

const COLUMNAS: DataTableColumn[] = [
  { key: "folio", label: "Folio / Fecha" },
  { key: "cliente", label: "Cliente y servicio" },
  { key: "barbero", label: "Barbero", hideBelow: "md" },
  { key: "metodo", label: "Método", hideBelow: "md" },
  { key: "total", label: "Total", align: "right" },
];

function fmtMoney(n: number | string) {
  return formatMoney(n)
}

function fmtDateTime(iso: string | null) {
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
  <div>
    <BrandStatePanel
      v-if="hasError"
      mascot="bruno"
      state="error"
      tone="danger"
      title="No se pudo cargar el historial de pagos"
      description="Inténtalo nuevamente en unos minutos."
      action-label="Reintentar"
      @action="$emit('retry')"
    />
    <UiDataTable
      v-else
      :columns="COLUMNAS"
      :rows="payments"
      :loading="pending"
      aria-label="Pagos"
      empty-title="Todavía no hay comprobantes"
      empty-description="Los cobros registrados aparecerán aquí."
    >
      <template #cell-folio="{ row }">
        <div class="flex flex-col">
          <span class="font-black text-ink">#{{ String(row.id).padStart(6, "0").slice(-6) }}</span>
          <span class="text-xs font-bold uppercase text-muted">{{ fmtDateTime(row.created_at) }}</span>
        </div>
      </template>
      <template #cell-cliente="{ row }">
        <div class="flex flex-col">
          <span class="font-bold text-ink">{{ row.appointment.client ?? "N/A" }}</span>
          <span class="text-xs font-black uppercase tracking-widest text-gold">{{ row.appointment.service ?? "General" }}</span>
        </div>
      </template>
      <template #cell-barbero="{ row }"><span class="text-ink/80">{{ row.appointment.barber ?? "—" }}</span></template>
      <template #cell-metodo="{ row }">
        <span class="rounded-full border border-line bg-ink/5 px-2 py-0.5 text-xs font-black uppercase text-muted">{{ METODO_LABEL[row.metodo_pago] ?? row.metodo_pago }}</span>
      </template>
      <template #cell-total="{ row }">
        <div class="flex flex-col items-end">
          <span class="font-black text-success">{{ fmtMoney(Number(row.monto) + Number(row.propina)) }}</span>
          <span v-if="Number(row.propina) > 0" class="text-xs font-bold uppercase text-gold">+{{ fmtMoney(row.propina) }} propina</span>
        </div>
      </template>
      <template #actions="{ row }">
        <UiRowActions
          :actions="[
            { key: 'pdf', label: `Ver comprobante PDF de ${row.appointment.client ?? 'este pago'}`, icon: 'text' },
            { key: 'void', label: `Anular el cobro de ${row.appointment.client ?? 'este cliente'}`, icon: 'trash', danger: true, hidden: !isAdmin },
          ]"
          @action="$emit('row-action', $event, row)"
        />
      </template>
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
