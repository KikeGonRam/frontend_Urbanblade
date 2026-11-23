<script setup lang="ts">
import { AI_STATUS_STYLE, useAdminPredictions } from "~/composables/useAdminPredictions";

const { incomeForecast, appointmentForecast, aiConfidence, aiInsights, failed } = useAdminPredictions();

// Sin estimación (historial corto): se dice en una línea en vez de dejar dos «—» sin explicación.
const sinEstimacion = computed(() => !failed.value && incomeForecast.value === "—" && appointmentForecast.value === "—");
</script>

<template>
  <div
    class="rounded-2xl border border-ink/[0.06] bg-card p-5 lg:col-span-5"
  >
    <div class="mb-5">
      <p
        class="text-sm text-muted"
      >
        Próximos 7 días
      </p>
      <h3
        class="mt-0.5 flex items-center gap-2 text-base font-semibold text-ink"
      >
        Predicciones IA
        <span
          class="rounded-full border border-gold/30 bg-gold/10 px-1.5 py-0.5 text-xs font-black uppercase tracking-widest text-gold"
          >Beta</span
        >
      </h3>
    </div>

    <div class="mb-5 grid grid-cols-3 gap-3">
      <div
        class="rounded-[8px] border border-ink/[0.05] bg-ink/[0.02] p-3 text-center"
      >
        <p
          class="mb-1 text-xs font-medium text-muted"
        >
          Ingresos estimados
        </p>
        <p class="text-lg font-semibold tabular-nums text-ink">
          <span
            v-if="incomeForecast === null"
            class="inline-block h-1 w-8 animate-pulse rounded bg-success/25"
          />
          <template v-else>{{ incomeForecast }}</template>
        </p>
      </div>
      <div
        class="rounded-[8px] border border-ink/[0.05] bg-ink/[0.02] p-3 text-center"
      >
        <p
          class="mb-1 text-xs font-medium text-muted"
        >
          Citas estimadas
        </p>
        <p class="text-lg font-semibold tabular-nums text-ink">
          <span
            v-if="appointmentForecast === null"
            class="inline-block h-1 w-8 animate-pulse rounded bg-info/25"
          />
          <template v-else>{{ appointmentForecast }}</template>
        </p>
      </div>
      <div
        class="rounded-[8px] border border-ink/[0.05] bg-ink/[0.02] p-3 text-center"
      >
        <p
          class="mb-1 text-xs font-medium text-muted"
        >
          Confianza
        </p>
        <!-- Valor cualitativo: en texto más pequeño para que «Por validar» no se parta en dos líneas grandes. -->
        <p class="flex min-h-7 items-center justify-center text-sm font-semibold text-ink">
          <span
            v-if="aiConfidence === null"
            class="inline-block h-1 w-8 animate-pulse rounded bg-gold/25"
          />
          <template v-else>{{ aiConfidence }}</template>
        </p>
      </div>
    </div>

    <p v-if="failed" role="alert" class="-mt-2 mb-5 text-xs text-danger">
      No se pudieron cargar las predicciones. Revisa tu conexión y vuelve a abrir el panel.
    </p>
    <p v-else-if="sinEstimacion" class="-mt-2 mb-5 text-xs text-muted">
      Todavía no hay historial suficiente para estimar la semana.
    </p>

    <div>
      <p
        class="mb-2 text-sm font-medium text-muted"
      >
        Hallazgos
      </p>
      <div class="space-y-2">
        <div
          v-if="aiInsights === null"
          class="flex animate-pulse items-start gap-2 rounded-xl border border-ink/[0.05] bg-ink/[0.02] p-3"
        >
          <div
            class="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-warning"
          />
          <p class="text-xs text-muted">Cargando análisis…</p>
        </div>
        <p
          v-else-if="!aiInsights.length"
          class="text-xs text-muted"
        >
          Todavía no hay hallazgos para esta semana.
        </p>
        <div
          v-for="insight in aiInsights ?? []"
          :key="`${insight.status}-${insight.message}`"
          class="flex items-start gap-2 rounded-xl border p-3"
          :class="
            (AI_STATUS_STYLE[insight.status] ?? AI_STATUS_STYLE.neutral)
              .cls
          "
        >
          <div
            class="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
            :class="
              (
                AI_STATUS_STYLE[insight.status] ??
                AI_STATUS_STYLE.neutral
              ).dot
            "
          />
          <p class="text-sm text-muted">{{ insight.message }}</p>
        </div>
      </div>
    </div>
  </div>
</template>
