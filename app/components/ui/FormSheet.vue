<script setup lang="ts">
/*
 * Panel lateral derecho para crear/editar: único contenedor de formularios
 * de entidades (usuarios, servicios, productos…). Los diálogos centrados
 * (UiModal) quedan para acciones cortas y confirmaciones. Pie fijo con las
 * acciones, foco atrapado, Esc cierra y el foco vuelve al botón que lo abrió.
 */
const props = withDefaults(
  defineProps<{
    title: string;
    kicker?: string;
    badge?: string;
    busy?: boolean;
  }>(),
  { kicker: "", badge: "", busy: false },
);
const emit = defineEmits<{ close: [] }>();

const panel = ref<HTMLElement | null>(null);
const titleId = useId();
let previous: HTMLElement | null = null;
const focusableSelector =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function close() {
  if (!props.busy) emit("close");
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    event.stopPropagation();
    close();
    return;
  }
  if (event.key !== "Tab" || !panel.value) return;
  const focusable = [
    ...panel.value.querySelectorAll<HTMLElement>(focusableSelector),
  ];
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

onMounted(async () => {
  previous = document.activeElement as HTMLElement | null;
  await nextTick();
  // Primer campo del formulario, no el botón de cerrar.
  (
    panel.value?.querySelector<HTMLElement>(
      "input:not([disabled]), select:not([disabled]), textarea:not([disabled])",
    ) ?? panel.value?.querySelector<HTMLElement>(focusableSelector)
  )?.focus();
});
onBeforeUnmount(() => previous?.focus());
</script>

<template>
  <Teleport to="body">
    <div class="ub-sheet" @click.self="close">
      <div
        ref="panel"
        class="ub-sheet__panel ub-sheet__panel--flex"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
        @keydown="onKeydown"
      >
        <header class="ub-sheet__head">
          <div class="min-w-0">
            <p v-if="kicker" class="ub-form-kicker">{{ kicker }}</p>
            <h2 :id="titleId" class="mt-1 text-2xl font-black text-ink">
              {{ title }}
            </h2>
            <slot name="subtitle" />
          </div>
          <div class="flex shrink-0 items-center gap-2">
            <span
              v-if="badge"
              class="rounded-full border border-gold/25 bg-gold/10 px-2 py-1 text-xs font-black uppercase tracking-wider text-gold-text"
            >
              {{ badge }}
            </span>
            <button
              type="button"
              class="ui-btn-secondary min-h-11 px-3"
              :disabled="busy"
              aria-label="Cerrar panel"
              @click="close"
            >
              Cerrar
            </button>
          </div>
        </header>

        <div class="ub-sheet__body">
          <slot />
        </div>

        <footer v-if="$slots.footer" class="ub-sheet__foot">
          <slot name="footer" />
        </footer>
      </div>
    </div>
  </Teleport>
</template>
