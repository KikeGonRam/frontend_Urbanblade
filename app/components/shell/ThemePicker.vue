<script setup lang="ts">
/*
 * Selector de tema (Fase 0 del plan de mejora de la interfaz). Sustituye al <select> nativo de la barra:
 * un botón de paleta abre un panel con una vista previa de cada tema; el cambio es inmediato.
 * Las opciones son radios nativos (el navegador mueve la selección con las flechas); Esc cierra y devuelve
 * el foco al botón.
 */
const { theme, apply, THEMES, THEME_LABELS, THEME_PREVIEWS, THEME_BLURBS } = useTheme()

const open = ref(false)
const root = ref<HTMLElement | null>(null)
const trigger = ref<HTMLButtonElement | null>(null)

function close(returnFocus = true) {
  open.value = false
  if (returnFocus) trigger.value?.focus()
}

async function toggle() {
  open.value = !open.value
  if (!open.value) return
  await nextTick()
  root.value?.querySelector<HTMLInputElement>('input[type="radio"]:checked')?.focus()
}

function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape') return
  event.stopPropagation()
  close()
}

function onDocumentClick(event: MouseEvent) {
  if (open.value && root.value && !root.value.contains(event.target as Node)) close(false)
}

onMounted(() => document.addEventListener('click', onDocumentClick))
onBeforeUnmount(() => document.removeEventListener('click', onDocumentClick))
</script>

<template>
  <div ref="root" class="ub-theme-picker" @keydown="open && onKeydown($event)">
    <button
      ref="trigger"
      type="button"
      class="ub-topbar-button"
      aria-haspopup="true"
      :aria-expanded="open"
      :aria-label="`Cambiar tema de color. Tema actual: ${THEME_LABELS[theme]}`"
      :title="`Tema: ${THEME_LABELS[theme]}`"
      @click="toggle"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.8-.8 1.8-1.7 0-.5-.2-.8-.4-1.1-.3-.3-.4-.7-.4-1.1 0-.9.8-1.6 1.7-1.6H17a4 4 0 0 0 4-4C21 7 17 3 12 3Z" />
        <circle cx="7.5" cy="11.5" r="1" fill="currentColor" />
        <circle cx="10.5" cy="7.5" r="1" fill="currentColor" />
        <circle cx="15" cy="7.5" r="1" fill="currentColor" />
      </svg>
    </button>

    <Transition name="ub-theme-pop">
      <fieldset v-if="open" class="ub-theme-popover">
        <legend class="ub-theme-popover__title">Tema</legend>
        <label v-for="option in THEMES" :key="option" class="ub-theme-option">
          <input
            type="radio"
            name="ub-theme"
            class="sr-only"
            :value="option"
            :checked="theme === option"
            @change="apply(option)"
          >
          <span
            class="ub-theme-option__preview"
            aria-hidden="true"
            :style="{ background: THEME_PREVIEWS[option].bg, borderColor: THEME_PREVIEWS[option].line }"
          >
            <span class="ub-theme-option__card" :style="{ background: THEME_PREVIEWS[option].card }">
              <i :style="{ background: THEME_PREVIEWS[option].ink }" />
              <i :style="{ background: THEME_PREVIEWS[option].gold }" />
            </span>
          </span>
          <span class="ub-theme-option__text">
            <strong>{{ THEME_LABELS[option] }}</strong>
            <small>{{ THEME_BLURBS[option] }}</small>
          </span>
          <svg v-if="theme === option" class="ub-theme-option__check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="m5 12 4.5 4.5L19 7" />
          </svg>
        </label>
      </fieldset>
    </Transition>
  </div>
</template>
