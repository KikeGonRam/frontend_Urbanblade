<script setup lang="ts">
/*
 * Fase 9.3 del plan (ver .claude/skills/nuxt-migration-plan/SKILL.md) —
 * como 9.1/9.2, payments/index.blade.php en barber sigue siendo Blade
 * puro, así que esta página se construye directo desde el contrato de
 * Api/Payment/PaymentController, enriquecido en esta misma fase con
 * filtros (q/barbero_id/fecha_desde/fecha_hasta) + stats/pending_count en
 * meta, y el nuevo GET /appointments/chargeable para el selector de
 * "Nuevo Cobro".
 *
 * Página delgada: la lógica vive en los composables usePaymentsFilters /
 * usePaymentsList / usePaymentActions / usePaymentCharge (+ usePaymentStripe)
 * y la plantilla en app/components/payments/. El monto que se cobra NUNCA se
 * calcula aquí para enviarlo (ver usePaymentCharge y guardrail #13 de barber).
 */
definePageMeta({ middleware: ["auth", "staff"], layout: "dashboard" });
useSeoMeta({ title: 'Pagos — UrbanBlade', robots: 'noindex' })

const { hasRole } = useAuth();

const filters = usePaymentsFilters();
const { pending, error, refresh, payments, stats, pendingCount, pagination, barbers } =
  await usePaymentsList(filters);
const { actionError, voiding, voidReason, voidBusy, voidError, confirmVoid, onRowAction } =
  usePaymentActions(refresh);
const charge = usePaymentCharge(refresh);
</script>

<template>
  <div class="p-4 sm:p-6 lg:p-8">
    <PaymentsHeader :pending-count="pendingCount" @new-charge="charge.openCharge()" />
    <p v-if="actionError" role="alert" class="mb-4 text-sm text-danger">
      {{ actionError }}
    </p>

    <PaymentsStats v-if="stats" :stats="stats" />

    <PaymentsFilters
      v-model:search="filters.search.value"
      v-model:metodo="filters.metodoFilter.value"
      v-model:barbero="filters.barberoFilter.value"
      v-model:desde="filters.fechaDesde.value"
      v-model:hasta="filters.fechaHasta.value"
      :barbers="barbers"
      :has-active-filters="filters.hasActiveFilters.value"
      @clear="filters.clearFilters"
    />

    <PaymentsTable
      v-model:page="filters.page.value"
      :payments="payments"
      :pending="pending"
      :has-error="Boolean(error)"
      :is-admin="hasRole('administrador')"
      :pagination="pagination"
      @retry="refresh"
      @row-action="onRowAction"
    />

    <LazyPaymentsVoidModal
      v-if="voiding"
      v-model:reason="voidReason"
      :payment="voiding"
      :busy="voidBusy"
      :error="voidError"
      @close="voiding = null"
      @confirm="confirmVoid"
    />

    <PaymentsChargeSheet
      v-if="charge.showCharge.value"
      v-model:form="charge.form"
      v-model:card-el="charge.cardElementRef.value"
      v-model:ocultar-sugerencias="charge.ocultarSugerencias.value"
      :chargeable="charge.chargeableAppointments.value"
      :selected="charge.selected.value"
      :loading="charge.loadingChargeable.value"
      :saving="charge.saving.value"
      :charge-error="charge.chargeError.value"
      :preview="charge.preview.value"
      :metodo-options="charge.metodoOptions.value"
      :tip-presets="TIP_PRESETS"
      :tip-for="charge.tipFor"
      :sugerencias="charge.sugerencias.value"
      :productos-agregados="charge.productosAgregados.value"
      :productos-count="charge.productosVendidos.value.length"
      :productos-total="charge.productosTotal.value"
      :total="charge.totalConProductos.value"
      :stripe-errors="charge.stripeErrors.value"
      :stripe-processing="charge.stripeProcessing.value"
      @close="charge.closeCharge"
      @submit="charge.submitCharge"
      @select-appointment="charge.selectAppointment"
      @pay-card="charge.payWithCard"
      @toggle-producto="charge.toggleProducto"
    />
  </div>
</template>
