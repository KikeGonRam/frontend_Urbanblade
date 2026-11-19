<script setup lang="ts">
import type { ChatbotTelemetry } from "~/types/dashboard";

defineProps<{ telemetry: ChatbotTelemetry }>();
</script>

<template>
  <div
    class="rounded-2xl border border-ink/[0.06] bg-card p-5 lg:col-span-7"
  >
    <div class="mb-5 flex items-center justify-between">
      <div>
        <p
          class="text-sm text-muted"
        >
          Últimos {{ telemetry.window_days ?? 7 }} días
        </p>
        <h3
          class="mt-0.5 flex items-center gap-2 text-base font-semibold text-ink"
        >
          Uso de Bladebot
          <span
            class="flex items-center gap-1 text-xs font-black uppercase text-success"
          >
            <span
              class="h-1.5 w-1.5 animate-pulse rounded-full bg-success"
            />OK
          </span>
        </h3>
      </div>
    </div>

    <div class="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div
        class="rounded-[8px] border border-ink/[0.05] bg-ink/[0.02] p-3"
      >
        <p
          class="mb-1 text-xs font-medium text-muted"
        >
          Consultas
        </p>
        <p class="text-lg font-semibold tabular-nums text-ink">
          {{ telemetry.total_requests ?? 0 }}
        </p>
      </div>
      <div
        class="rounded-[8px] border border-ink/[0.05] bg-ink/[0.02] p-3"
      >
        <p
          class="mb-1 text-xs font-medium text-muted"
        >
          Con error
        </p>
        <p
          class="text-lg font-semibold tabular-nums"
          :class="(telemetry.error_rate_pct ?? 0) > 5 ? 'text-danger' : 'text-ink'"
        >
          {{ (telemetry.error_rate_pct ?? 0).toFixed(1) }}%
        </p>
      </div>
      <div
        class="rounded-[8px] border border-ink/[0.05] bg-ink/[0.02] p-3"
      >
        <p
          class="mb-1 text-xs font-medium text-muted"
        >
          Respuesta promedio
        </p>
        <p class="text-lg font-semibold tabular-nums text-ink">
          {{ ((telemetry.avg_latency_ms ?? 0) / 1000).toFixed(1) }} s
        </p>
      </div>
      <div
        class="rounded-[8px] border border-ink/[0.05] bg-ink/[0.02] p-3"
      >
        <p
          class="mb-1 text-xs font-medium text-muted"
        >
          Costo estimado
        </p>
        <p class="text-lg font-semibold tabular-nums text-ink">
          ${{
            (telemetry.estimated_cost_usd ?? 0).toFixed(4)
          }}
        </p>
      </div>
    </div>

    <div
      v-if="
        telemetry.top_sources &&
        Object.keys(telemetry.top_sources).length
      "
    >
      <p
        class="mb-2 text-sm font-medium text-muted"
      >
        Quién respondió
      </p>
      <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div
          v-for="(count, source) in telemetry.top_sources"
          :key="source"
          class="flex items-center justify-between rounded-xl border border-ink/[0.05] bg-ink/[0.02] px-3 py-2"
        >
          <span
            class="truncate text-xs font-bold uppercase text-ink"
            >{{ String(source).replace(/_/g, " ") }}</span
          >
          <span class="ml-2 shrink-0 text-xs font-black text-gold">{{
            count
          }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
