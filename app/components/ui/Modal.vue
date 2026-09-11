<script setup lang="ts">
const props = withDefaults(defineProps<{ title: string, busy?: boolean }>(), { busy: false })
const emit = defineEmits<{ close: [] }>()
const dialog = ref<HTMLDialogElement | null>(null)
let previous: HTMLElement | null = null
onMounted(() => {
  previous = document.activeElement as HTMLElement | null
  dialog.value?.showModal()
})
onBeforeUnmount(() => { dialog.value?.close(); previous?.focus() })
function close() { if (!props.busy) emit('close') }
</script>

<template>
  <Teleport to="body">
    <dialog ref="dialog" :aria-label="title" class="ui-modal rounded-2xl border border-line bg-card p-0 text-ink shadow-2xl" @cancel.prevent="close" @click="($event.target === dialog) && close()">
      <div class="p-4 sm:p-6">
        <header class="mb-4 flex items-center justify-between gap-4">
          <h2 class="text-lg font-bold">{{ title }}</h2>
          <button type="button" class="ui-btn-secondary min-h-11 px-3" :disabled="busy" aria-label="Cerrar ventana" @click="close">Cerrar</button>
        </header>
        <slot />
      </div>
    </dialog>
  </Teleport>
</template>

<style scoped>
.ui-modal { width: min(56rem, calc(100vw - 2rem)); max-height: calc(100dvh - 2rem); overflow-y: auto; overscroll-behavior: contain; }
.ui-modal::backdrop { background: rgb(0 0 0 / .7); backdrop-filter: blur(4px); }
</style>
