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

    <DashboardAdministradorRevenueCharts :data="data" />

    <div class="flex items-center gap-3 px-1 pt-2">
      <span class="text-xs font-black uppercase tracking-[0.22em] text-gold"
        >Operación de hoy</span
      >
      <span class="h-px flex-1 bg-ink/[0.06]" />
    </div>

    <section class="grid grid-cols-1 gap-5 lg:grid-cols-12">
      <DashboardAdministradorTodayAppointments
        :appointments="data.todayAppointments"
        @select="detailCode = $event"
      />
      <DashboardAdministradorActivityPanel :data="data" @select="detailCode = $event" />
    </section>

    <section class="space-y-5" aria-labelledby="admin-analitica">
      <header class="px-1 pt-2">
        <h2 id="admin-analitica" class="text-lg font-semibold text-ink">Desempeño y predicciones</h2>
        <p class="mt-0.5 text-sm text-muted">Barberos, citas del mes, predicciones y uso de Bladebot.</p>
      </header>
      <div class="space-y-5">
        <DashboardAdministradorPerformanceCharts :data="data" />

        <section class="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <DashboardAdministradorAiPredictions />
          <DashboardAdministradorChatbotUsage :telemetry="data.chatbotTelemetry" />
        </section>
      </div>
    </section>

    <!-- Al final: es lectura de apoyo (plegada por defecto), no lo primero que el administrador necesita. -->
    <DashboardAnalyticsInsights
      :simple="data.insights"
      :insights="data.sparkHighlights"
      show-link
    />

    <UiAppointmentDetailModal v-if="detailCode" :code="detailCode" @close="detailCode = null" />
  </div>
</template>
