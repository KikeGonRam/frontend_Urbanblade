import { defineConfig } from 'cypress'

// Pruebas E2E con Cypress sobre el BUILD DE PRODUCCIÓN y la API simulada de e2e/support/mock-api.mjs,
// igual que las de Playwright (ver docs/CYPRESS_CLOUD.md). Los runs se registran en Cypress Cloud
// (proyecto 1dpyzb) solo cuando existe CYPRESS_RECORD_KEY; sin ella corren igual, sin registrar.
export default defineConfig({
  projectId: '1dpyzb',
  video: false,
  retries: { runMode: 2, openMode: 0 },
  viewportWidth: 1280,
  viewportHeight: 720,
  e2e: {
    baseUrl: 'http://127.0.0.1:3100',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    supportFile: 'cypress/support/e2e.ts',
    defaultCommandTimeout: 10000,
  },
})
