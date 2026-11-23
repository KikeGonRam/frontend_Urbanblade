<script setup lang="ts">
/*
 * Historial de cobros anulados (hallazgo 13 de la prueba de usuario). Anular un cobro ya no lo
 * borra: barber lo conserva con su motivo, quién lo anuló y cuándo (Payment con SoftDeletes) y lo
 * saca de todas las sumas. Esta pantalla solo los consulta: GET /payments?anulados=1, exclusivo
 * del administrador (mismo permiso que anular).
 */
import type { DataTableColumn } from "~/components/ui/DataTable.vue";
import { METODO_LABEL, type PaymentsResponse } from "~/types/payments";

definePageMeta({ middleware: ["auth", "admin"], layout: "dashboard" });
useSeoMeta({ title: "Cobros anulados — UrbanBlade", robots: "noindex" });

const { apiFetch } = useApi();
const page = ref(1);

const { data, pending, error, refresh } = await useAsyncData<PaymentsResponse>(
  "payments-anulados",
  () => apiFetch<PaymentsResponse>("/payments", { query: { anulados: 1, page: page.value } }),
  { watch: [page], lazy: true },
);

const rows = computed(() => data.value?.data ?? []);
const meta = computed(() => data.value?.meta);

const COLUMNAS: DataTableColumn[] = [
  { key: "anulado", label: "Anulado" },
  { key: "cliente", label: "Cliente y servicio" },
  { key: "motivo", label: "Motivo" },
  { key: "metodo", label: "Método", hideBelow: "md" },
  { key: "total", label: "Total", align: "right" },
];

function fmtDateTime(iso: string | null | undefined) {
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
    <header class="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 class="mt-1 text-2xl font-semibold text-ink">
          Cobros <span class="text-gold">anulados</span>
        </h1>
        <p class="mt-1 text-sm text-muted">
          No cuentan en ingresos ni en cortes de caja. Se conservan con su comprobante y el motivo.
        </p>
      </div>
      <NuxtLink
        to="/payments"
        class="self-start rounded-lg border border-line px-4 py-2 text-sm text-muted hover:text-ink sm:self-auto"
      >
        Volver a pagos
      </NuxtLink>
    </header>

    <BrandStatePanel
      v-if="error"
      mascot="bruno"
      state="error"
      tone="danger"
      title="No se pudo cargar el historial de cobros anulados"
      description="Inténtalo nuevamente en unos minutos."
      action-label="Reintentar"
      @action="refresh()"
    />
    <UiDataTable
      v-else
      :columns="COLUMNAS"
      :rows="rows"
      :loading="pending"
      aria-label="Cobros anulados"
      empty-title="No hay cobros anulados"
      empty-description="Cuando un administrador anule un cobro, aparecerá aquí con su motivo."
    >
      <template #cell-anulado="{ row }">
        <div class="flex flex-col">
          <span class="font-black text-ink">{{ fmtDateTime(row.anulacion?.fecha) }}</span>
          <span class="text-xs text-muted">por {{ row.anulacion?.por ?? "—" }}</span>
        </div>
      </template>
      <template #cell-cliente="{ row }">
        <div class="flex flex-col">
          <span class="font-bold text-ink">{{ row.appointment.client ?? "N/A" }}</span>
          <span class="text-xs font-black uppercase tracking-widest text-gold">{{ row.appointment.service ?? "General" }}</span>
        </div>
      </template>
      <template #cell-motivo="{ row }">
        <span class="text-sm text-ink/80">{{ row.anulacion?.motivo ?? "—" }}</span>
      </template>
      <template #cell-metodo="{ row }">
        <span class="rounded-full border border-line bg-ink/5 px-2 py-0.5 text-xs font-black uppercase text-muted">{{ METODO_LABEL[row.metodo_pago] ?? row.metodo_pago }}</span>
      </template>
      <template #cell-total="{ row }">
        <span class="font-black text-muted line-through">{{ formatMoney(Number(row.monto) + Number(row.propina)) }}</span>
      </template>
    </UiDataTable>
    <UiPagination
      v-if="meta"
      v-model:current-page="page"
      :last-page="meta.last_page"
      :total="meta.total"
      :per-page="20"
      :busy="pending"
    />
  </div>
</template>
