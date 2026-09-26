<script setup lang="ts" generic="T extends string">
/*
 * Elegir una opción entre 2–4 como tarjetas (método de pago, cuándo pagar). Ver skill
 * urbanblade-ui-kit. Solo presentación: el v-model sigue siendo el mismo string que ya se
 * mandaba al backend ("efectivo", "transferencia", "tarjeta", "despues"…).
 */
import type { ChoiceOption } from "~/types/choice";

const props = withDefaults(
  defineProps<{
    options: ChoiceOption<T>[];
    label: string;
    /** Oculta el título del grupo (queda como aria-label). */
    hideLabel?: boolean;
    columns?: 1 | 2 | 3 | 4;
  }>(),
  { hideLabel: false, columns: 3 },
);

const selected = defineModel<T>({ required: true });
const groupId = useId();
const buttons = ref<HTMLButtonElement[]>([]);

// Íconos de trazo (24x24, estilo Heroicons outline).
const ICONS: Record<NonNullable<ChoiceOption<T>["icon"]>, string[]> = {
  efectivo: [
    "M2.25 18.75a60.07 60.07 0 0115.8 2.1c.73.2 1.45-.34 1.45-1.1V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.38c0-.62.5-1.12 1.13-1.12H20.25M2.25 6v9m18-10.5v.75c0 .41.34.75.75.75h.75m-1.5-1.5h.38c.62 0 1.12.5 1.12 1.13v9.74c0 .63-.5 1.13-1.13 1.13h-.37m1.5-1.5h-.75a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.38a1.13 1.13 0 01-1.12-1.13V15m1.5 1.5v-.75A.75.75 0 003 15h-.75",
    "M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.01v.01H18v-.01zm-12 0h.01v.01H6v-.01z",
  ],
  transferencia: [
    "M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.33A48.36 48.36 0 0012 9.75c-2.55 0-5.06.2-7.5.58V21M3 21h18M12 6.75h.01v.01H12V6.75z",
  ],
  tarjeta: [
    "M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z",
  ],
  salon: [
    "M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.35m-16.5 11.65V9.35m0 0a3 3 0 003.75-.62 3 3 0 004.5 0 3 3 0 004.5 0 3 3 0 003.75.62m-16.5 0a3 3 0 01-.62-4.72L4.2 3.44A1.5 1.5 0 015.26 3h13.48a1.5 1.5 0 011.06.44l1.19 1.19a3 3 0 01-.62 4.72M6.75 18h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .41.34.75.75.75z",
  ],
};

const gridClass = computed(
  () =>
    ({
      1: "grid-cols-1",
      2: "grid-cols-1 sm:grid-cols-2",
      3: "grid-cols-1 sm:grid-cols-3",
      4: "grid-cols-2 sm:grid-cols-4",
    })[props.columns],
);

const enabled = computed(() => props.options.filter((o) => !o.disabled));

// Flechas mueven la selección dentro del grupo, como un radio nativo.
function onKeydown(event: KeyboardEvent, index: number) {
  const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
  if (!step || enabled.value.length === 0) return;
  event.preventDefault();
  const current = enabled.value.findIndex((o) => o.value === props.options[index]?.value);
  const next = enabled.value[(current + step + enabled.value.length) % enabled.value.length];
  if (!next) return;
  selected.value = next.value;
  nextTick(() => buttons.value[props.options.indexOf(next)]?.focus());
}
</script>

<template>
  <div>
    <p v-if="!hideLabel" :id="groupId" class="mb-2 text-xs font-bold text-ink">{{ label }}</p>
    <div
      role="radiogroup"
      :aria-labelledby="hideLabel ? undefined : groupId"
      :aria-label="hideLabel ? label : undefined"
      class="grid gap-2"
      :class="gridClass"
    >
      <button
        v-for="(option, index) in options"
        :key="option.value"
        ref="buttons"
        type="button"
        role="radio"
        :aria-checked="selected === option.value"
        :tabindex="selected === option.value || (!options.some((o) => o.value === selected) && index === 0) ? 0 : -1"
        :disabled="option.disabled"
        class="ub-choice"
        :class="{ 'is-selected': selected === option.value }"
        @click="selected = option.value"
        @keydown="onKeydown($event, index)"
      >
        <span v-if="option.icon" class="ub-choice__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5">
            <path v-for="(d, i) in ICONS[option.icon]" :key="i" :d="d" />
          </svg>
        </span>
        <span class="min-w-0 flex-1 text-left">
          <span class="block text-sm font-bold">{{ option.title }}</span>
          <span v-if="option.detail" class="mt-0.5 block text-xs font-normal text-muted">{{ option.detail }}</span>
        </span>
        <span class="ub-choice__check" aria-hidden="true">
          <svg v-if="selected === option.value" viewBox="0 0 20 20" fill="currentColor" class="h-3.5 w-3.5">
            <path fill-rule="evenodd" d="M16.7 5.3a1 1 0 010 1.4l-8 8a1 1 0 01-1.4 0l-4-4a1 1 0 011.4-1.4L8 12.58l7.3-7.3a1 1 0 011.4 0z" clip-rule="evenodd" />
          </svg>
        </span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.ub-choice {
  display: flex;
  min-height: 3.5rem;
  align-items: center;
  gap: 0.75rem;
  border-radius: 0.75rem;
  border: 1px solid var(--line);
  background: var(--bg-card);
  padding: 0.75rem 0.875rem;
  color: var(--ink);
  transition: border-color 0.15s ease, background-color 0.15s ease;
}
.ub-choice:hover:not(:disabled) {
  border-color: rgb(var(--gold-rgb) / 0.45);
}
.ub-choice:focus-visible {
  outline: 2px solid var(--gold);
  outline-offset: 2px;
}
.ub-choice:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}
.ub-choice.is-selected {
  border-color: var(--gold);
  background: rgb(var(--gold-rgb) / 0.1);
  box-shadow: inset 0 0 0 1px var(--gold);
}
.ub-choice__icon {
  display: inline-flex;
  height: 2.25rem;
  width: 2.25rem;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 0.625rem;
  background: var(--bg-accent);
  color: var(--gold);
}
.ub-choice.is-selected .ub-choice__icon {
  background: rgb(var(--gold-rgb) / 0.18);
}
.ub-choice__check {
  display: inline-flex;
  height: 1.25rem;
  width: 1.25rem;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  border: 1.5px solid var(--line);
}
.ub-choice.is-selected .ub-choice__check {
  border-color: var(--gold);
  background: var(--gold);
  color: var(--bg-main);
}
@media (prefers-reduced-motion: reduce) {
  .ub-choice {
    transition: none;
  }
}
</style>
