import type { ApiUser } from '../../app/types/contract'

/**
 * Intercepta la API de barber en el navegador, como e2e/support/api-mock.ts de Playwright.
 * Verifica el comportamiento del FRONTEND (guards, redirecciones, errores), no el backend: ese ya
 * tiene su propia suite en barber. cy.intercept() solo ve las peticiones del NAVEGADOR; las que
 * Nuxt hace durante SSR salen de Node y las atiende e2e/support/mock-api.mjs, por eso las pruebas
 * de sesión entran por /login y navegan del lado del cliente.
 *
 * El usuario simulado es el mismo tipo que el de la app (derivado del OpenAPI): si el contrato
 * cambia y el mock ya no cabe, deja de compilar en vez de seguir pasando contra una forma vieja.
 */
export function makeUser(overrides: Partial<ApiUser> = {}): ApiUser {
  return {
    id: 'u-1',
    name: 'Cliente Prueba',
    email: 'cliente@test.local',
    avatar_url: null,
    roles: ['cliente'],
    profile_complete: true,
    profile_missing: [],
    client_id: 'c-1',
    barber_id: null,
    client: { telefono: '5512345678', fecha_nacimiento: '1995-04-12', sexo: 'masculino' },
    ...overrides,
  }
}

export interface MockApiOptions {
  /** Usuario devuelto por /auth/login y /auth/me. */
  user?: ApiUser
  /** Status de /auth/login (422 = credenciales inválidas, 429 = límite de intentos). */
  loginStatus?: number
  /** Cuerpo de las respuestas de error. */
  errorBody?: Record<string, unknown>
}

const cors = { 'access-control-allow-origin': '*' }

export function mockApi(options: MockApiOptions = {}) {
  const { user = makeUser(), loginStatus = 200, errorBody = { message: 'Error' } } = options

  // Cualquier otro endpoint: una colección vacía basta para que la página muestre su estado vacío.
  // Va primero: Cypress consulta primero lo definido al último.
  cy.intercept('**/api/v1/**', { statusCode: 200, headers: cors, body: { data: [] } })

  cy.intercept('GET', '**/api/v1/auth/me', { statusCode: 200, headers: cors, body: { user } })
  cy.intercept('GET', '**/api/v1/dashboard', {
    statusCode: 200,
    headers: cors,
    body: { role: user.roles[0] ?? 'cliente', data: {} },
  })
  cy.intercept('POST', '**/api/v1/auth/logout', { statusCode: 200, headers: cors, body: { message: 'ok' } })

  cy.intercept('POST', '**/api/v1/auth/login', (req) => {
    if (loginStatus === 200) {
      req.reply({
        statusCode: 200,
        headers: cors,
        body: {
          message: 'ok',
          token_type: 'Bearer',
          token: 'test-token',
          expires_at: '2026-11-04T12:00:00.000000Z',
          user,
        },
      })
    } else {
      req.reply({ statusCode: loginStatus, headers: cors, body: errorBody })
    }
  }).as('login')
}
