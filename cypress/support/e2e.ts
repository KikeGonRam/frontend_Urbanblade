// Se carga antes de cada prueba (supportFile de cypress.config.ts).
// Los datos simulados y los interceptores de la API viven en api-mock.ts.
// El banner de cookies taparía botones: se parte de una visita que ya rechazó la analítica.
beforeEach(() => {
  cy.setCookie('ub_consent', 'rejected')
})

export {}
