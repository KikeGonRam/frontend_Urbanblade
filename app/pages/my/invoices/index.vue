<script setup lang="ts">
/*
 * Fase 9.8 — "Mis Facturas" del cliente, puerto de Client\ClientInvoiceController
 * (web): historial de pagos de las propias citas con total acumulado y
 * descarga de comprobante (PDF generado bajo demanda por PaymentController::receipt()).
 */
definePageMeta({ middleware: ['auth', 'client'], layout: 'dashboard' })

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

const { data: response, pending, error } = await useAsyncData(
  'my-invoices',
  () => apiFetch<{ data: PaymentRow[], meta: { total_pagado: number, total_citas: number } }>('/payments'),
  { lazy: true },
)
const payments = computed(() => response.value?.data ?? [])
const meta = computed(() => response.value?.meta ?? { total_pagado: 0, total_citas: 0 })

function fmtMoney(n: number) {
  return `$${Number(n ?? 0).toFixed(2)}`
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
      <p class="text-sm uppercase tracking-widest text-muted">UrbanBlade</p>
      <h1 class="mt-1 text-2xl font-semibold text-ink">Mis <span class="text-gold">Facturas</span></h1>
      <p class="mt-1 text-sm text-muted">Historial de pagos de tus citas.</p>
    </header>

    <section v-if="!pending && !error" class="mb-6 grid grid-cols-2 gap-3 sm:w-fit sm:grid-cols-2">
      <div class="ui-card p-4"><p class="text-[10px] font-bold uppercase text-muted">Total pagado</p><p class="mt-1 text-xl font-black text-gold">{{ fmtMoney(meta.total_pagado) }}</p></div>
      <div class="ui-card p-4"><p class="text-[10px] font-bold uppercase text-muted">Citas facturadas</p><p class="mt-1 text-xl font-black text-ink">{{ meta.total_citas }}</p></div>
    </section>

    <p v-if="pending" class="text-sm text-muted">Cargando tus facturas…</p>
    <p v-else-if="error" class="text-sm text-red-400">No se pudieron cargar tus facturas.</p>
    <p v-else-if="!payments.length" class="rounded-2xl border border-dashed border-line p-12 text-center text-sm text-muted">
      Todavía no tienes pagos registrados.
    </p>

    <p v-if="downloadError" class="mb-3 text-sm text-red-400">{{ downloadError }}</p>

    <section v-if="payments.length" class="ui-card overflow-x-auto">
      <table class="w-full text-left text-sm">
        <thead>
          <tr class="border-b border-line text-[10px] uppercase tracking-wider text-muted">
            <th class="px-4 py-3">Fecha</th>
            <th class="px-4 py-3">Servicio</th>
            <th class="px-4 py-3">Barbero</th>
            <th class="px-4 py-3">Método</th>
            <th class="px-4 py-3 text-right">Monto</th>
            <th class="px-4 py-3 text-right">Comprobante</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="payment in payments" :key="payment.id" class="border-b border-line/60 last:border-0">
            <td class="px-4 py-3 text-ink">{{ fmtDate(payment.appointment.fecha) }}</td>
            <td class="px-4 py-3 text-muted">{{ payment.appointment.service ?? '—' }}</td>
            <td class="px-4 py-3 text-muted">{{ payment.appointment.barber ?? '—' }}</td>
            <td class="px-4 py-3 text-muted">{{ METODO_LABEL[payment.metodo_pago] ?? payment.metodo_pago }}</td>
            <td class="px-4 py-3 text-right font-black text-gold">{{ fmtMoney(Number(payment.monto) + Number(payment.propina)) }}</td>
            <td class="px-4 py-3 text-right">
              <button
                type="button" :disabled="downloading === payment.id"
                class="rounded-lg border border-line px-3 py-1 text-xs text-muted hover:text-ink disabled:opacity-50"
                @click="downloadReceipt(payment)"
              >
                {{ downloading === payment.id ? 'Generando…' : 'Descargar' }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>
