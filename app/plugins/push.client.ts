/*
 * Registra el service worker (public/sw.js) en cuanto carga la app. Ese
 * mismo worker atiende Web Push y el funcionamiento sin conexión (caché de
 * páginas y recursos estáticos, ver el encabezado de sw.js). Solo registra:
 * nunca pide permiso de notificaciones aquí (eso requiere un gesto
 * explícito del usuario, ver usePush().subscribe() / ShellPushToggle.vue).
 * Falla en silencio si el navegador no soporta service workers (Safari
 * viejo, navegadores in-app, etc.).
 */
export default defineNuxtPlugin(() => {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

  navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch(() => {
    // Sin service worker no hay push, pero el resto de la app sigue
    // funcionando igual — no es un error que deba interrumpir nada.
  })
})
