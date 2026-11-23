<script setup lang="ts">
defineProps<{ pendingCount: number; anuladosCount?: number; isAdmin?: boolean }>();
defineEmits<{ "new-charge": [] }>();
</script>

<template>
  <header
    class="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
  >
    <div>
      <h1 class="mt-1 text-2xl font-semibold text-ink">
        Centro de <span class="text-gold">Facturación</span>
      </h1>
      <p class="mt-1 text-sm text-muted">
        Gestión de ingresos, comprobantes y trazabilidad financiera.
      </p>
    </div>
    <div class="flex flex-wrap items-center gap-3">
      <NuxtLink
        to="/payments/pending"
        class="relative rounded-lg border border-line px-4 py-2 text-sm text-muted hover:text-ink"
      >
        Por Revisar
        <span
          v-if="pendingCount > 0"
          class="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-gold px-1 text-xs font-black text-black"
          >{{ pendingCount }}</span
        >
      </NuxtLink>
      <NuxtLink
        v-if="isAdmin"
        to="/payments/anulados"
        class="flex items-center rounded-lg border border-line px-4 py-2 text-sm text-muted transition-colors hover:border-gold/40 hover:text-ink"
      >
        Cobros anulados
        <span
          v-if="anuladosCount"
          class="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-line px-1 text-xs font-black text-muted"
          >{{ anuladosCount }}</span
        >
      </NuxtLink>
      <NuxtLink
        to="/payments/corte"
        class="flex items-center rounded-lg border border-line px-4 py-2 text-sm font-semibold text-muted transition-colors hover:border-gold/40 hover:text-gold"
      >
        Corte de caja
      </NuxtLink>
      <button
        type="button"
        class="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-black hover:bg-gold-dim"
        @click="$emit('new-charge')"
      >
        + Nuevo Cobro
      </button>
    </div>
  </header>
</template>
