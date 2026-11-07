<script setup lang="ts">
import type { DataTableColumn } from "~/components/ui/DataTable.vue";
/*
 * Fase 9.8 — "Mis Facturas" del cliente, puerto de Client\ClientInvoiceController
 * (web): historial de pagos de las propias citas con total acumulado y
 * descarga de comprobante (PDF generado bajo demanda por PaymentController::receipt()).
 */
definePageMeta({ middleware: ['auth', 'client'], layout: 'dashboard' })

useSeoMeta({ title: 'Mis recibos — UrbanBlade', robots: 'noindex' })

interface PaymentRow {
  id: string
  monto: number
  metodo_pago: string
  propina: number
  receipt_url: string | null
  created_at: string | null
  appointment: { id: string | null, fecha: string | null, hora_inicio: string | null, service: string | null, barber: string | null }
}

const METODO_LABEL: Record<string, string> = { efectivo: 'Efectivo', tarjeta: 'Tarjeta', transferencia: 'Transferencia', qr: 'QR (histórico)' }

const { apiFetch } = useApi()

const { data: response, pending, error, refresh } = await useAsyncData(
  'my-invoices',
  () => apiFetch<{ data: PaymentRow[], meta: { total_pagado: number, total_citas: number } }>('/payments'),
  { lazy: true },
)
const payments = computed(() => response.value?.data ?? [])
// El historial llega completo; se pagina de 10 en 10 en pantalla.
const PAGE_SIZE = 10;
const page = ref(1);
const lastPage = computed(() => Math.max(1, Math.ceil(payments.value.length / PAGE_SIZE)));
const pageRows = computed(() => payments.value.slice((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE));
const COLUMNAS: DataTableColumn[] = [
  { key: "fecha", label: "Fecha" },
  { key: "servicio", label: "Servicio" },
  { key: "barbero", label: "Barbero", hideBelow: "md" },
  { key: "metodo", label: "Método", hideBelow: "md" },
  { key: "monto", label: "Monto", align: "right" },
];
const meta = computed(() => response.value?.meta ?? { total_pagado: 0, total_citas: 0 })

function fmtMoney(n: number) {
  return formatMoney(n)
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'

  return new Date(`${iso}T00:00:00`).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

const downloading = ref<string | null>(null)
const downloadError = ref('')

async function downloadReceipt(payment: PaymentRow) {
  downloading.value = payment.id
  downloadError.value = ''
  try {
    const res = await apiFetch<{ data: { receipt_url: string } }>(`/payments/${payment.id}/receipt`)
    window.open(res.data.receipt_url, '_blank')
  } catch (err: unknown) {
    downloadError.value = (err as { data?: { message?: string } })?.data?.message ?? 'No se pudo generar el comprobante.'
  } finally {
    downloading.value = null
  }
}
</script>

<template>
  <div class="p-4 sm:p-6 lg:p-8">
    <header class="mb-5">
      <h1 class="mt-1 text-2xl font-semibold text-ink">Mis <span class="text-gold">Recibos</span></h1>
      <p class="mt-1 text-sm text-muted">Historial de pagos de tus citas.</p>
    </header>

    <section v-if="!pending && !error" class="mb-6 grid grid-cols-2 gap-3 sm:w-fit sm:grid-cols-2">
      <div class="ui-card p-4"><p class="text-xs font-bold uppercase text-muted">Total pagado</p><p class="mt-1 text-xl font-black text-gold">{{ fmtMoney(meta.total_pagado) }}</p></div>
      <div class="ui-card p-4"><p class="text-xs font-bold uppercase text-muted">Citas con recibo</p><p class="mt-1 text-xl font-black text-ink">{{ meta.total_citas }}</p></div>
    </section>

    <BrandStatePanel
      v-if="error"
      mascot="bruno"
      state="error"
      tone="danger"
      title="No se pudieron cargar tus recibos"
      action-label="Reintentar"
      @action="refresh"
    />
    <p v-if="downloadError" class="mb-3 text-sm text-danger">{{ downloadError }}</p>
    <UiDataTable
      v-if="!error"
      :columns="COLUMNAS"
      :rows="pageRows"
      :loading="pending"
      aria-label="Mis recibos"
      empty-title="Todavía no tienes pagos registrados"
      empty-description="Tus recibos aparecerán aquí después de tu primera cita pagada."
    >
      <template #cell-fecha="{ row }"><span class="text-ink">{{ fmtDate(row.appointment.fecha) }}</span></template>
      <template #cell-servicio="{ row }"><span class="text-muted">{{ row.appointment.service ?? '—' }}</span></template>
      <template #cell-barbero="{ row }"><span class="text-muted">{{ row.appointment.barber ?? '—' }}</span></template>
      <template #cell-metodo="{ row }"><span class="text-muted">{{ METODO_LABEL[row.metodo_pago] ?? row.metodo_pago }}</span></template>
      <template #cell-monto="{ row }"><span class="font-black text-gold">{{ fmtMoney(Number(row.monto) + Number(row.propina)) }}</span></template>
      <template #actions="{ row }">
        <UiRowActions
          :actions="[{ key: 'download', label: 'Descargar el recibo del ' + fmtDate(row.appointment.fecha), icon: 'text', disabled: downloading === row.id }]"
          @action="downloadReceipt(row)"
        />
      </template>
    </UiDataTable>
    <UiPagination
      v-if="payments.length > PAGE_SIZE"
      v-model:current-page="page"
      :last-page="lastPage"
      :total="payments.length"
      :per-page="PAGE_SIZE"
    />
  </div>
</template>
