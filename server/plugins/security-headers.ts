import { randomBytes } from 'node:crypto'

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
 * manda la API (S3) e imágenes de Unsplash.
 *
 * TT28 (hallazgo MEDIO de OWASP ZAP): los scripts ya no usan 'unsafe-inline'. Cada respuesta
 * HTML lleva un nonce aleatorio que se pone en todos sus <script> (la configuración y los datos
 * de Nuxt, y el script del tema de nuxt.config → app.head.script); un script inyectado sin ese
 * nonce no se ejecuta. Los estilos siguen con 'unsafe-inline' porque Vue usa atributos style.
 * Ninguna página se prerenderiza, así que el nonce siempre es por petición.
 *
 * Google Tag Manager (GTM-K4RR96BB): solo se carga tras aceptar las cookies de analítica. Su gtm.js
 * y los scripts que inyecta no llevan nonce, así que se permite el host www.googletagmanager.com en
 * script-src (sin 'unsafe-inline'), y los de medición (Google Analytics) en img-src y connect-src.
 * El contenedor también publica Microsoft Clarity: scripts.clarity.ms en script-src, *.clarity.ms en
 * img-src y connect-src, c.bing.com en img-src (sincronización de cookies de Clarity) y blob: en
 * worker-src (Clarity comprime sus datos en un worker).
 */
function originOf(url: string): string {
  try {
    return new URL(url).origin
  } catch {
    return ''
  }
}

/**
 * Hosts de los buckets de imágenes y videos (NUXT_UPLOADS_HOSTS, separados por coma). Por defecto,
 * el bucket de staging; ya no se permite cualquier bucket de S3.
 */
const UPLOADS_HOSTS = (process.env.NUXT_UPLOADS_HOSTS
  || 'urbanblade-staging-uploads-209479293733.s3.amazonaws.com,urbanblade-staging-uploads-209479293733.s3.us-east-1.amazonaws.com')
  .split(',').map(h => h.trim()).filter(Boolean).map(h => `https://${h}`).join(' ')
const S3 = UPLOADS_HOSTS

/** Pone el nonce en cada <script> que no lo tenga. */
function withNonce(chunks: string[], nonce: string): string[] {
  return chunks.map(html => html.replace(/<script(?![^>]*\snonce=)/g, `<script nonce="${nonce}"`))
}

export default defineNitroPlugin((nitroApp) => {
  const production = process.env.NODE_ENV === 'production'
  const api = originOf(String(useRuntimeConfig().public.apiBase || ''))

  const csp = (nonce: string | undefined) => [
    "default-src 'self'",
    // Sin nonce (respuestas que no son HTML) no se permite ningún script en línea.
    `script-src 'self' ${nonce ? `'nonce-${nonce}'` : ''} https://js.stripe.com https://*.js.stripe.com https://www.googletagmanager.com https://scripts.clarity.ms`.replace(/\s+/g, ' '),
    "script-src-attr 'none'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    // Antes `https:` (cualquier sitio; hallazgo MEDIO de OWASP ZAP, T052). Ahora solo los orígenes
    // reales: subidas en S3, archivos viejos servidos por la API, fotos de Google, Unsplash y Stripe.
    `img-src 'self' data: blob: ${api} ${S3} https://*.googleusercontent.com https://images.unsplash.com https://*.stripe.com https://www.googletagmanager.com https://*.google-analytics.com https://*.clarity.ms https://c.bing.com`.replace(/\s+/g, ' '),
    `media-src 'self' blob: ${api} ${S3}`.replace(/\s+/g, ' '),
    `connect-src 'self' ${api} https://api.stripe.com https://*.stripe.com https://www.googletagmanager.com https://*.google-analytics.com https://*.analytics.google.com https://*.clarity.ms`.trim(),
    'frame-src https://js.stripe.com https://*.js.stripe.com https://hooks.stripe.com https://www.google.com https://www.googletagmanager.com',
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    `form-action 'self' ${api}`.trim(),
    "frame-ancestors 'self'",
  ].join('; ')

  nitroApp.hooks.hook('render:html', (html, { event }) => {
    if (!production) return
    const nonce = randomBytes(16).toString('base64')
    event.context.cspNonce = nonce
    html.head = withNonce(html.head, nonce)
    html.bodyPrepend = withNonce(html.bodyPrepend, nonce)
    html.body = withNonce(html.body, nonce)
    html.bodyAppend = withNonce(html.bodyAppend, nonce)
  })

  // HSTS también en los errores (404, 500): el manejador de errores de Nitro no pasa por beforeResponse
  // con nuestra cabecera, así que se fija al recibir la petición.
  nitroApp.hooks.hook('request', (event) => {
    if (production) setResponseHeader(event, 'Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  })

  nitroApp.hooks.hook('beforeResponse', (event) => {
    removeResponseHeader(event, 'x-powered-by')
    if (!production) return
    setResponseHeader(event, 'Content-Security-Policy', csp(event.context.cspNonce as string | undefined))
    setResponseHeader(event, 'Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  })
})
