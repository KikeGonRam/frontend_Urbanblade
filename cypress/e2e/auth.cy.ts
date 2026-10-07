import { makeUser, mockApi } from '../support/api-mock'

/**
 * Recorridos críticos de sesión sobre el build de producción: guard de ruta, login con error real
 * del backend, acceso de un cliente con perfil completo y la plataforma que declara la web.
 */
describe('Sesión', () => {
  it('una ruta protegida manda al login y recuerda a dónde iba', () => {
    cy.visit('/dashboard')

    cy.location('pathname').should('eq', '/login')
    cy.location('search').should('eq', '?redirect=/dashboard')
  })

  it('el login rechaza credenciales inválidas sin sacar al usuario de la página', () => {
    mockApi({ loginStatus: 422, errorBody: { message: 'Credenciales inválidas.' } })

    cy.visit('/login')
    cy.get('input[type="email"]').type('cliente@test.local')
    cy.get('#password').type('mala-contrasena')
    cy.contains('button', 'Ingresar').click()

    cy.contains('Las credenciales no son válidas.').should('be.visible')
    cy.location('pathname').should('eq', '/login')
  })

  it('un cliente con el perfil completo entra al dashboard', () => {
    mockApi({ user: makeUser({ profile_complete: true }) })

    cy.visit('/login')
    cy.get('input[type="email"]').type('cliente@test.local')
    cy.get('#password').type('password')
    cy.contains('button', 'Ingresar').click()

    cy.location('pathname').should('eq', '/dashboard')
  })

  it('el login declara la plataforma web para recibir un token de web', () => {
    // barber da a cada plataforma su propia vigencia de token (config/auth.php); si la web dejara
    // de declararla, caería en la inferencia por device_name.
    mockApi({ user: makeUser({ profile_complete: true }) })

    cy.visit('/login')
    cy.get('input[type="email"]').type('cliente@test.local')
    cy.get('#password').type('password')
    cy.contains('button', 'Ingresar').click()

    cy.wait('@login').its('request.body').should('deep.include', {
      plataforma: 'web',
      device_name: 'Nuxt Web',
    })
  })
})
