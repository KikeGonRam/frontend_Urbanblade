/**
 * Humo sobre el bundle de producción: que las páginas públicas rendericen de verdad tras
 * `nuxt build` (no solo en `nuxt dev`) y muestren lo que responde la API simulada.
 */
describe('Humo sobre el build de producción', () => {
  it('la landing renderiza y ofrece iniciar sesión y reservar', () => {
    cy.visit('/', {
      onBeforeLoad(win) {
        cy.spy(win.console, 'error').as('consoleError')
      },
    })

    cy.title().should('match', /UrbanBlade/i)
    cy.contains('a', 'Acceso').should('be.visible')
    // El enlace lleva un ícono y espacios dentro: se compara el texto sin ellos.
    cy.contains('a', /^\s*Reservar\s*$/).should('be.visible')
    cy.get('@consoleError').should('not.have.been.called')
  })

  it('las páginas legales públicas cargan', () => {
    cy.visit('/privacidad')
    cy.get('h1').first().should('be.visible')

    cy.visit('/terminos')
    cy.get('h1').first().should('be.visible')
  })

  it('el catálogo público muestra los servicios que devuelve la API', () => {
    cy.visit('/servicios')

    cy.contains('Corte clásico').should('be.visible')
  })
})
