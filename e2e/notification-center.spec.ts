import { expect, test } from '@playwright/test'
import { mockApi } from './support/api-mock'

test('el sidebar abre el centro de notificaciones sin una campana duplicada en el header', async ({ page }) => {
  await mockApi(page)
  await page.route('**/api/v1/notifications', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback()

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [
          {
            id: 'n-1',
            type: 'appointment',
            data: {
              title: 'Tu cita está confirmada',
              message: 'Te esperamos hoy a las 17:00.',
              url: '/my/appointments',
            },
            read_at: null,
            created_at: new Date().toISOString(),
          },
        ],
        meta: { unread: 1 },
      }),
    })
  })
  await page.context().addCookies([
    { name: 'ub_token', value: 'test-token', url: 'http://127.0.0.1:3100' },
  ])

  await page.goto('/dashboard')
  const trigger = page.getByRole('button', { name: 'Notificaciones', exact: true })
  await expect(trigger).toBeVisible()
  await expect(page.getByRole('button', { name: /Activar notificaciones push/ })).toHaveCount(0)

  await trigger.click()
  const panel = page.getByRole('dialog', { name: 'Notificaciones' })
  await expect(panel).toBeVisible()
  await expect(panel.getByText('1 sin leer')).toBeVisible()
  await expect(panel.getByText('Tu cita está confirmada')).toBeVisible()
  await expect(panel.getByRole('link', { name: 'Ver todas las notificaciones' })).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(panel).toBeHidden()
  await expect(trigger).toBeFocused()
})
