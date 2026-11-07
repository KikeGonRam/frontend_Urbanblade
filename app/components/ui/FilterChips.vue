<script setup lang="ts">
/*
 * Filtro rápido como chips (rol, estado, categoría): un toque cambia la lista. El valor vacío ("")
 * es «todos». Es el reemplazo visible de los <select> de filtro y respeta teclado y lector de pantalla
 * (cada chip es un botón con aria-pressed dentro de un fieldset con su leyenda).
 */
export interface FilterOption {
  value: string;
  label: string;
  icon?: string;
}

defineProps<{ options: FilterOption[]; label: string }>();
const model = defineModel<string>({ default: "" });
</script>

<template>
  <fieldset class="ub-filters">
    <legend class="sr-only">{{ label }}</legend>
    <button
      v-for="o in options"
      :key="o.value"
      type="button"
      class="ub-filter"
      :aria-pressed="model === o.value"
      @click="model = o.value"
    >
      <UiIcon v-if="o.icon" :name="o.icon" />
      {{ o.label }}
    </button>
  </fieldset>
</template>
