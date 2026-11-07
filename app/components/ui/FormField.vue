<script setup lang="ts">
/*
 * Etiqueta + control + ayuda + error de un campo de formulario. El control va
 * en el slot y debe llevar el mismo `id` que `fieldId`; el error se anuncia con
 * `${fieldId}-error` (aria-describedby del control).
 */
defineProps<{
  fieldId: string;
  label: string;
  error?: string | null;
  hint?: string;
}>();
</script>

<template>
  <div>
    <label :for="fieldId" class="ub-form-label">{{ label }}</label>
    <slot />
    <p v-if="hint && !error" class="mt-1 ub-form-help">{{ hint }}</p>
    <p v-if="error" :id="`${fieldId}-error`" class="mt-1 text-xs text-danger">
      {{ error }}
    </p>
  </div>
</template>
