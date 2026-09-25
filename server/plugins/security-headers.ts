/**
 * TT10 y TT11 (HT-04): cabeceras de seguridad de la web.
 *
 * - Quita `x-powered-by: Nuxt`, que el renderizador de Nuxt pone fijo en cada página.
 * - En producción agrega Content-Security-Policy y Strict-Transport-Security. En desarrollo
 *   no: la CSP bloquearía el HMR de Vite y HSTS no aplica en http://localhost.
 *
 * Va en un plugin (y no en routeRules de nuxt.config) porque la CSP necesita el origen real de
 * la API, que llega en runtime por NUXT_PUBLIC_API_BASE. Dominios permitidos, según lo que usa
 * la app: Stripe (Elements, 3-D Secure), el mapa de Google en la landing, imágenes y videos que
 * manda la API (S3) e imágenes de Unsplash. 'unsafe-inline' en scripts es obligatorio: Nuxt
 * inyecta su configuración y el tema (nuxt.config → app.head.script) como scripts en línea.
 */
function originOf(url: string): string {
  try {
    return new URL(url).origin
  } catch {
    return ''
  }
}

export default defineNitroPlugin((nitroApp) => {
  const production = process.env.NODE_ENV === 'production'
  const api = originOf(String(useRuntimeConfig().public.apiBase || ''))

  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://js.stripe.com https://*.js.stripe.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    "media-src 'self' blob: https:",
    `connect-src 'self' ${api} https://api.stripe.com https://*.stripe.com`.trim(),
    'frame-src https://js.stripe.com https://*.js.stripe.com https://hooks.stripe.com https://www.google.com',
    "worker-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    `form-action 'self' ${api}`.trim(),
    "frame-ancestors 'self'",
  ].join('; ')

  nitroApp.hooks.hook('beforeResponse', (event) => {
    removeResponseHeader(event, 'x-powered-by')
    if (!production) return
    setResponseHeader(event, 'Content-Security-Policy', csp)
    setResponseHeader(event, 'Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  })
})
