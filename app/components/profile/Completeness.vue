<script setup lang="ts">
const props = defineProps<{
  complete: boolean;
  missing: string[];
}>();

const percent = computed(() =>
  props.complete ? 100 : Math.max(25, 100 - props.missing.length * 20),
);
</script>

<template>
  <div class="relative mt-6 max-w-xl">
    <div
      class="mb-2 flex items-center justify-between text-xs font-bold uppercase tracking-wider text-muted"
    >
      <span>Completitud del perfil</span>
      <span class="text-gold"
        >{{ percent }}%</span
      >
    </div>
    <div class="h-1.5 overflow-hidden rounded-full bg-main">
      <div
        class="h-full rounded-full bg-gold transition-[width] duration-200"
        :style="{ width: `${percent}%` }"
      />
    </div>
    <p v-if="missing.length" class="mt-2 text-xs text-muted">
      Completa: {{ missing.join(", ") }}
    </p>
  </div>
</template>
