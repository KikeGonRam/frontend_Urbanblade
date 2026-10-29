<script setup lang="ts">
/*
 * Menú «⋯» para las acciones secundarias o de riesgo de una fila (auditoría UI/UX A-20 y A-30): la acción
 * principal queda a la vista y lo demás (editar, eliminar, anular) se despliega. Se posiciona con `fixed`
 * para no recortarse dentro de tablas con desplazamiento, y se cierra con Escape, clic fuera o al elegir.
 */
export interface RowMenuItem {
  label: string
  danger?: boolean
  disabled?: boolean
  onSelect: () => void
}

const props = defineProps<{ items: RowMenuItem[], label?: string }>()

const open = ref(false)
const trigger = ref<HTMLButtonElement | null>(null)
const menu = ref<HTMLElement | null>(null)
const position = ref({ top: 0, left: 0 })

const MENU_WIDTH = 176

async function toggle() {
  open.value = !open.value
  if (!open.value) return
  const rect = trigger.value?.getBoundingClientRect()
  if (rect) {
    const left = Math.min(Math.max(8, rect.right - MENU_WIDTH), window.innerWidth - MENU_WIDTH - 8)
    // Si no cabe debajo, se abre hacia arriba.
    const alto = props.items.length * 40 + 8
    const top = rect.bottom + alto > window.innerHeight ? Math.max(8, rect.top - alto) : rect.bottom + 4
    position.value = { top, left }
  }
  await nextTick()
  menu.value?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus()
}

function close(returnFocus = false) {
  open.value = false
  if (returnFocus) trigger.value?.focus()
}

function select(item: RowMenuItem) {
  if (item.disabled) return
  close(true)
  item.onSelect()
}

function onDocumentClick(event: MouseEvent) {
  const target = event.target as Node
  if (open.value && !menu.value?.contains(target) && !trigger.value?.contains(target)) close()
}

function onKeydown(event: KeyboardEvent) {
  if (!open.value) return
  if (event.key === 'Escape') {
    event.preventDefault()
    close(true)
  }
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    const buttons = [...(menu.value?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])]
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
    const next = event.key === 'ArrowDown' ? (index + 1) % buttons.length : (index - 1 + buttons.length) % buttons.length
    buttons[next]?.focus()
  }
}

const onScroll = () => close()

onMounted(() => {
  document.addEventListener('click', onDocumentClick)
  document.addEventListener('keydown', onKeydown)
  window.addEventListener('scroll', onScroll, true)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick)
  document.removeEventListener('keydown', onKeydown)
  window.removeEventListener('scroll', onScroll, true)
})
</script>

<template>
  <span class="inline-flex">
    <button
      ref="trigger"
      type="button"
      class="flex min-h-9 min-w-9 items-center justify-center rounded-lg border border-line text-muted transition-colors hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold"
      aria-haspopup="menu"
      :aria-expanded="open"
      :aria-label="label ?? 'Más acciones'"
      @click="toggle"
    >
      <span aria-hidden="true" class="text-base leading-none">⋯</span>
    </button>
    <div
      v-if="open"
      ref="menu"
      role="menu"
      class="fixed z-50 w-44 rounded-xl border border-line bg-card p-1 shadow-2xl"
      :style="{ top: `${position.top}px`, left: `${position.left}px` }"
    >
      <button
        v-for="item in items"
        :key="item.label"
        type="button"
        role="menuitem"
        :disabled="item.disabled"
        class="flex min-h-10 w-full items-center rounded-lg px-3 text-left text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold disabled:opacity-40"
        :class="item.danger ? 'text-danger hover:bg-danger/10' : 'text-ink hover:bg-accent'"
        @click="select(item)"
      >
        {{ item.label }}
      </button>
    </div>
  </span>
</template>
