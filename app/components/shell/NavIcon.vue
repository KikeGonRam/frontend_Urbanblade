<script setup lang="ts">
defineProps<{ paths: string }>()
</script>

<template>
  <svg
    class="h-5 w-5 shrink-0"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.5"
    v-html="paths"
  />
</template>
