<script setup lang="ts">
const props = withDefaults(
  defineProps<{ title: string; busy?: boolean; size?: "sm" | "md" | "lg" }>(),
  { busy: false, size: "lg" },
);
const emit = defineEmits<{ close: [] }>();
const dialog = ref<HTMLDialogElement | null>(null);
// Un id por instancia: con una ventana abierta sobre otra, un id fijo repetido rompía aria-labelledby.
const titleId = useId();
let previous: HTMLElement | null = null;
const focusableSelector =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function trapFocus(event: KeyboardEvent) {
  if (event.key !== "Tab" || !dialog.value) return;
  const focusable = [
    ...dialog.value.querySelectorAll<HTMLElement>(focusableSelector),
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
  dialog.value?.showModal();
  await nextTick();
  dialog.value?.querySelector<HTMLElement>(focusableSelector)?.focus();
});
onBeforeUnmount(() => {
  dialog.value?.close();
  previous?.focus();
});
function close() {
  if (!props.busy) emit("close");
}
</script>

<template>
  <Teleport to="body">
    <dialog
      ref="dialog"
      :class="['ui-modal', `ui-modal--${size}`]"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="titleId"
      @cancel.prevent="close"
      @keydown="trapFocus"
      @click="$event.target === dialog && close()"
    >
      <div class="p-4 sm:p-6">
        <header class="mb-4 flex items-center justify-between gap-4">
          <h2 :id="titleId" class="text-lg font-bold">{{ title }}</h2>
          <button
            type="button"
            class="ui-btn-secondary min-h-11 px-3"
            :disabled="busy"
            aria-label="Cerrar ventana"
            @click="close"
          >
            Cerrar
          </button>
        </header>
        <slot />
      </div>
    </dialog>
  </Teleport>
</template>

<style scoped>
.ui-modal {
  width: min(56rem, calc(100vw - 2rem));
}
.ui-modal--md {
  width: min(28rem, calc(100vw - 2rem));
}
.ui-modal--sm {
  width: min(24rem, calc(100vw - 2rem));
}
</style>
