// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  modules: ['@nuxtjs/tailwindcss', '@nuxt/fonts', '@nuxt/eslint'],

  css: ['~/assets/css/main.css'],

  fonts: {
    families: [
      { name: 'Figtree', provider: 'google', weights: [400, 500, 600, 700] },
      { name: 'Plus Jakarta Sans', provider: 'google', weights: [400, 500, 600, 700, 800] },
    ],
  },

  runtimeConfig: {
    public: {
      // Base de la API JSON de barber, con /api/v1 incluido. Ver
      // .claude/skills/nuxt-migration-plan/SKILL.md — auth por Bearer token
      // (mobile_api_tokens), no por sesión/cookie.
      apiBase: process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:8000/api/v1',
      // Clave PUBLICABLE de Stripe (pk_...) — segura de exponer en el
      // cliente por diseño, es la misma que barber expone en el <script>
      // de payments/create.blade.php vía config('services.stripe.key').
      // Fase 9.3 (Pagos): cobro con tarjeta (beta) vía Stripe Elements.
      stripeKey: process.env.NUXT_PUBLIC_STRIPE_KEY || '',
    },
  },

  app: {
    head: {
      // Aplica el tema guardado en cookie ANTES de pintar, para evitar el
      // flash de tema incorrecto (FOUC) — equivalente a que barber lo
      // renderice en servidor via data-theme en <html> (ver
      // app.blade.php), pero aquí el token vive en el cliente, no en una
      // sesión de servidor, así que se resuelve con este script inline
      // bloqueante que lee la cookie de forma síncrona.
      script: [
        {
          innerHTML: `(function(){try{var m=document.cookie.match(/(?:^|; )ub_theme=([^;]+)/);var t=m?decodeURIComponent(m[1]):'noir';document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`,
          tagPosition: 'head',
        },
      ],
    },
  },

  /*
   * SSR híbrido: páginas públicas (landing, catálogo) se benefician de SEO
   * y quedan con SSR/prerender por default; el área autenticada (dashboards)
   * se marca SPA/CSR fase a fase conforme se migra (ver
   * .claude/skills/nuxt-migration-plan/SKILL.md, sección "Decisión de
   * rendering"). routeRules por prefijo se agregan aquí a medida que existan
   * esas rutas.
   */
  routeRules: {
    '/dashboard/**': { ssr: false },
    '/appointments': { ssr: false },
    '/appointments/**': { ssr: false },
    '/clients': { ssr: false },
    '/clients/**': { ssr: false },
    '/payments': { ssr: false },
    '/payments/**': { ssr: false },
    '/orders': { ssr: false },
    '/orders/**': { ssr: false },
    '/store': { ssr: false },
    '/store/**': { ssr: false },
    '/cart': { ssr: false },
    '/my/**': { ssr: false },
    '/inventory/**': { ssr: false },
    '/services': { ssr: false },
    '/services/**': { ssr: false },
    '/users': { ssr: false },
    '/users/**': { ssr: false },
    '/barber/**': { ssr: false },
    '/barbers': { ssr: false },
    '/barbers/**': { ssr: false },
  },
})
