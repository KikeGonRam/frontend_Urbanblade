<script setup lang="ts">
import { Line } from "vue-chartjs";
import type { IngenieroData } from "~/types/dashboard";
import { useEngineerTrendCharts } from "~/composables/useEngineerTrendCharts";
import { fmtInt, fmtMoney } from "~/utils/chartTheme";
import { ensureChartjsRegistered } from "~/utils/registerChartjs";

ensureChartjsRegistered();

const props = defineProps<{ data: IngenieroData }>();

const { hasAppointmentTrend, appointmentTrendData, lineOptionsFor, hasIncome, incomeData } = useEngineerTrendCharts(
  () => props.data,
);
</script>

<template>
  <!-- Módulo Citas -->
  <div class="ub-rise rounded-2xl border border-line bg-card p-5">
    <div class="mb-4 flex items-center justify-between">
      <div>
        <h3 class="text-base font-semibold text-ink">Citas</h3>
      </div>
      <div class="text-right">
        <p class="text-2xl font-semibold leading-none text-ink">
          {{ data.kpis.appointments_today }}
        </p>
        <p class="text-xs font-bold uppercase text-ink/40">hoy</p>
      </div>
    </div>
    <div v-if="hasAppointmentTrend" class="h-36">
      <Line
        :data="appointmentTrendData"
        :options="lineOptionsFor((v) => `${fmtInt(v)} citas`)"
      />
    </div>
    <div
      v-else
      class="flex h-36 items-center justify-center rounded-xl border border-dashed border-ink/[0.06]"
    >
      <p class="text-xs font-bold uppercase tracking-widest text-ink/45">
        Sin datos aún
      </p>
    </div>
    <div
      class="mt-3 flex items-center gap-2 text-xs font-black text-ink/50"
    >
      <span>Sem {{ data.kpis.appointments_week }}</span
      ><span>·</span><span>Mes {{ data.kpis.appointments_month }}</span>
      <span
        v-if="data.kpis.appointment_growth != 0"
        class="ml-auto"
        :class="
          data.kpis.appointment_growth >= 0
            ? 'text-success'
            : 'text-danger'
        "
      >
        {{ data.kpis.appointment_growth >= 0 ? "▲" : "▼"
        }}{{ Math.abs(data.kpis.appointment_growth) }}%
      </span>
    </div>
  </div>

  <!-- Módulo Ingresos -->
  <div class="ub-rise rounded-2xl border border-line bg-card p-5">
    <div class="mb-4 flex items-center justify-between">
      <div>
        <h3 class="text-base font-semibold text-ink">Ingresos</h3>
      </div>
      <div class="text-right">
        <p class="text-2xl font-semibold leading-none text-ink">
          {{ fmtMoney(data.kpis.income_today) }}
        </p>
        <p class="text-xs font-bold uppercase text-ink/40">hoy</p>
      </div>
    </div>
    <div v-if="hasIncome" class="h-36">
      <Line
        :data="incomeData"
        :options="lineOptionsFor((v) => fmtMoney(v))"
      />
    </div>
    <div
      v-else
      class="flex h-36 items-center justify-center rounded-xl border border-dashed border-ink/[0.06]"
    >
      <p class="text-xs font-bold uppercase tracking-widest text-ink/45">
        Sin datos aún
      </p>
    </div>
    <div
      class="mt-3 flex items-center gap-2 text-xs font-black text-ink/50"
    >
      <span>Sem {{ fmtMoney(data.kpis.income_week) }}</span
      ><span>·</span><span>Mes {{ fmtMoney(data.kpis.income_month) }}</span>
      <span
        v-if="data.kpis.income_growth != 0"
        class="ml-auto"
        :class="
          data.kpis.income_growth >= 0 ? 'text-success' : 'text-danger'
        "
      >
        {{ data.kpis.income_growth >= 0 ? "▲" : "▼"
        }}{{ Math.abs(data.kpis.income_growth) }}%
      </span>
    </div>
  </div>
</template>
