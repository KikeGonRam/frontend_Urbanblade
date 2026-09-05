<script setup lang="ts">
defineProps<{ paths: string }>()
</script>

<template>
  <!-- eslint-disable vue/no-v-html -- `paths` viene de ICONS en
       useNavigation.ts (literales de código propio), nunca de input de
       usuario ni de la API. -->
  <svg
    class="h-5 w-5 shrink-0"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.5"
    v-html="paths"
  />
  <!-- eslint-enable vue/no-v-html -->
</template>
