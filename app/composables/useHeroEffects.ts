/**
 * Efectos del héroe de la portada: paralaje suave de la foto al desplazarse y un resplandor que
 * sigue al puntero (solo con puntero fino, p. ej. ratón). Con movimiento reducido no hay ninguno.
 */
export function useHeroEffects(hero: Ref<HTMLElement | null>, background: Ref<HTMLElement | null>) {
  let onParallax: (() => void) | undefined
  let onPointer: ((e: PointerEvent) => void) | undefined

  onMounted(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const heroEl = hero.value
    const bgEl = background.value

    if (heroEl && window.matchMedia('(pointer: fine)').matches) {
      onPointer = (e: PointerEvent) => {
        const r = heroEl.getBoundingClientRect()
        heroEl.style.setProperty('--mx', `${e.clientX - r.left}px`)
        heroEl.style.setProperty('--my', `${e.clientY - r.top}px`)
      }
      heroEl.addEventListener('pointermove', onPointer, { passive: true })
    }

    if (bgEl) {
      onParallax = () => { bgEl.style.transform = `translateY(${window.scrollY * 0.22}px)` }
      window.addEventListener('scroll', onParallax, { passive: true })
    }
  })

  onBeforeUnmount(() => {
    if (onParallax) window.removeEventListener('scroll', onParallax)
    if (onPointer) hero.value?.removeEventListener('pointermove', onPointer as EventListener)
  })
}
