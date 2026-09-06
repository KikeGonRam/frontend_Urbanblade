/*
 * Registra el service worker de Web Push (public/sw.js) en cuanto carga la
 * app — solo registro, nunca pide permiso de notificaciones aquí (eso
 * requiere un gesto explícito del usuario, ver usePush().subscribe() /
 * ShellPushToggle.vue). Falla en silencio si el navegador no soporta
 * service workers (Safari viejo, navegadores in-app, etc.).
 */
export default defineNuxtPlugin(() => {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

  navigator.serviceWorker.register('/sw.js').catch(() => {
    // Sin service worker no hay push, pero el resto de la app sigue
    // funcionando igual — no es un error que deba interrumpir nada.
  })
})
