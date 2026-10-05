<script setup lang="ts">
/*
 * TT39 (HT-16): poste de barbería 3D del hero de la portada. Es decorativo (aria-hidden)
 * y nunca bloquea la portada, que sigue renderizándose en servidor:
 * - three.js (~/lib/barberPoleScene) se pide con import() después del evento load y de
 *   un momento libre del navegador, así que no compite con la primera pintura.
 * - Solo se pide en pantallas de 1280 px o más, con WebGL, sin movimiento reducido ni
 *   ahorro de datos. Si no se cumple, no se descarga nada y el hero queda como antes.
 */
import type { BarberPoleScene } from '~/lib/barberPoleScene'

const MIN_WIDTH = '(min-width: 1280px)'

const host = ref<HTMLElement | null>(null)
const ready = ref(false)
let scene: BarberPoleScene | null = null
let unmounted = false

function canShow(): boolean {
  if (!window.matchMedia(MIN_WIDTH).matches) return false
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false
  if ((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData) return false
  try {
    const canvas = document.createElement('canvas')
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'))
  } catch {
    return false
  }
}

function afterLoadAndIdle(): Promise<void> {
  const loaded = document.readyState === 'complete'
    ? Promise.resolve()
    : new Promise<void>(resolve => window.addEventListener('load', () => resolve(), { once: true }))

  return loaded.then(() => new Promise<void>((resolve) => {
    if ('requestIdleCallback' in window) window.requestIdleCallback(() => resolve(), { timeout: 2000 })
    else setTimeout(resolve, 600)
  }))
}

onMounted(async () => {
  if (!canShow()) return
  await afterLoadAndIdle()
  try {
    const { createBarberPoleScene } = await import('~/lib/barberPoleScene')
    if (unmounted || !host.value) return
    scene = createBarberPoleScene(host.value)
    ready.value = true
  } catch {
    // Sin poste: el hero se ve igual que antes de la HT-16.
  }
})

onBeforeUnmount(() => {
  unmounted = true
  scene?.dispose()
  scene = null
})
</script>

<template>
  <div
    ref="host"
    data-testid="hero-pole"
    aria-hidden="true"
    class="pointer-events-none absolute right-[1%] top-[60%] z-[3] hidden h-[46vh] max-h-[560px] w-[180px] -translate-y-1/2 transition-opacity duration-1000 xl:block 2xl:right-[5%] 2xl:top-1/2 2xl:h-[56vh] 2xl:w-[200px]"
    :class="ready ? 'opacity-100' : 'opacity-0'"
  />
</template>
