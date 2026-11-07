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
    /** Si se indica, el pie estándar envía ese formulario (Guardar + Cancelar). */
    formId?: string;
    submitLabel?: string;
    /** Ícono del recuadro dorado de la cabecera (nombre de UiIcon). */
    icon?: string;
    /** Línea de apoyo bajo el título. */
    subtitle?: string;
    /** 0–100: muestra el anillo de avance en la cabecera. */
    progress?: number | null;
    /** Texto de ayuda a la izquierda del pie. */
    hint?: string;
  }>(),
  { kicker: "", badge: "", busy: false, formId: "", submitLabel: "Guardar", icon: "", subtitle: "", progress: null, hint: "" },
);
const emit = defineEmits<{ close: [] }>();

const dialog = ref<HTMLDialogElement | null>(null);
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
  const last = focusable.at(-1)!;
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
  dialog.value?.showModal();
  await nextTick();
  // Primer campo del formulario, no el botón de cerrar.
  (
    panel.value?.querySelector<HTMLElement>(
      "input:not([disabled]), select:not([disabled]), textarea:not([disabled])",
    ) ?? panel.value?.querySelector<HTMLElement>(focusableSelector)
  )?.focus();
});
onBeforeUnmount(() => {
  dialog.value?.close();
  previous?.focus();
});
</script>

<template>
  <Teleport to="body">
    <dialog
      ref="dialog"
      class="ub-sheet"
      :aria-labelledby="titleId"
      @cancel.prevent="close"
      @keydown="onKeydown"
      @click="$event.target === dialog && close()"
    >
      <div ref="panel" class="ub-sheet__panel ub-sheet__panel--flex">
        <header class="ub-sheet__head">
          <span v-if="icon" class="ub-sheet__tile"><UiIcon :name="icon" /></span>
          <div class="min-w-0 flex-1">
            <p v-if="kicker" class="ub-form-kicker">{{ kicker }}</p>
            <h2 :id="titleId" class="mt-1 text-2xl font-black text-ink">
              {{ title }}
            </h2>
            <p v-if="subtitle" class="mt-1 ub-form-help">{{ subtitle }}</p>
            <slot name="subtitle" />
          </div>
          <div class="flex shrink-0 items-center gap-2">
            <span
              v-if="progress !== null"
              class="ub-ring"
              role="img"
              :aria-label="`Avance del formulario: ${progress}%`"
            >
              <svg viewBox="0 0 46 46" aria-hidden="true">
                <circle class="ub-ring__bg" cx="23" cy="23" r="19" />
                <circle
                  class="ub-ring__fg"
                  cx="23"
                  cy="23"
                  r="19"
                  stroke-dasharray="119.4"
                  :stroke-dashoffset="119.4 * (1 - progress / 100)"
                />
              </svg>
              <span aria-hidden="true">{{ progress }}%</span>
            </span>
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

        <footer v-if="$slots.footer || formId" class="ub-sheet__foot">
          <slot name="footer">
            <span v-if="hint" class="ub-sheet__hint">
              <span class="ub-sheet__dot" aria-hidden="true" />
              <span class="min-w-0 truncate">{{ hint }}</span>
              <kbd>Esc</kbd>
            </span>
            <button
              type="submit"
              :form="formId"
              :disabled="busy"
              class="ui-btn min-h-11 flex-1 px-4"
            >
              {{ busy ? "Guardando…" : submitLabel }}
            </button>
            <button
              type="button"
              :disabled="busy"
              class="ui-btn-secondary min-h-11 px-4"
              @click="close"
            >
              Cancelar
            </button>
          </slot>
        </footer>
      </div>
    </dialog>
  </Teleport>
</template>
