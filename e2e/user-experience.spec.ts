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

test('el aviso de pago depende de la confirmación del servidor, no del estado de cita', () => {
  expect(clientAppointmentHint('confirmada', true)).toContain('pago resuelto')
  expect(clientAppointmentHint('confirmada', false)).toContain('Resuelve el pago')
  expect(clientAppointmentHint('confirmada')).toContain('Consulta el estado')
  expect(clientAppointmentHint('cancelada', true)).toBeUndefined()
})

test('cliente dispone de cuatro accesos y reserva con el asistente compartido', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await mockApi(page, { user: makeUser({ profile_complete: true }) })
  await page.goto('/login')
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
