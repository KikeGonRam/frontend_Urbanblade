import { defineVitestConfig } from '@nuxt/test-utils/config'

/*
 * Pruebas unitarias y de componente (Vitest + Vue Test Utils). Corren dentro del entorno de Nuxt para que
 * las páginas y componentes se monten con sus auto-imports (ref, useAuth, NuxtLink…) igual que en la app.
 * Playwright (e2e/) y Cypress (cypress/) siguen siendo las pruebas de extremo a extremo; aquí solo se prueba
 * cada formulario por separado, con sus dependencias simuladas.
 */
export default defineVitestConfig({
  test: {
    environment: 'nuxt',
    environmentOptions: { nuxt: { domEnvironment: 'happy-dom' } },
    include: ['tests/**/*.test.ts'],
  },
})
