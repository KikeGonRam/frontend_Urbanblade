<script setup lang="ts">
defineProps<{
  /** Hay una foto elegida pendiente de guardar. */
  hasSelection: boolean;
  uploading: boolean;
}>();
const emit = defineEmits<{
  select: [event: Event];
  upload: [];
}>();
</script>

<template>
  <div class="mt-4 flex flex-wrap gap-2">
    <label class="ui-btn-secondary cursor-pointer px-3 py-2 text-xs">
      Cambiar foto
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        class="sr-only"
        @change="emit('select', $event)"
      >
    </label>
    <button
      v-if="hasSelection"
      type="button"
      class="ui-btn px-3 py-2 text-xs"
      :disabled="uploading"
      @click="emit('upload')"
    >
      {{ uploading ? "Subiendo…" : "Guardar foto" }}
    </button>
  </div>
</template>
