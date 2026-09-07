<script setup lang="ts">
withDefaults(defineProps<{ label: string, color?: string, todayLabel: string }>(), {
  color: 'text-gold',
})
</script>

<template>
  <header class="dashboard-header flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
    <div>
      <p class="mb-1 text-[9px] font-black uppercase tracking-[0.3em] text-ink/50">
        UrbanBlade · Dashboard
      </p>
      <h2 class="text-xl font-black uppercase tracking-tight text-ink sm:text-2xl">
        Panel <span :class="color">{{ label }}</span>
      </h2>
      <p class="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-ink/50">
        {{ todayLabel }}
      </p>
    </div>
    <div class="flex flex-wrap items-center gap-2">
      <span class="flex min-h-10 items-center gap-1.5 rounded-xl border border-ink/[0.08] bg-ink/[0.03] px-3 py-2 text-[9px] font-black uppercase tracking-widest text-ink/40" aria-live="polite">
        <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
        Sistema Activo
      </span>
      <slot />
    </div>
  </header>
</template>
