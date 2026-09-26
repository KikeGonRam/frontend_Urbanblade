<script setup lang="ts">
/*
 * Interruptor de encendido/apagado del kit (ver skill urbanblade-ui-kit). Solo cambia cómo se
 * ve: quien lo usa sigue mandando al backend exactamente el mismo valor que con la casilla.
 */
withDefaults(
  defineProps<{
    label: string;
    description?: string | null;
    disabled?: boolean;
    /** Oculta la etiqueta (queda como aria-label), p. ej. dentro de una tabla. */
    hideLabel?: boolean;
  }>(),
  { description: null, disabled: false, hideLabel: false },
);

const checked = defineModel<boolean>({ default: false });
const id = useId();

function toggle() {
  checked.value = !checked.value;
}
</script>

<template>
  <div class="flex items-center justify-between gap-4" :class="disabled ? 'opacity-60' : ''">
    <div v-if="!hideLabel" class="min-w-0">
      <label :for="id" class="block text-sm font-semibold text-ink" :class="disabled ? '' : 'cursor-pointer'">
        {{ label }}
      </label>
      <p v-if="description" :id="`${id}-desc`" class="mt-0.5 text-xs text-muted">{{ description }}</p>
    </div>
    <button
      :id="id"
      type="button"
      role="switch"
      :aria-checked="checked"
      :aria-label="hideLabel ? label : undefined"
      :aria-describedby="description && !hideLabel ? `${id}-desc` : undefined"
      :disabled="disabled"
      class="ub-switch"
      :class="{ 'is-on': checked }"
      @click="toggle"
    >
      <span class="ub-switch__thumb" aria-hidden="true" />
    </button>
  </div>
</template>

<style scoped>
.ub-switch {
  position: relative;
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  width: 2.75rem;
  height: 1.5rem;
  border-radius: 9999px;
  border: 1px solid var(--line);
  background: var(--bg-accent);
  transition: background-color 0.2s ease, border-color 0.2s ease;
  /* Área táctil de 44 px sin agrandar la pista. */
  outline-offset: 3px;
}
.ub-switch::before {
  content: "";
  position: absolute;
  inset: -0.625rem -0.25rem;
}
.ub-switch:focus-visible {
  outline: 2px solid var(--gold);
}
.ub-switch.is-on {
  background: var(--gold);
  border-color: var(--gold);
}
.ub-switch:disabled {
  cursor: not-allowed;
}
.ub-switch__thumb {
  width: 1.125rem;
  height: 1.125rem;
  margin-left: 0.1875rem;
  border-radius: 9999px;
  background: var(--muted);
  box-shadow: 0 1px 3px rgb(0 0 0 / 0.35);
  transition: transform 0.2s ease, background-color 0.2s ease;
}
.ub-switch.is-on .ub-switch__thumb {
  transform: translateX(1.25rem);
  background: var(--bg-card);
}
@media (prefers-reduced-motion: reduce) {
  .ub-switch,
  .ub-switch__thumb {
    transition: none;
  }
}
</style>
