<script setup lang="ts">
/*
 * Dona del kit con el dato central y una leyenda legible (valor y porcentaje por fila).
 * Úsala para partes de un total (estados de cita, base de clientes); para comparar
 * categorías entre sí sigue siendo mejor una barra ordenada.
 */
import { Doughnut } from "vue-chartjs";
import { chartTooltip, fmtInt } from "~/utils/chartTheme";
import { ensureChartjsRegistered } from "~/utils/registerChartjs";

ensureChartjsRegistered();

export interface DonutItem {
  label: string;
  value: number;
  color: string;
}

const props = withDefaults(
  defineProps<{
    title: string;
    subtitle?: string | null;
    items: DonutItem[];
    /** Texto grande al centro (por defecto, el total). */
    centerValue?: string | null;
    centerLabel?: string;
    emptyText?: string;
  }>(),
  { subtitle: null, centerValue: null, centerLabel: "Total", emptyText: "Todavía no hay datos para mostrar." },
);

const visible = computed(() => props.items.filter((i) => i.value > 0));
const total = computed(() => visible.value.reduce((sum, i) => sum + i.value, 0));
const hasData = computed(() => total.value > 0);

const chartData = computed(() => ({
  labels: visible.value.map((i) => i.label),
  datasets: [
    {
      data: visible.value.map((i) => i.value),
      backgroundColor: visible.value.map((i) => i.color),
      borderWidth: 3,
      borderColor: "transparent",
      hoverOffset: 6,
      borderRadius: 4,
    },
  ],
}));

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  cutout: "72%",
  plugins: {
    legend: { display: false },
    tooltip: {
      ...chartTooltip(),
      callbacks: {
        label: (ctx: { label: string; parsed: number }) =>
          `${ctx.label}: ${fmtInt(ctx.parsed)} (${Math.round((ctx.parsed / (total.value || 1)) * 100)}%)`,
      },
    },
  },
}));

const pct = (value: number) => `${Math.round((value / (total.value || 1)) * 100)}%`;
</script>

<template>
  <UiChartCard :title="title" :subtitle="subtitle" :empty="!hasData" :empty-text="emptyText" height="h-auto">
    <div class="@container">
      <div class="grid items-center gap-6 @lg:grid-cols-[13rem_minmax(0,1fr)]">
      <div class="relative mx-auto h-52 w-52">
        <Doughnut :data="chartData" :options="chartOptions" />
        <div class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span class="text-3xl font-bold tabular-nums text-ink">{{ centerValue ?? fmtInt(total) }}</span>
          <span class="mt-0.5 text-xs font-medium text-muted">{{ centerLabel }}</span>
        </div>
      </div>
      <ul class="space-y-2.5" :aria-label="`Detalle de ${title}`">
        <li v-for="item in visible" :key="item.label" class="flex items-center gap-3 text-sm">
          <span class="h-3 w-3 shrink-0 rounded-full" :style="{ background: item.color }" aria-hidden="true" />
          <span class="min-w-0 flex-1 truncate text-ink">{{ item.label }}</span>
          <span class="font-semibold tabular-nums text-ink">{{ fmtInt(item.value) }}</span>
          <span class="w-10 text-right text-xs tabular-nums text-muted">{{ pct(item.value) }}</span>
        </li>
      </ul>
      </div>
    </div>
  </UiChartCard>
</template>
