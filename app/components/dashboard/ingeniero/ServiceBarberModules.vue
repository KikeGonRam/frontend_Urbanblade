<script setup lang="ts">
import { Bar } from "vue-chartjs";
import type { IngenieroData } from "~/types/dashboard";
import { useBarberStations } from "~/composables/useBarberStations";
import { useEngineerServiceBarberData } from "~/composables/useEngineerServiceBarberData";
import { ensureChartjsRegistered } from "~/utils/registerChartjs";

ensureChartjsRegistered();

const props = defineProps<{ data: IngenieroData }>();

const { hasServices, servicesData, servicesOptions, hasBarberPerformance, barberRanking } =
  useEngineerServiceBarberData(() => props.data);
const { busyStatuses, freeStatuses } = useBarberStations(() => props.data.kpis.barbers_status);
</script>

<template>
  <!-- Módulo Servicios -->
  <div class="ub-rise rounded-2xl border border-line bg-card p-5">
    <div class="mb-4">
      <h3 class="text-base font-semibold text-ink">Servicios</h3>
    </div>
    <div v-if="hasServices" class="h-40">
      <Bar :data="servicesData" :options="servicesOptions" />
    </div>
    <div
      v-else
      class="flex h-40 items-center justify-center rounded-xl border border-dashed border-ink/[0.06]"
    >
      <p class="text-xs font-bold uppercase tracking-widest text-ink/45">
        Todavía no hay servicios registrados
      </p>
    </div>
  </div>

  <!-- Módulo Barberos -->
  <div class="ub-rise rounded-2xl border border-line bg-card p-5">
    <div class="mb-4 flex items-center justify-between">
      <div>
        <h3 class="text-base font-semibold text-ink">Barberos</h3>
      </div>
      <div class="flex gap-2 text-xs font-black uppercase">
        <span
          class="rounded-full border border-danger/20 bg-danger/[0.06] px-2 py-1 text-danger"
          >{{ busyStatuses.length }} ocupados</span
        >
        <span
          class="rounded-full border border-success/20 bg-success/[0.06] px-2 py-1 text-success"
          >{{ freeStatuses.length }} libres</span
        >
      </div>
    </div>
    <UiBarList v-if="hasBarberPerformance" :items="barberRanking" />
    <div
      v-else
      class="flex h-32 items-center justify-center rounded-xl border border-dashed border-ink/[0.06]"
    >
      <p class="text-xs font-bold uppercase tracking-widest text-ink/45">
        Sin datos de desempeño
      </p>
    </div>
    <p
      v-if="data.kpis.top_barber_name"
      class="mt-3 text-xs font-bold text-ink/50"
    >
      Top del mes:
      <span class="text-gold">{{ data.kpis.top_barber_name }}</span> ({{
        data.kpis.top_barber_total
      }}
      citas)
    </p>
  </div>
</template>
