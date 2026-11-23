import { expect, test, type Page } from "@playwright/test";
import { ADMIN_DASHBOARD, CLIENT_DASHBOARD } from "../support/dashboard-fixtures";

/**
 * Interruptores de módulos (auditoría de funciones, nov-2026). GET /barbershop trae `features`; con un módulo
 * apagado (así vienen en producción/staging) el backend no tiene sus rutas, así que la web no debe mostrarlo:
 * ni en el menú ni en enlaces, y escribir la URL a mano manda a /dashboard (middleware 'feature').
 */
const TODOS = { packages: true, gift_cards: true, referrals: true, raffles: true, social: true, campaigns: true };
const NINGUNO = { packages: false, gift_cards: false, referrals: false, raffles: false, social: false, campaigns: false };

const ADMIN = { id: "u", name: "Admin Prueba", email: "a@t.l", avatar_url: null, roles: ["administrador"], profile_complete: true, profile_missing: [], client_id: null, barber_id: null };
const CLIENTE = { id: "c", name: "Cliente Prueba", email: "c@t.l", avatar_url: null, roles: ["cliente"], profile_complete: true, profile_missing: [], client_id: "c-1", barber_id: null };

/** Rutas que, con su módulo apagado, deben mandar al dashboard. */
const RUTAS_ADMIN = ["/packages", "/gift-cards", "/raffles", "/campaigns", "/social/feed", "/admin/moderacion"];

async function prepare(page: Page, user: typeof ADMIN, dashboard: unknown, features: Record<string, boolean>) {
  await page.context().addCookies([{ name: "ub_token", value: "t", url: "http://127.0.0.1:3100" }]);
  await page.route("**/api/v1/auth/me", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ user }) }));
  await page.route("**/api/v1/dashboard", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(dashboard) }));
  await page.route("**/api/v1/barbershop", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { nombre: "UrbanBlade", features } }) }));
}

/** Entra al dashboard y espera a que los interruptores ya estén cargados (si no, "no se ve" sería trivial). */
async function openDashboard(page: Page) {
  const barbershop = page.waitForResponse((r) => r.url().includes("/api/v1/barbershop"));
  await page.goto("/dashboard");
  await barbershop;
  await expect(page.locator('a[href="/reports"]:visible, a[href="/membership"]:visible').first()).toBeVisible();
}

test("con todos los módulos apagados el menú del administrador no los muestra", async ({ page }) => {
  await prepare(page, ADMIN, ADMIN_DASHBOARD, NINGUNO);
  await openDashboard(page);

  for (const href of ["/packages", "/gift-cards", "/raffles", "/campaigns", "/social/feed", "/admin/moderacion"]) {
    await expect(page.locator(`a[href="${href}"]`)).toHaveCount(0);
  }
  // Lo que no se apaga sigue en el menú: membresía, reportes, logs y estado del servidor.
  for (const href of ["/admin/membership-plans", "/reports", "/logs", "/system"]) {
    await expect(page.locator(`a[href="${href}"]`).first()).toBeAttached();
  }
});

for (const ruta of RUTAS_ADMIN) {
  test(`con los módulos apagados, escribir ${ruta} manda al dashboard`, async ({ page }) => {
    await prepare(page, ADMIN, ADMIN_DASHBOARD, NINGUNO);
    await page.goto(ruta);

    await expect(page).toHaveURL(/\/dashboard$/);
  });
}

test("con los módulos encendidos el menú del administrador los muestra", async ({ page }) => {
  await prepare(page, ADMIN, ADMIN_DASHBOARD, TODOS);
  await openDashboard(page);

  for (const href of ["/packages", "/gift-cards", "/raffles", "/campaigns", "/social/feed", "/admin/moderacion"]) {
    await expect(page.locator(`a[href="${href}"]`).first()).toBeAttached();
  }
});

test("el cliente con los módulos apagados solo ve Membresía en Beneficios y /referrals redirige", async ({ page }) => {
  await prepare(page, CLIENTE, CLIENT_DASHBOARD, NINGUNO);
  await openDashboard(page);

  for (const href of ["/packages", "/gift-cards", "/referrals", "/social/feed"]) {
    await expect(page.locator(`a[href="${href}"]`)).toHaveCount(0);
  }
  await expect(page.locator('a[href="/membership"]').first()).toBeAttached();

  await page.goto("/referrals");
  await expect(page).toHaveURL(/\/dashboard$/);
});
