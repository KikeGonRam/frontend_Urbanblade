<script setup lang="ts">
import type { PaymentStats } from "~/types/payments";

defineProps<{ stats: PaymentStats }>();
</script>

<template>
  <section class="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
    <div class="rounded-2xl border border-line bg-card p-4">
      <p
        class="mb-1 text-xs font-black uppercase tracking-wider text-muted"
      >
        Facturación Hoy
      </p>
      <p class="text-2xl font-black text-success">
        {{ formatMoney(stats.total_hoy) }}
      </p>
    </div>
    <div class="rounded-2xl border border-line bg-card p-4">
      <p
        class="mb-1 text-xs font-black uppercase tracking-wider text-muted"
      >
        Este Mes
      </p>
      <p class="text-2xl font-black text-ink">
        {{ formatMoney(stats.total_mes) }}
      </p>
    </div>
    <div class="rounded-2xl border border-line bg-card p-4">
      <p
        class="mb-1 text-xs font-black uppercase tracking-wider text-muted"
      >
        Total Cobros
      </p>
      <p class="text-2xl font-black text-ink">{{ stats.count }}</p>
    </div>
    <div class="rounded-2xl border border-line bg-card p-4">
      <p
        class="mb-2 text-xs font-black uppercase tracking-wider text-muted"
      >
        Por Método
      </p>
      <div class="flex flex-wrap gap-1.5">
        <span
          v-for="(cnt, metodo) in stats.metodos"
          :key="metodo"
          class="rounded-full border border-line bg-ink/5 px-2 py-0.5 text-xs font-black uppercase text-ink/70"
        >
          {{ metodo }}: {{ cnt }}
        </span>
      </div>
    </div>
  </section>
</template>
