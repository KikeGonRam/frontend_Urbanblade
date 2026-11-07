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
  /** Ícono (UiIcon) a la izquierda del control. */
  icon?: string;
  /** Alinea el ícono arriba (para textarea). */
  top?: boolean;
}>();
</script>

<template>
  <div>
    <label :for="fieldId" class="ub-form-label">{{ label }}</label>
    <div class="ub-in" :class="{ 'ub-in--icon': icon, 'ub-in--top': top }">
      <UiIcon v-if="icon" :name="icon" class="ub-in__icon" />
      <slot />
    </div>
    <p v-if="hint && !error" class="mt-1 ub-form-help">{{ hint }}</p>
    <p v-if="error" :id="`${fieldId}-error`" class="mt-1 text-xs text-danger">
      {{ error }}
    </p>
  </div>
</template>
