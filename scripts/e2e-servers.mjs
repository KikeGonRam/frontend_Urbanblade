/**
 * Levanta lo que necesitan las pruebas E2E de Cypress: la API simulada (e2e/support/mock-api.mjs,
 * puerto 8099) y el build de producción (`nuxt preview`, puerto 3100). Es lo mismo que hace el
 * webServer de playwright.config.ts. Requiere haber corrido `npm run build` antes, con las mismas
 * variables NUXT_PUBLIC_* (ver .github/workflows/cypress.yml y docs/CYPRESS_CLOUD.md).
 */
import { spawn } from 'node:child_process'

const env = {
  ...process.env,
  NUXT_PUBLIC_API_BASE: 'http://127.0.0.1:8099/api/v1',
  NUXT_PUBLIC_STRIPE_KEY: 'pk_test_e2e_fake',
  PORT: '3100',
  NITRO_PORT: '3100',
  HOST: '127.0.0.1',
  NITRO_HOST: '127.0.0.1',
}

const procesos = [
  spawn(process.execPath, ['e2e/support/mock-api.mjs'], { stdio: 'inherit', env }),
  // El servidor del build (lo mismo que hace `nuxt preview`), con el Node que ya está corriendo:
  // sin buscar `npm` en el PATH ni pasar por un shell.
  spawn(process.execPath, ['.output/server/index.mjs'], { stdio: 'inherit', env }),
]

const detener = () => {
  for (const p of procesos) p.kill()
}
process.on('SIGINT', detener)
process.on('SIGTERM', detener)
process.on('exit', detener)

for (const p of procesos) {
  p.on('exit', (code) => {
    if (code) {
      detener()
      process.exit(code)
    }
  })
}
