import { defineConfig, devices } from "@playwright/test";

/**
 * Fase 6 del roadmap (pruebas E2E y producción): los recorridos críticos se
 * prueban contra el BUILD DE PRODUCCIÓN (`nuxt build` + `nuxt preview`), no
 * contra `nuxt dev` — el criterio de aceptación de la fase es explícitamente
 * "flujo crítico probado en build de producción", y ya nos mordió antes que
 * algo funcionara en dev y no en el bundle real (ver el incidente del
 * reveal-on-scroll y el de la caché de Vite en .nuxt).
 *
 * La API de barber se intercepta con page.route() en cada prueba (ver
 * e2e/support/api-mock.ts): estas pruebas verifican el comportamiento del
 * FRONTEND (guards de ruta, redirecciones, manejo de errores, gate de perfil
 * incompleto), no el backend — ese ya tiene su propia suite en ../barber.
 * Eso las hace deterministas y ejecutables en CI sin levantar Laravel, Mongo
 * ni Redis.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  // En CI también se genera el HTML (además del "list" legible en el log)
  // porque el workflow sube playwright-report/ como artefacto cuando algo
  // falla — sin este reporter ese artefacto vendría vacío.
  reporter: process.env.CI
    ? [["list"], ["html", { open: "never" }]]
    : [["html", { open: "never" }]],

  use: {
    // Puerto propio (3100), no el 3000 de `npm run dev`: si un servidor de
    // desarrollo quedó levantado, Playwright lo reutilizaría y las pruebas
    // correrían contra código viejo en modo dev en vez de contra el build de
    // producción recién compilado. Pasó exactamente eso al escribir esta
    // suite — tres pruebas "fallaron" por una corrección que sí estaba en el
    // código pero no en el servidor reutilizado.
    baseURL: "http://127.0.0.1:3100",
    trace: "on-first-retry",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: [
    // Finge la API de barber para las peticiones que Nuxt hace en SSR, que
    // page.route() no puede interceptar — ver e2e/support/mock-api.mjs.
    {
      command: "node e2e/support/mock-api.mjs",
      url: "http://127.0.0.1:8099/api/v1/services",
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      // 127.0.0.1 y no "localhost": el server de Nuxt puede quedarse
      // escuchando solo en IPv6 (::1) según el entorno, y entonces
      // "localhost" resuelve a una dirección donde no hay nadie — ya
      // diagnosticado en este proyecto.
      // El puerto/host van por variable de entorno (Nitro las lee), no por
      // flags de CLI: `nuxt preview` no acepta --port/--host y sale con
      // código 1 sin decir por qué.
      command: "npm run build && npm run preview",
      url: "http://127.0.0.1:3100",
      // Nunca reutilizar: la fase exige probar el build de producción, y un
      // servidor previo no ofrece ninguna garantía de estar compilado con el
      // código actual.
      reuseExistingServer: false,
      timeout: 180_000,
      env: {
        NUXT_PUBLIC_API_BASE: "http://127.0.0.1:8099/api/v1",
        // Clave deliberadamente ficticia: permite renderizar el flujo de
        // tarjeta mientras payments.spec.ts sustituye el SDK en el navegador.
        NUXT_PUBLIC_STRIPE_KEY: "pk_test_e2e_fake",
        PORT: "3100",
        NITRO_PORT: "3100",
        HOST: "127.0.0.1",
        NITRO_HOST: "127.0.0.1",
      },
    },
  ],
});
