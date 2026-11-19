<script setup lang="ts">
import { Bar, Chart } from "vue-chartjs";
import type { AdminData } from "~/types/dashboard";
import { useAdminRevenueCharts } from "~/composables/useAdminRevenueCharts";
import { ensureChartjsRegistered } from "~/utils/registerChartjs";

ensureChartjsRegistered();

const props = defineProps<{ data: AdminData }>();

const { hasIncome, incomeData, incomeOptions, hasServices, servicesData, servicesOptions } = useAdminRevenueCharts(
  () => props.data,
);
</script>

<template>
  <!-- Gráficas protagonistas a la vista (antes estaban escondidas en "Analítica avanzada"). -->
  <section class="grid grid-cols-1 gap-4 lg:grid-cols-5">
    <UiChartCard
      class="lg:col-span-3"
      title="Ingresos por semana"
      subtitle="Últimas 8 semanas · verde subió, rojo bajó, dorado es la actual · línea: promedio móvil"
      height="h-80"
      :empty="!hasIncome"
      empty-text="Todavía no hay ingresos registrados."
    >
      <Chart type="bar" :data="incomeData" :options="incomeOptions" />
    </UiChartCard>
    <UiChartCard
      class="lg:col-span-2"
      title="Servicios más pedidos"
      subtitle="Citas por servicio"
      height="h-80"
      :empty="!hasServices"
      empty-text="Todavía no hay servicios reservados."
    >
      <Bar :data="servicesData" :options="servicesOptions" />
    </UiChartCard>
  </section>
</template>
