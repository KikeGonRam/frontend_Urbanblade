<script setup lang="ts">
/*
 * Orquestador del dashboard del administrador. Cada bloque vive en
 * components/dashboard/administrador/ y su lógica de datos en los composables useAdmin*.
 * Las gráficas siguen montándose perezosamente: UiChartCard solo renderiza su slot al entrar en pantalla.
 */
import type { AdminData } from "~/types/dashboard";

defineProps<{ data: AdminData }>();

// Cita abierta en la ventana de detalle (se toca desde «Citas de hoy» o «Actividad»).
const detailCode = ref<string | null>(null);
</script>

<template>
  <div class="space-y-5">
    <DashboardHeader
      label="Administrativo"
      color="text-gold"
      :today-label="data.todayLabel"
    />

    <DashboardAdministradorQuickActions />

    <DashboardAdministradorKpis :data="data" />

    <!--
      Rediseño (nov-2026): primero lo que hay que atender hoy y luego cómo va la semana. «Desempeño y
      predicciones» salió del panel: el desempeño por barbero y la base de clientes ya están en el tablero de
      Analítica, y las predicciones y el uso de Bladebot se movieron allí. En el teléfono el panel medía ~5 pantallas.
    -->
    <div class="flex items-center gap-3 px-1 pt-2">
      <h2 class="text-xs font-black uppercase tracking-[0.22em] text-gold">Operación de hoy</h2>
      <span class="h-px flex-1 bg-ink/[0.06]" aria-hidden="true" />
    </div>

    <section class="grid grid-cols-1 gap-5 lg:grid-cols-12">
      <DashboardAdministradorTodayAppointments
        :appointments="data.todayAppointments"
        @select="detailCode = $event"
      />
      <DashboardAdministradorActivityPanel :data="data" @select="detailCode = $event" />
    </section>

    <DashboardAdministradorRevenueCharts :data="data" />

    <NuxtLink
      to="/analytics"
      class="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line bg-card px-5 py-4 transition-colors hover:border-gold/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
    >
      <span>
        <span class="block text-base font-semibold text-ink">Desempeño, predicciones y Bladebot</span>
        <span class="mt-0.5 block text-sm text-muted">Ingresos por barbero, retención de clientes y uso del asistente.</span>
      </span>
      <span class="text-sm font-semibold text-gold">Ver en Análisis →</span>
    </NuxtLink>

    <!-- Al final: es lectura de apoyo (plegada por defecto), no lo primero que el administrador necesita. -->
    <!-- Sin «Ver analítica completa»: la tarjeta de arriba ya lleva a Análisis. -->
    <DashboardAnalyticsInsights
      :simple="data.insights"
      :insights="data.sparkHighlights"
    />

    <UiAppointmentDetailModal v-if="detailCode" :code="detailCode" @close="detailCode = null" />
  </div>
</template>
