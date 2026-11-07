<script setup lang="ts">
/*
 * Campo de búsqueda de las listas: ícono de lupa, foco dorado y el mismo alto que el resto de los
 * controles. El v-model es el texto; quien lo usa decide cuándo consultar (con useDebounce).
 */
withDefaults(
  defineProps<{ label?: string; placeholder?: string }>(),
  { label: "Buscar", placeholder: "Buscar…" },
);
const model = defineModel<string>({ default: "" });
</script>

<template>
  <div class="ub-search">
    <UiIcon name="search" class="ub-search__icon" />
    <input
      v-model="model"
      type="search"
      :aria-label="label"
      :placeholder="placeholder"
      autocomplete="off"
      class="ui-input w-full"
    >
  </div>
</template>
