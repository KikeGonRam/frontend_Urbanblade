<script setup lang="ts">
withDefaults(defineProps<{ label: string, color?: string, todayLabel: string }>(), {
  color: 'text-gold',
})
</script>

<template>
  <header class="dashboard-header flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
    <div>
      <h1 class="text-xl font-black uppercase tracking-tight text-ink sm:text-2xl">
        Panel <span :class="color">{{ label }}</span>
      </h1>
      <p class="mt-0.5 text-xs font-bold uppercase tracking-wider text-ink/50">
        {{ todayLabel }}
      </p>
    </div>
    <div class="flex flex-wrap items-center gap-2">
      <slot />
    </div>
  </header>
</template>
