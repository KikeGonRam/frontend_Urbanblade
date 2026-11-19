<script setup lang="ts">
/*
 * Dashboard del rol ingeniero (solo lectura, ver
 * .claude/skills/engineer-dashboard-plan/SKILL.md) -- a diferencia de
 * Administrador.vue (agenda operativa, acciones, lista de citas con
 * nombres de clientes), este es literalmente "el dashboard de cada
 * módulo": una tarjeta por módulo con su KPI + una gráfica, nada de
 * listas operativas ni acciones de gestión. Los datos vienen de
 * DashboardController::ingenieroPayload() en barber, que reusa
 * adminMetrics() pero omite a propósito todayAppointments/
 * recentAppointments (nombres de clientes).
 *
 * Este archivo solo orquesta: los módulos viven en components/dashboard/ingeniero/
 * y la lógica de datos en los composables useEngineer*.
 */
import type { IngenieroData } from "~/types/dashboard";

defineProps<{ data: IngenieroData }>();

const { systemStatus, systemHealth, ready } = useEngineerSystemStatus();
await ready;
</script>

<template>
  <div class="space-y-5">
    <DashboardHeader
      label="Ingeniería"
      color="text-gold"
      :today-label="data.todayLabel"
    >
      <span
        class="flex min-h-10 items-center gap-1.5 rounded-xl border border-ink/[0.08] bg-ink/[0.03] px-3 py-2 text-xs font-black uppercase tracking-widest text-ink/40"
      >
        <svg
          class="h-3 w-3"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
          />
        </svg>
        Solo lectura
      </span>
    </DashboardHeader>

    <DashboardIngenieroSystemHealthPanel :status="systemStatus" :health="systemHealth" />

    <p class="px-1 text-xs leading-relaxed text-muted">
      Comportamiento agregado de cada módulo del negocio, sin datos operativos
      de clientes individuales. Para el detalle completo, usa
      <NuxtLink to="/reports" class="text-gold hover:underline"
        >Reportes</NuxtLink
      >,
      <NuxtLink to="/logs" class="text-gold hover:underline">Logs</NuxtLink> o
      el
      <NuxtLink to="/system" class="text-gold hover:underline"
        >estado del servidor</NuxtLink
      >.
    </p>

    <div class="flex items-center gap-3 px-1 pt-1">
      <h2 class="text-lg font-semibold text-ink">Módulos del negocio</h2>
      <span class="h-px flex-1 bg-ink/[0.06]" />
    </div>

    <section class="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <DashboardIngenieroTrendModules :data="data" />
      <DashboardIngenieroServiceBarberModules :data="data" />
      <DashboardIngenieroClientInventoryModules :kpis="data.kpis" />
      <DashboardIngenieroOperationsModules :data="data" />
      <DashboardIngenieroChatbotModule :telemetry="data.chatbotTelemetry" />
    </section>

    <DashboardAnalyticsInsights :simple="data.insights" :insights="data.sparkHighlights" />
  </div>
</template>
