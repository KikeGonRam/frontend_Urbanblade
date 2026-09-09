<script setup lang="ts">
/*
 * Fase 9.3 — revisión de comprobantes de transferencia subidos por
 * clientes. Antes solo existía como vista Blade con sesión
 * (Payment\PaymentController::pending/approve/reject); esta página
 * consume los nuevos endpoints GET /payments/pending y
 * POST /payments/{id}/approve|reject agregados en esta misma fase.
 */
definePageMeta({ middleware: ["auth", "staff"], layout: "dashboard" });

interface PendingPayment {
  id: string;
  // Payment::$monto/$ocr_monto_detectado usan el cast decimal:2 de
  // Laravel, que siempre serializa como string ("225.00") — Number() antes
  // de cualquier aritmética, nunca sumar/restar el string directo.
  monto: string;
  created_at: string | null;
  comprobante_url: string | null;
  ocr_texto: string | null;
  ocr_monto_detectado: string | null;
  appointment: {
    id: string | null;
    client: string | null;
    service: string | null;
    service_price: number | null;
  };
}

const { apiFetch } = useApi();

const {
  data: response,
  pending,
  error,
  refresh,
} = await useAsyncData(
  "payments-pending",
  () => apiFetch<{ data: PendingPayment[] }>("/payments/pending"),
  { lazy: true },
);
const payments = computed(() => response.value?.data ?? []);

const rejecting = ref<string | null>(null);
const motivo = ref("");
const busy = ref<string | null>(null);
const actionError = ref("");

function fmtMoney(n: number | string | null) {
  return `$${Number(n ?? 0).toFixed(2)}`;
}

function montoMatches(payment: PendingPayment) {
  return (
    Math.abs((payment.appointment.service_price ?? 0) - Number(payment.monto)) <
    0.01
  );
}

function fmtDateTime(iso: string | null) {
  if (!iso) return "—";

  return new Date(iso).toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isPdf(url: string | null) {
  return Boolean(url && url.toLowerCase().endsWith(".pdf"));
}

async function approve(payment: PendingPayment) {
  busy.value = payment.id;
  actionError.value = "";
  try {
    await apiFetch(`/payments/${payment.id}/approve`, { method: "POST" });
    await refresh();
  } catch (err: unknown) {
    actionError.value =
      (err as { data?: { message?: string } })?.data?.message ??
      "No se pudo aprobar el comprobante.";
  } finally {
    busy.value = null;
  }
}

function openReject(payment: PendingPayment) {
  rejecting.value = payment.id;
  motivo.value = "";
}

async function confirmReject(payment: PendingPayment) {
  if (!motivo.value.trim()) return;

  busy.value = payment.id;
  actionError.value = "";
  try {
    await apiFetch(`/payments/${payment.id}/reject`, {
      method: "POST",
      body: { motivo_rechazo: motivo.value },
    });
    rejecting.value = null;
    await refresh();
  } catch (err: unknown) {
    actionError.value =
      (err as { data?: { message?: string } })?.data?.message ??
      "No se pudo rechazar el comprobante.";
  } finally {
    busy.value = null;
  }
}
</script>

<template>
  <div class="p-4 sm:p-6 lg:p-8">
    <header
      class="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div>
        <p class="text-sm uppercase tracking-widest text-muted">UrbanBlade</p>
        <h1 class="mt-1 text-2xl font-semibold text-ink">
          Comprobantes <span class="text-gold">por Revisar</span>
        </h1>
        <p class="mt-1 text-sm text-muted">
          Transferencias subidas por clientes, pendientes de aprobación.
        </p>
      </div>
      <NuxtLink
        to="/payments"
        class="rounded-lg border border-line px-4 py-2 text-sm text-muted hover:text-ink"
      >
        Ver todos los pagos
      </NuxtLink>
    </header>
    <p v-if="actionError" role="alert" class="mb-4 text-sm text-red-400">
      {{ actionError }}
    </p>

    <p v-if="pending" class="text-sm text-muted">Cargando comprobantes…</p>
    <p v-else-if="error" class="text-sm text-red-400">
      No se pudieron cargar los comprobantes pendientes.
    </p>

    <div
      v-else-if="!payments.length"
      class="rounded-2xl border border-dashed border-line p-16 text-center"
    >
      <p class="text-sm font-bold uppercase tracking-widest text-muted">
        No hay comprobantes pendientes
      </p>
    </div>

    <div v-else class="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <div
        v-for="payment in payments"
        :key="payment.id"
        class="ui-card overflow-hidden"
      >
        <div class="flex items-center justify-between border-b border-line p-5">
          <div>
            <p class="text-sm font-black text-ink">
              {{ payment.appointment.client ?? "Cliente" }}
            </p>
            <p
              class="text-[10px] font-black uppercase tracking-widest text-gold"
            >
              {{ payment.appointment.service ?? "Servicio" }}
            </p>
          </div>
          <span
            class="text-[9px] font-black uppercase tracking-widest text-muted"
            >{{ fmtDateTime(payment.created_at) }}</span
          >
        </div>

        <div class="space-y-4 p-5">
          <a
            v-if="payment.comprobante_url"
            :href="payment.comprobante_url"
            target="_blank"
            rel="noopener noreferrer"
            class="block overflow-hidden rounded-xl border border-line bg-black/40"
          >
            <div
              v-if="isPdf(payment.comprobante_url)"
              class="p-6 text-center text-xs text-muted"
            >
              📄 Ver comprobante PDF
            </div>
            <img
              v-else
              :src="payment.comprobante_url"
              alt="Comprobante"
              class="max-h-80 w-full object-contain"
            >
          </a>

          <div class="grid grid-cols-2 gap-3 text-sm">
            <div class="rounded-xl border border-line bg-ink/5 p-3">
              <p
                class="text-[9px] font-black uppercase tracking-widest text-muted"
              >
                Monto esperado
              </p>
              <p class="font-black text-ink">
                {{ fmtMoney(payment.appointment.service_price) }}
              </p>
            </div>
            <div
              class="rounded-xl border p-3"
              :class="
                montoMatches(payment)
                  ? 'border-emerald-500/25 bg-emerald-500/8'
                  : 'border-amber-500/25 bg-amber-500/8'
              "
            >
              <p
                class="text-[9px] font-black uppercase tracking-widest text-muted"
              >
                Monto de la cita
              </p>
              <p
                class="font-black"
                :class="
                  montoMatches(payment) ? 'text-emerald-400' : 'text-amber-400'
                "
              >
                {{ fmtMoney(payment.monto) }}
              </p>
            </div>
          </div>

          <div
            v-if="payment.ocr_texto"
            class="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3"
          >
            <p
              class="mb-1 text-[9px] font-black uppercase tracking-widest text-blue-300"
            >
              Texto detectado (OCR)
            </p>
            <p class="whitespace-pre-line text-[11px] text-ink/70">
              {{ payment.ocr_texto.slice(0, 300) }}
            </p>
            <p
              v-if="payment.ocr_monto_detectado"
              class="mt-1 text-[10px] text-blue-300"
            >
              Monto sugerido: {{ fmtMoney(payment.ocr_monto_detectado) }}
            </p>
          </div>

          <div class="flex items-center gap-3 pt-2">
            <button
              type="button"
              :disabled="busy === payment.id"
              class="flex-1 rounded-xl bg-emerald-500 py-2.5 text-[11px] font-black uppercase tracking-widest text-black hover:bg-emerald-400 disabled:opacity-50"
              @click="approve(payment)"
            >
              Aprobar
            </button>
            <div class="flex-1">
              <button
                v-if="rejecting !== payment.id"
                type="button"
                class="w-full rounded-xl border border-red-500/30 bg-red-500/10 py-2.5 text-[11px] font-black uppercase tracking-widest text-red-300 hover:bg-red-500/20"
                @click="openReject(payment)"
              >
                Rechazar
              </button>
              <div
                v-else
                class="space-y-2 rounded-xl border border-line bg-card p-3"
              >
                <textarea
                  v-model="motivo"
                  rows="2"
                  maxlength="500"
                  placeholder="Motivo del rechazo…"
                  class="w-full rounded-lg border border-line bg-main px-3 py-2 text-xs text-ink"
                />
                <div class="flex gap-2">
                  <button
                    type="button"
                    :disabled="!motivo.trim() || busy === payment.id"
                    class="flex-1 rounded-lg bg-red-500 py-2 text-[10px] font-black uppercase tracking-widest text-white hover:bg-red-400 disabled:opacity-50"
                    @click="confirmReject(payment)"
                  >
                    Confirmar rechazo
                  </button>
                  <button
                    type="button"
                    class="rounded-lg border border-line px-3 py-2 text-[10px] text-muted hover:text-ink"
                    @click="rejecting = null"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
