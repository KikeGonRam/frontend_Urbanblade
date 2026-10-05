<script setup lang="ts">
/*
 * TT38 (HT-15): mapa vivo del sistema en /system (rol ingeniero y administrador).
 *
 * La lista de servicios y el detalle son la vista principal y accesible: se usan con
 * teclado y lector de pantalla y siempre se muestran. La vista 3D es un extra: solo se
 * carga (import dinámico de ~/lib/systemScene, que trae three.js) si el navegador tiene
 * WebGL y el usuario no pidió movimiento reducido. Ambas eligen el mismo nodo.
 */
import type { SystemScene } from '~/lib/systemScene'
import { STATE_DOT, STATE_LABEL, type SystemNode } from '~/utils/systemMap'

const props = defineProps<{ nodes: SystemNode[] }>()

type Mode = 'cargando' | '3d' | 'sin-webgl' | 'movimiento-reducido' | 'error'

const host = ref<HTMLElement | null>(null)
const mode = ref<Mode>('cargando')
const selectedId = ref<string | null>(defaultSelection(props.nodes))
const selected = computed(() => props.nodes.find(node => node.id === selectedId.value) ?? null)
const issues = computed(() => props.nodes.filter(node => node.state === 'caido' || node.state === 'lento').length)

const FALLBACK_TEXT: Partial<Record<Mode, string>> = {
  'sin-webgl': 'Tu navegador no tiene WebGL; se muestra la lista de servicios.',
  'movimiento-reducido': 'Pediste reducir el movimiento; se muestra la lista de servicios sin la vista 3D.',
  'error': 'No se pudo iniciar la vista 3D; se muestra la lista de servicios.',
}

let scene: SystemScene | null = null
let unmounted = false

/** Arranca en lo primero que requiere atención; si todo está bien, en la API. */
function defaultSelection(nodes: SystemNode[]): string | null {
  return (nodes.find(node => node.state === 'caido') ?? nodes.find(node => node.state === 'lento') ?? nodes[0])?.id ?? null
}

function hasWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'))
  } catch {
    return false
  }
}

onMounted(async () => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    mode.value = 'movimiento-reducido'
    return
  }
  if (!hasWebGL()) {
    mode.value = 'sin-webgl'
    return
  }

  try {
    const { createSystemScene } = await import('~/lib/systemScene')
    if (unmounted || !host.value) return
    scene = createSystemScene(host.value, { onSelect: (id) => { selectedId.value = id } })
    scene.update(props.nodes)
    scene.select(selectedId.value)
    mode.value = '3d'
  } catch {
    mode.value = 'error'
  }
})

watch(() => props.nodes, (nodes) => {
  if (!nodes.some(node => node.id === selectedId.value)) selectedId.value = defaultSelection(nodes)
  scene?.update(nodes)
  scene?.select(selectedId.value)
})
watch(selectedId, id => scene?.select(id))

onBeforeUnmount(() => {
  unmounted = true
  scene?.dispose()
  scene = null
})
</script>

<template>
  <section class="rounded-2xl border border-ink/[0.06] bg-card p-4 sm:p-5" aria-labelledby="system-map-title">
    <div class="flex flex-wrap items-baseline justify-between gap-2">
      <h2 id="system-map-title" class="text-sm font-bold text-ink">Mapa del sistema</h2>
      <p class="text-xs text-muted">
        {{ issues === 0 ? 'Todo responde' : `${issues} ${issues === 1 ? 'componente requiere' : 'componentes requieren'} atención` }}
      </p>
    </div>

    <div class="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div class="lg:col-span-2">
        <div
          v-show="mode === 'cargando' || mode === '3d'"
          ref="host"
          data-testid="system-map-3d"
          class="relative h-72 overflow-hidden rounded-xl border border-line bg-panel sm:h-96"
          role="img"
          :aria-label="`Vista 3D del sistema: ${nodes.length} componentes, ${issues} con problemas. Usa la lista para elegir uno.`"
        >
          <p v-if="mode === 'cargando'" class="absolute inset-0 grid place-items-center text-xs text-muted">Cargando vista 3D…</p>
        </div>
        <p v-if="FALLBACK_TEXT[mode]" data-testid="system-map-fallback" class="rounded-xl border border-line bg-panel px-4 py-3 text-xs text-muted">
          {{ FALLBACK_TEXT[mode] }}
        </p>
        <ul class="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-bold uppercase tracking-widest text-muted" aria-label="Colores por estado">
          <li v-for="(label, state) in STATE_LABEL" :key="state" class="flex items-center gap-1.5">
            <span class="h-2 w-2 rounded-full" :class="STATE_DOT[state]" />{{ label }}
          </li>
        </ul>
      </div>

      <div class="space-y-3">
        <ul class="space-y-1.5" aria-label="Componentes del sistema">
          <li v-for="node in nodes" :key="node.id">
            <button
              type="button"
              class="flex min-h-10 w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
              :class="node.id === selectedId ? 'border-gold/50 bg-gold/10 text-ink' : 'border-line text-muted hover:border-gold/30 hover:text-ink'"
              :aria-pressed="node.id === selectedId"
              @click="selectedId = node.id"
            >
              <span class="h-2.5 w-2.5 shrink-0 rounded-full" :class="STATE_DOT[node.state]" aria-hidden="true" />
              <span class="min-w-0 flex-1 truncate font-semibold">{{ node.label }}</span>
              <span class="shrink-0 text-[10px] uppercase tracking-wider">{{ STATE_LABEL[node.state] }}</span>
            </button>
          </li>
        </ul>

        <div v-if="selected" data-testid="system-map-detail" class="rounded-xl border border-line bg-panel p-4" aria-live="polite">
          <p class="text-[10px] font-black uppercase tracking-widest text-muted">
            {{ selected.kind === 'tarea' ? 'Tarea programada' : selected.kind === 'api' ? 'Aplicación' : 'Servicio' }}
          </p>
          <p class="mt-1 text-base font-black text-ink">{{ selected.label }}</p>
          <p class="mt-1 flex items-center gap-1.5 text-xs font-bold text-ink">
            <span class="h-2 w-2 rounded-full" :class="STATE_DOT[selected.state]" aria-hidden="true" />{{ STATE_LABEL[selected.state] }}
          </p>
          <p class="mt-2 text-xs text-muted">{{ selected.summary }}</p>
          <p v-if="selected.error" class="mt-2 break-words text-xs text-red-400">{{ selected.error }}</p>
        </div>
      </div>
    </div>
  </section>
</template>

<style>
/* Etiquetas de la vista 3D: las crea ~/lib/systemScene fuera de Vue, por eso no es scoped. */
.ub-sysmap-label {
  padding: 0.125rem 0.4rem;
  border: 1px solid var(--line);
  border-radius: 0.375rem;
  background: var(--bg-card);
  color: var(--ink);
  font-size: 10px;
  font-weight: 700;
  white-space: nowrap;
  opacity: 0.9;
}
.ub-sysmap-label[data-state='caido'] { border-color: rgb(var(--danger-rgb) / 0.6); }
.ub-sysmap-label[data-state='lento'] { border-color: rgb(var(--warning-rgb) / 0.6); }
.ub-sysmap-label.is-selected { border-color: var(--gold); color: var(--gold); opacity: 1; }
</style>
