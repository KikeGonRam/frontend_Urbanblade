import { expect, test } from '@playwright/test'
import { EXPERIENCE_ROLES, isClientExperience, primaryRole } from '../app/utils/userExperience'
import { clientAppointmentHint } from '../app/utils/clientAppointmentHint'
import { makeUser, mockApi } from './support/api-mock'

test('los cinco roles y cuentas mixtas seleccionan la misma experiencia que API y Android', () => {
  for (const role of EXPERIENCE_ROLES) {
    expect(primaryRole(['cliente', role])).toBe(role)
    expect(primaryRole([role, 'cliente'])).toBe(role)
  }
  expect(primaryRole(['barbero', 'recepcionista'])).toBe('recepcionista')
  expect(primaryRole(['ingeniero', 'barbero'])).toBe('barbero')
  expect(isClientExperience(['cliente', 'ingeniero'])).toBe(false)
  expect(primaryRole(['desconocido'])).toBe('guest')
  expect(primaryRole([])).toBe('guest')
})

for (const role of EXPERIENCE_ROLES) {
  test(`Cuenta conserva etiquetas completas y acceso por teclado para ${role}`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 812 })
    await mockApi(page, { user: makeUser({ roles: [role], profile_complete: true }) })
    await page.goto('/login', { waitUntil: 'domcontentloaded' })
    await page.getByLabel('Correo').fill('cliente@test.local')
    await page.locator('#password').fill('password')
    await page.getByRole('button', { name: 'Ingresar' }).click()
    await expect(page).toHaveURL(/\/dashboard$/)
    await page.goto('/profile', { waitUntil: 'domcontentloaded' })
    const sections = page.getByRole('navigation', { name: 'Secciones del perfil' })
    await expect(sections).toBeVisible()
    await expect(page.getByRole('button', { name: 'Asistente Virtual', exact: true })).toBeHidden()

    for (const theme of ['noir', 'acero', 'salon', 'libreta']) {
      await page.evaluate(value => {
        document.documentElement.dataset.theme = value
        document.documentElement.style.fontSize = '200%'
      }, theme)
      const controlsFit = await sections.getByRole('button').evaluateAll(buttons => buttons.every(button => {
        const bounds = button.getBoundingClientRect()
        const labels = [...button.querySelectorAll('strong, small')]
        return bounds.height >= 48 && bounds.left >= 0 && bounds.right <= window.innerWidth
          && labels.every(label => label.scrollWidth <= label.clientWidth)
      }))
      expect(controlsFit, `${role} / ${theme} / 320 px / texto 200%`).toBe(true)
      if (role === 'cliente') await sections.screenshot({ path: `test-results/cuenta-${theme}-320-texto-200.png` })
    }

    const security = sections.getByRole('button', { name: /Seguridad/ })
    await security.focus()
    await security.press('Enter')
    await expect(security).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByLabel('Nueva contraseña', { exact: true })).toBeVisible()
  })
}

test('el aviso de pago depende de la confirmación del servidor, no del estado de cita', () => {
  expect(clientAppointmentHint('confirmada', true)).toContain('pago resuelto')
  expect(clientAppointmentHint('confirmada', false)).toContain('Resuelve el pago')
  expect(clientAppointmentHint('confirmada')).toContain('Consulta el estado')
  expect(clientAppointmentHint('cancelada', true)).toBeUndefined()
})

test('cliente dispone de cuatro accesos y reserva con el asistente compartido', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await mockApi(page, { user: makeUser({ profile_complete: true }) })
  await page.goto('/login', { waitUntil: 'domcontentloaded' })
  await page.getByLabel('Correo').fill('cliente@test.local')
  await page.locator('#password').fill('password')
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  const nav = page.getByRole('navigation', { name: 'Navegación principal' })
  await expect(nav.getByRole('link')).toHaveCount(4)
  await nav.getByRole('link', { name: 'Reservar', exact: true }).click()
  await expect(page).toHaveURL(/\/my\/reservar$/)
  await expect(page.getByRole('heading', { name: 'Reservar', exact: true })).toBeVisible()
  await nav.getByRole('link', { name: 'Cuenta', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Tu actividad' })).toBeVisible()
  await expect(page.getByRole('link', { name: /Mis facturas/ }).last()).toBeVisible()
})
