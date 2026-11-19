<script setup lang="ts">
defineProps<{
  name: string;
  /** Vista previa local (aún sin guardar); tiene prioridad sobre la foto guardada. */
  preview: string | null;
  url: string | null | undefined;
}>();
</script>

<template>
  <div class="shrink-0">
    <img
      v-if="preview || url"
      :src="preview || url || ''"
      :alt="`Foto de ${name}`"
      class="h-20 w-20 rounded-2xl border-2 border-gold/35 object-cover shadow-xl shadow-black/20"
    >
    <div
      v-else
      class="flex h-20 w-20 items-center justify-center rounded-2xl bg-gold/15 text-xl font-black text-gold"
    >
      {{ name.slice(0, 2).toUpperCase() }}
    </div>
  </div>
</template>
