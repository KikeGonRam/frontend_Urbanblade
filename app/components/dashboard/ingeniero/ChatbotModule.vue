<script setup lang="ts">
import type { ChatbotTelemetry } from "~/types/dashboard";

defineProps<{ telemetry: ChatbotTelemetry }>();
</script>

<template>
  <!-- Módulo Chatbot -->
  <div class="ub-rise rounded-2xl border border-line bg-card p-5">
    <div class="mb-4">
      <h3 class="text-base font-semibold text-ink">Bladebot</h3>
      <p class="text-xs font-bold text-ink/40">
        Últimos {{ telemetry.window_days ?? 7 }} días
      </p>
    </div>
    <div class="grid grid-cols-2 gap-3">
      <div class="rounded-xl border border-ink/[0.05] bg-ink/[0.02] p-3">
        <p
          class="mb-1 text-xs font-black uppercase tracking-wider text-ink/50"
        >
          Consultas
        </p>
        <p class="text-lg font-semibold text-ink">
          {{ telemetry.total_requests ?? 0 }}
        </p>
      </div>
      <div class="rounded-xl border border-ink/[0.05] bg-ink/[0.02] p-3">
        <p
          class="mb-1 text-xs font-black uppercase tracking-wider text-ink/50"
        >
          Con error
        </p>
        <p class="text-lg font-semibold text-danger">
          {{ (telemetry.error_rate_pct ?? 0).toFixed(1) }}%
        </p>
      </div>
      <div class="rounded-xl border border-ink/[0.05] bg-ink/[0.02] p-3">
        <p
          class="mb-1 text-xs font-black uppercase tracking-wider text-ink/50"
        >
          Respuesta promedio
        </p>
        <p class="text-lg font-semibold text-ink">
          {{ ((telemetry.avg_latency_ms ?? 0) / 1000).toFixed(1) }} s
        </p>
      </div>
      <div class="rounded-xl border border-ink/[0.05] bg-ink/[0.02] p-3">
        <p
          class="mb-1 text-xs font-black uppercase tracking-wider text-ink/50"
        >
          Costo estimado
        </p>
        <p class="text-lg font-semibold text-ink">
          ${{ (telemetry.estimated_cost_usd ?? 0).toFixed(4) }}
        </p>
      </div>
    </div>
  </div>
</template>
