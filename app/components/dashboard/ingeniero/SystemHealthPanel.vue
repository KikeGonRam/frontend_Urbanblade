<script setup lang="ts">
import type { EngineerSystemHealth } from "~/composables/useEngineerSystemStatus";
import type { SystemStatusSummary } from "~/types/dashboard";

defineProps<{
  status: SystemStatusSummary | null | undefined;
  health: EngineerSystemHealth;
}>();
</script>

<template>
  <section
    class="overflow-hidden rounded-2xl border border-ink/[0.08] bg-card p-5 sm:p-6"
    aria-label="Resumen técnico"
  >
    <div
      class="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between"
    >
      <div class="flex items-start gap-3">
        <span
          class="mt-1 h-3 w-3 shrink-0 rounded-full"
          :class="health.dot"
        />
        <div>
          <p
            class="text-xs font-black uppercase tracking-[0.2em] text-ink/45"
          >
            Centro de observabilidad
          </p>
          <h2 class="mt-1 text-xl font-black text-ink">
            Infraestructura
            <span :class="health.tone">{{ health.label }}</span>
          </h2>
          <p class="mt-1 text-sm text-muted">{{ health.detail }}</p>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div
          class="rounded-xl border border-ink/[0.06] bg-ink/[0.03] px-3 py-2"
        >
          <p
            class="text-xs font-medium text-muted"
          >
            MongoDB
          </p>
          <p
            class="mt-1 text-sm font-black"
            :class="
              status?.database.status === 'down'
                ? 'text-danger'
                : 'text-success'
            "
          >
            {{ status?.database.latency_ms ?? "—"
            }}<small
              v-if="status?.database.latency_ms !== null"
              class="ml-0.5 text-xs"
              >ms</small
            >
          </p>
        </div>
        <div
          class="rounded-xl border border-ink/[0.06] bg-ink/[0.03] px-3 py-2"
        >
          <p
            class="text-xs font-medium text-muted"
          >
            Redis
          </p>
          <p
            class="mt-1 text-sm font-black"
            :class="
              status?.redis.status === 'down'
                ? 'text-danger'
                : 'text-success'
            "
          >
            {{ status?.redis.latency_ms ?? "—"
            }}<small
              v-if="status?.redis.latency_ms !== null"
              class="ml-0.5 text-xs"
              >ms</small
            >
          </p>
        </div>
        <div
          class="rounded-xl border border-ink/[0.06] bg-ink/[0.03] px-3 py-2"
        >
          <p
            class="text-xs font-medium text-muted"
          >
            En cola
          </p>
          <p class="mt-1 text-sm font-black text-ink">
            {{ status?.queue.pending ?? "—" }}
          </p>
        </div>
        <NuxtLink
          to="/system"
          class="rounded-xl border border-gold/20 bg-gold/[0.06] px-3 py-2 transition hover:border-gold/50 hover:bg-gold/[0.1] focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-2"
          ><p
            class="text-xs font-black uppercase tracking-widest text-gold/70"
          >
            Detalle
          </p>
          <p class="mt-1 text-sm font-black text-gold">Monitor →</p></NuxtLink
        >
      </div>
    </div>
  </section>
</template>
