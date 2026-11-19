<script setup lang="ts">
import type { AdminData } from "~/types/dashboard";
import { CITAS_LABEL, INGRESOS_LABEL, PERIODOS, useAdminKpis } from "~/composables/useAdminKpis";
import { fmtInt, fmtMoney } from "~/utils/chartTheme";

const props = defineProps<{ data: AdminData }>();

const { periodo, citasPorPeriodo, ingresosPorPeriodo, citasHint, ingresosHint, ratioActiveClients } = useAdminKpis(
  () => props.data,
);
</script>

<template>
  <div class="space-y-5">
    <div class="flex items-center gap-3 px-1 pt-1">
      <span class="text-xs font-black uppercase tracking-[0.22em] text-gold"
        >Resumen</span
      >
      <span class="h-px flex-1 bg-ink/[0.06]" />
    </div>

    <div class="flex flex-wrap items-center justify-between gap-3">
      <h2 class="text-sm font-black uppercase tracking-[0.18em] text-gold">Resumen</h2>
      <UiFilterChips v-model="periodo" label="Periodo de las tarjetas" :options="PERIODOS" />
    </div>
    <section class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Resumen">
      <UiStatCard
        :label="CITAS_LABEL[periodo]"
        :value="fmtInt(citasPorPeriodo[periodo])"
        :delta="data.kpis.appointment_growth"
        delta-label="vs. mes pasado"
        :hint="citasHint"
        icon="calendar"
        to="/appointments"
      />
      <UiStatCard
        :label="INGRESOS_LABEL[periodo]"
        :value="fmtMoney(ingresosPorPeriodo[periodo])"
        :delta="data.kpis.income_growth"
        delta-label="vs. mes pasado"
        :spark="data.incomeChart.values"
        :hint="ingresosHint"
        icon="cash"
        to="/payments"
      />
      <UiStatCard
        label="Clientes activos"
        :value="fmtInt(data.kpis.active_clients)"
        :progress="ratioActiveClients"
        :hint="`${ratioActiveClients}% de ${fmtInt(data.kpis.total_clients)} clientes · ${fmtInt(data.kpis.new_clients)} nuevos`"
        icon="users"
        to="/clients"
      />
      <UiStatCard
        label="Retención"
        :value="`${data.kpis.retention_rate.toFixed(1)}%`"
        :progress="data.kpis.retention_rate"
        :hint="`${fmtInt(data.kpis.recurring_clients)} clientes recurrentes`"
        icon="repeat"
      />
    </section>

    <NuxtLink
      v-if="(data.kpis.low_stock_count ?? 0) > 0"
      to="/inventory/products"
      class="flex items-center gap-3 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning transition hover:border-warning/60"
    >
      <svg class="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
      <span class="font-semibold">{{ data.kpis.low_stock_count }} {{ data.kpis.low_stock_count === 1 ? "producto" : "productos" }} con stock bajo</span>
      <span class="ml-auto text-xs font-semibold">Revisar inventario →</span>
    </NuxtLink>
  </div>
</template>
