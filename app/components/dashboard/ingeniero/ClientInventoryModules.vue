<script setup lang="ts">
import type { DashboardKpis } from "~/types/dashboard";

const props = defineProps<{ kpis: DashboardKpis }>();

const ratioActiveClients = computed(() =>
  props.kpis.total_clients > 0
    ? Math.round((props.kpis.active_clients / props.kpis.total_clients) * 100)
    : 0,
);
</script>

<template>
  <!-- Módulo Clientes -->
  <div class="ub-rise rounded-2xl border border-line bg-card p-5">
    <div class="mb-4 flex items-center justify-between">
      <div>
        <h3 class="text-base font-semibold text-ink">Clientes</h3>
      </div>
      <p class="text-2xl font-semibold leading-none text-ink">
        {{ kpis.active_clients }}
      </p>
    </div>
    <div class="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-ink/5">
      <div
        class="h-full rounded-full bg-info"
        :style="{ width: `${ratioActiveClients}%` }"
      />
    </div>
    <div
      class="mt-2 flex items-center gap-2 text-xs font-black text-ink/50"
    >
      <span class="text-info/80"
        >{{ ratioActiveClients }}% activos</span
      >
      <span>de {{ kpis.total_clients }} totales</span>
    </div>
    <div class="mt-4 grid grid-cols-2 gap-3">
      <div
        class="rounded-xl border border-ink/[0.05] bg-ink/[0.02] p-3 text-center"
      >
        <p class="text-lg font-semibold text-ink">
          {{ kpis.new_clients }}
        </p>
        <p class="text-xs font-black uppercase text-ink/45">Nuevos</p>
      </div>
      <div
        class="rounded-xl border border-ink/[0.05] bg-ink/[0.02] p-3 text-center"
      >
        <p class="text-lg font-semibold text-ink">
          {{ kpis.retention_rate.toFixed(1) }}%
        </p>
        <p class="text-xs font-black uppercase text-ink/45">Retención</p>
      </div>
    </div>
  </div>

  <!-- Módulo Inventario: el dashboard ya entrega este indicador agregado. -->
  <div class="ub-rise rounded-2xl border border-line bg-card p-5">
    <div class="mb-4 flex items-center justify-between">
      <div>
        <h3 class="text-base font-semibold text-ink">Inventario</h3>
      </div>
      <span
        class="rounded-full border px-2 py-1 text-xs font-black uppercase"
        :class="
          kpis.low_stock_count > 0
            ? 'border-warning/25 bg-warning/[0.06] text-warning'
            : 'border-success/25 bg-success/[0.06] text-success'
        "
        >{{ kpis.low_stock_count > 0 ? "Atención" : "Estable" }}</span
      >
    </div>
    <div
      class="flex items-end justify-between gap-4 rounded-xl border border-ink/[0.05] bg-ink/[0.02] p-4"
    >
      <div>
        <p
          class="text-3xl font-black"
          :class="
            kpis.low_stock_count > 0
              ? 'text-warning'
              : 'text-success'
          "
        >
          {{ kpis.low_stock_count }}
        </p>
        <p
          class="mt-1 text-xs font-black uppercase tracking-widest text-ink/45"
        >
          productos con stock bajo
        </p>
      </div>
      <svg
        class="h-9 w-9 shrink-0"
        :class="
          kpis.low_stock_count > 0
            ? 'text-warning'
            : 'text-success'
        "
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        stroke-width="1.5"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4M4 6v12a2 2 0 0 0 2 2h14v-4M18 12a2 2 0 0 0-2 2c0 1.1.9 2 2 2h4v-4h-4z"
        />
      </svg>
    </div>
    <p class="mt-3 text-xs leading-relaxed text-ink/50">
      Indicador agregado; el detalle de productos permanece fuera de este
      rol.
    </p>
  </div>
</template>
