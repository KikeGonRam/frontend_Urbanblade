/*
 * Enlaces "inteligentes" de los correos (`/abrir?ruta=/my/invoices`): en un celular Android abren la app
 * UrbanBlade en la pantalla equivalente; en una computadora (o si la app no está instalada) abren la web.
 *
 * Los correos de barber apuntan a /abrir en lugar de a la ruta web directa. La app Android atiende
 * `urbanblade://open?route=<pantalla>` (UrbanBladeMobile, AndroidManifest + PushDeepLink); las pantallas
 * permitidas son una lista cerrada en la app (PUSH_ROUTES), así que un valor desconocido solo abre el inicio.
 */

/** Ruta web -> pantalla de la app. El primero que coincide gana. */
const APP_ROUTES: ReadonlyArray<readonly [RegExp, string]> = [
  [/^\/my\/appointments(\/|$)/, 'appointments'],
  [/^\/appointments(\/|$)/, 'appointments'],
  [/^\/my\/invoices(\/|$)/, 'payments'],
  [/^\/payments(\/|$)/, 'payments'],
  [/^\/my\/orders(\/|$)/, 'orders'],
  [/^\/orders(\/|$)/, 'orders'],
  [/^\/reservar(\/|$)/, 'catalog'],
  [/^\/barber\/agenda(\/|$)/, 'barber_agenda'],
  [/^\/inventory(\/|$)/, 'inventory'],
  [/^\/notifications(\/|$)/, 'notifications'],
  [/^\/dashboard(\/|$)/, 'home'],
]

export const ANDROID_PACKAGE = 'com.urbanblade.mobile'

/**
 * Ruta web segura para redirigir: solo rutas internas (empiezan con una sola "/"). Rechaza URL completas,
 * "//dominio" (que el navegador toma como otro sitio), barras invertidas y caracteres de control, para que
 * /abrir no pueda usarse como redirección abierta hacia otro dominio.
 */
export function safeWebPath(raw: unknown): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw
  if (typeof value !== 'string') return null
  const path = value.trim()
  if (path === '' || path.length > 300) return null
  if (!path.startsWith('/') || path.startsWith('//')) return null
  if (path.includes('\\') || hasControlChars(path)) return null
  return path
}

function hasControlChars(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i)
    if (code <= 0x1f || code === 0x7f) return true
  }
  return false
}

/** Pantalla de la app equivalente a una ruta web, o null si la app no la tiene. */
export function appRouteFor(path: string): string | null {
  const pathname = path.split(/[?#]/)[0] ?? path
  for (const [pattern, route] of APP_ROUTES) {
    if (pattern.test(pathname)) return route
  }
  return null
}

/** El navegador es de un Android (la app solo existe para Android). */
export function isAndroid(userAgent: string): boolean {
  return /Android/i.test(userAgent)
}

/**
 * Intent de Chrome para Android: abre la app si está instalada y, si no, navega a la web (`fallbackUrl`).
 * Equivale a `urbanblade://open?route=<pantalla>`.
 */
export function buildAndroidIntent(appRoute: string, fallbackUrl: string): string {
  return `intent://open?route=${encodeURIComponent(appRoute)}#Intent;scheme=urbanblade;package=${ANDROID_PACKAGE};S.browser_fallback_url=${encodeURIComponent(fallbackUrl)};end`
}
