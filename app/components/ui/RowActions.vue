<script setup lang="ts">
/*
 * Acciones de una fila como botones de ícono (editar, eliminar…): mismo tamaño y orden en todas las
 * listas. Cada botón lleva su nombre accesible; en escritorio se atenúan hasta pasar el cursor o
 * enfocar la fila (ver .ub-actions en main.css) y en pantallas táctiles siempre se ven.
 */
export interface RowAction {
  key: string;
  label: string;
  icon: string;
  danger?: boolean;
  hidden?: boolean;
  disabled?: boolean;
}

defineProps<{ actions: RowAction[] }>();
const emit = defineEmits<{ action: [key: string] }>();
</script>

<template>
  <fieldset class="ub-actions m-0 min-w-0 border-0 p-0">
    <legend class="sr-only">Acciones</legend>
    <template v-for="a in actions" :key="a.key">
      <button
        v-if="!a.hidden"
        type="button"
        class="ub-iconbtn"
        :class="{ 'ub-iconbtn--danger': a.danger }"
        :aria-label="a.label"
        :title="a.label"
        :disabled="a.disabled"
        @click="emit('action', a.key)"
      >
        <UiIcon :name="a.icon" />
      </button>
    </template>
  </fieldset>
</template>
