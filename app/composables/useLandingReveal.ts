/*
 * v-reveal de la portada: hace aparecer cada bloque cuando entra en pantalla.
 *
 * El observador se crea de forma perezosa en el primer mounted() del directive, no en el setup
 * de la página. Antes se creaba en setup() para no llegar tarde al primer lote de elementos del
 * HTML ya renderizado (hidratado): un directive se monta ANTES que el onMounted() del componente,
 * y con el observador creado después, toda la sección quedaba en opacity:0 para siempre en un
 * build de producción. Crearlo justo cuando se necesita elimina ese problema de orden y sirve
 * igual para las tarjetas que llegan después de un fetch.
 */
let observer: IntersectionObserver | undefined

/** Con movimiento reducido no hay animación: los bloques se muestran de inmediato. */
function reducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function ensureObserver(): IntersectionObserver | undefined {
  if (reducedMotion()) return undefined
  observer ??= new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible')
        observer?.unobserve(entry.target)
      }
    })
  }, { threshold: 0.01, rootMargin: '0px 0px 18% 0px' })
  return observer
}

export const vReveal = {
  mounted(el: HTMLElement) {
    const io = ensureObserver()
    if (io) io.observe(el)
    else el.classList.add('is-visible')
  },
}

/** Libera el observador al salir de la portada. */
export function disconnectReveal(): void {
  observer?.disconnect()
  observer = undefined
}
