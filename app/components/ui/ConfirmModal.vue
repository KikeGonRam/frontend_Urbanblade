<script setup lang="ts">
const { state, handleConfirm, handleCancel } = useConfirm()

function onKeyDown(e: KeyboardEvent) {
  if (!state.value.isOpen) return
  if (e.key === 'Escape') {
    handleCancel()
  }
}

onMounted(() => {
  if (import.meta.client) {
    window.addEventListener('keydown', onKeyDown)
  }
})

onUnmounted(() => {
  if (import.meta.client) {
    window.removeEventListener('keydown', onKeyDown)
  }
})
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="state.isOpen"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs"
        role="dialog"
        aria-modal="true"
        :aria-label="state.title"
        @click.self="handleCancel"
      >
        <div
          class="w-full max-w-md transform rounded-2xl border border-line bg-card p-6 shadow-2xl transition-all"
        >
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
              class="rounded-lg border border-line bg-transparent px-4 py-2 text-sm font-semibold text-muted hover:border-ink/30 hover:text-ink focus:outline-hidden"
              @click="handleCancel"
            >
              {{ state.cancelText }}
            </button>
            <button
              type="button"
              :class="[
                'rounded-lg px-4 py-2 text-sm font-semibold transition-colors focus:outline-hidden',
                state.isDanger
                  ? 'bg-red-500 text-white hover:bg-red-600 shadow-xs'
                  : 'bg-gold text-black hover:bg-gold-dim'
              ]"
              @click="handleConfirm"
            >
              {{ state.confirmText }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
