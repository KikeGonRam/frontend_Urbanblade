<script setup lang="ts">
import { Chart, Line } from "vue-chartjs";
import type { AdminData } from "~/types/dashboard";
import { useAdminPerformanceCharts } from "~/composables/useAdminPerformanceCharts";
import { ensureChartjsRegistered } from "~/utils/registerChartjs";

ensureChartjsRegistered();

const props = defineProps<{ data: AdminData }>();

const {
  barberRanking,
  hasBarberCombo,
  barberComboData,
  barberComboOptions,
  clientBase,
  hasClientTrends,
  clientTrendsData,
  clientTrendsOptions,
} = useAdminPerformanceCharts(() => props.data);
</script>

<template>
  <div class="space-y-5">
    <section class="grid grid-cols-1 gap-5 xl:grid-cols-5">
      <!-- Lista con barras: nombres completos y valores legibles (antes 2 gráficas diminutas con
           nombres girados). Los barberos dados de baja se agrupan en gris. -->
      <section class="ub-rise rounded-2xl border border-line bg-card p-5 sm:p-6 xl:col-span-2" aria-labelledby="admin-barberos">
        <header class="mb-5 flex items-start justify-between gap-3">
          <div>
            <h3 id="admin-barberos" class="text-base font-semibold text-ink">Desempeño por barbero</h3>
            <p class="mt-0.5 text-sm text-muted">Citas completadas este mes</p>
          </div>
          <NuxtLink to="/barbers/manage" class="text-sm font-semibold text-gold hover:underline">Barberos</NuxtLink>
        </header>
        <UiBarList v-if="barberRanking.length" :items="barberRanking" />
        <p v-else class="rounded-xl border border-dashed border-line py-10 text-center text-sm text-muted">
          Todavía no hay citas completadas este mes.
        </p>
      </section>

      <UiChartCard
        class="xl:col-span-3"
        title="Citas completadas del mes"
        subtitle="Por tramos de 3 días, hasta hoy"
        :empty="!hasClientTrends"
        empty-text="Todavía no hay citas completadas este mes."
      >
        <Line :data="clientTrendsData" :options="clientTrendsOptions" />
      </UiChartCard>
    </section>

    <section class="grid grid-cols-1 gap-5 xl:grid-cols-5">
      <UiChartCard
        class="xl:col-span-3"
        title="Ingresos y citas por barbero"
        subtitle="Barras: ingresos del mes · línea: citas completadas"
        :empty="!hasBarberCombo"
        empty-text="Todavía no hay actividad de barberos este mes."
      >
        <Chart type="bar" :data="barberComboData" :options="barberComboOptions" />
      </UiChartCard>
      <div class="xl:col-span-2">
        <UiDonutCard
          title="Base de clientes"
          subtitle="Activos frente a inactivos"
          :items="clientBase"
          :center-value="`${Math.round(data.kpis.retention_rate ?? 0)}%`"
          center-label="Retención"
          empty-text="Todavía no hay clientes registrados."
        />
      </div>
    </section>
  </div>
</template>
