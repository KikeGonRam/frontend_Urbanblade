<script setup lang="ts">
const { state, handleConfirm, handleCancel } = useConfirm()
const dialog = ref<HTMLDialogElement | null>(null)
let previous: HTMLElement | null = null

watch(
  () => state.value.isOpen,
  async (isOpen) => {
    if (!import.meta.client) return

    if (isOpen) {
      previous = document.activeElement as HTMLElement | null
      await nextTick()
      if (!dialog.value?.open) dialog.value?.showModal()
      dialog.value?.querySelector<HTMLElement>('button')?.focus()
    } else if (dialog.value?.open) {
      dialog.value.close()
      previous?.focus()
      previous = null
    }
  },
  { flush: 'post' },
)

onBeforeUnmount(() => {
  if (import.meta.client) {
    if (dialog.value?.open) dialog.value.close()
    previous?.focus()
  }
})
</script>

<template>
  <Teleport to="body">
    <dialog
      ref="dialog"
      class="w-[calc(100%-2rem)] max-w-md rounded-2xl border border-line bg-card p-0 text-ink shadow-2xl"
      :aria-label="state.title"
      @cancel.prevent="handleCancel"
      @click="($event.target === dialog) && handleCancel()"
    >
      <div class="p-6">
          <div class="mb-4 flex items-start gap-4">
            <div
              v-if="state.isDanger"
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-red-500/20 bg-red-500/10 text-red-400"
            >
              <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div
              v-else
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gold/25 bg-gold/10 text-gold"
            >
              <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 class="text-base font-bold text-ink">
                {{ state.title }}
              </h3>
              <p class="mt-1 text-sm text-muted">
                {{ state.message }}
              </p>
            </div>
          </div>

          <div class="mt-6 flex justify-end gap-3">
            <button
              type="button"
              class="rounded-lg border border-line bg-transparent px-4 py-2 text-sm font-semibold text-muted transition-colors hover:border-ink/30 hover:text-ink focus:outline-none focus:shadow-[0_0_0_3px_rgba(212,175,55,0.15)]"
              @click="handleCancel"
            >
              {{ state.cancelText }}
            </button>
            <button
              type="button"
              :class="[
                'rounded-lg px-4 py-2 text-sm font-semibold transition-colors focus:outline-none',
                state.isDanger
                  ? 'bg-red-500 text-white hover:bg-red-600 shadow-xs focus:shadow-[0_0_0_3px_rgba(239,68,68,0.35)]'
                  : 'bg-gold text-black hover:bg-gold-dim focus:shadow-[0_0_0_3px_rgba(212,175,55,0.35)]'
              ]"
              @click="handleConfirm"
            >
              {{ state.confirmText }}
            </button>
          </div>
      </div>
    </dialog>
  </Teleport>
</template>

<style scoped>
dialog::backdrop {
  background: rgb(0 0 0 / 75%);
  backdrop-filter: blur(4px);
}
</style>
