/**
 * Estado de desplazamiento de la portada: `scrolled` (más de 50 px) cambia el fondo de la barra de
 * navegación y `showBar` (más de 700 px) muestra el botón fijo de reservar en el teléfono.
 */
export function useLandingScroll() {
  const scrolled = ref(false)
  const showBar = ref(false)

  function onScroll() {
    scrolled.value = window.scrollY > 50
    showBar.value = window.scrollY > 700
  }

  onMounted(() => window.addEventListener('scroll', onScroll, { passive: true }))
  onBeforeUnmount(() => window.removeEventListener('scroll', onScroll))

  return { scrolled, showBar }
}

/*
 * Entrada directa con #ancla (p. ej. /#app): el catálogo y los maestros llegan por fetch en cliente
 * y la página crece después de que el navegador ya saltó, así que la sección queda desplazada. Se
 * reposiciona una sola vez cuando terminan de cargar.
 */
export function useLandingAnchor(servicesPending: Ref<boolean>, barbersPending: Ref<boolean>) {
  const route = useRoute()
  let restored = false

  function restore() {
    if (restored || !route.hash || servicesPending.value || barbersPending.value) return
    restored = true
    nextTick(() => document.querySelector(route.hash)?.scrollIntoView())
  }

  if (import.meta.client) watch([servicesPending, barbersPending], restore)
  onMounted(restore)
}
