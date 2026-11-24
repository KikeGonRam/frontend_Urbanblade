import { expect, test, type Page } from "@playwright/test";
import { ADMIN_DASHBOARD, CLIENT_DASHBOARD } from "../support/dashboard-fixtures";

/**
 * Rediseño de navegación (nov-2026), tras apagar los módulos que no se usaban: el personal ve los mismos grupos
 * que «Más» en la app Android, «Citas» incluye el calendario (selector «Lista | Calendario») y el cliente tiene
 * cinco entradas; carrito, pedidos, recibos, lista de espera y barberos se abren desde su pantalla.
 */
const NINGUNO = { packages: false, gift_cards: false, referrals: false, raffles: false, social: false, campaigns: false };
const ADMIN = { id: "u", name: "Admin Prueba", email: "a@t.l", avatar_url: null, roles: ["administrador"], profile_complete: true, profile_missing: [], client_id: null, barber_id: null };
const CLIENTE = { id: "c", name: "Cliente Prueba", email: "c@t.l", avatar_url: null, roles: ["cliente"], profile_complete: true, profile_missing: [], client_id: "c-1", barber_id: null };

async function prepare(page: Page, user: typeof ADMIN, dashboard: unknown) {
  await page.context().addCookies([{ name: "ub_token", value: "t", url: "http://127.0.0.1:3100" }]);
  await page.route("**/api/v1/auth/me", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ user }) }));
  await page.route("**/api/v1/dashboard", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(dashboard) }));
  await page.route("**/api/v1/barbershop", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { nombre: "UrbanBlade", features: NINGUNO } }) }));
  await page.route("**/api/v1/appointments/calendar-data**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
}

const menu = (page: Page) => page.getByRole("navigation", { name: "Navegación principal" });

test("el administrador ve los grupos de la app y una sola entrada para la agenda", async ({ page }) => {
  await prepare(page, ADMIN, ADMIN_DASHBOARD);
  await page.goto("/dashboard");

  for (const grupo of ["Clientes", "Caja", "Inventario", "Equipo y catálogo", "Análisis", "Sistema"]) {
    await expect(menu(page).getByRole("button", { name: new RegExp(`^${grupo}`) })).toBeVisible();
  }
  await expect(menu(page).locator('a[href="/appointments"]')).toHaveCount(1);
  await expect(menu(page).locator('a[href="/appointments/calendar"]')).toHaveCount(0);
});

test("la agenda del personal cambia entre lista y calendario sin salir de «Citas»", async ({ page }) => {
  await prepare(page, ADMIN, ADMIN_DASHBOARD);
  await page.goto("/dashboard");
  await menu(page).getByRole("link", { name: "Citas", exact: true }).click();
  await expect(page).toHaveURL(/\/appointments$/);

  const vista = page.getByRole("navigation", { name: "Vista de la agenda" });
  await expect(vista.getByRole("link", { name: "Lista" })).toHaveAttribute("aria-current", "page");
  await vista.getByRole("link", { name: "Calendario" }).click();

  await expect(page).toHaveURL(/\/appointments\/calendar$/);
  await expect(page.getByRole("heading", { name: /Calendario de/ })).toBeVisible();
  // «Citas» sigue marcada en el menú: el calendario es una vista de la misma entrada.
  await expect(menu(page).locator('a[href="/appointments"]')).toHaveAttribute("aria-current", "page");
});

test("el cliente tiene cinco entradas y abre lo demás desde sus pantallas", async ({ page }) => {
  await prepare(page, CLIENTE, CLIENT_DASHBOARD);
  await page.goto("/dashboard");

  for (const nombre of ["Inicio", "Mis citas", "Tienda", "Membresía"]) {
    await expect(menu(page).getByRole("link", { name: nombre, exact: true })).toBeVisible();
  }
  for (const href of ["/cart", "/my/orders", "/my/invoices", "/waitlist", "/equipo"]) {
    await expect(menu(page).locator(`a[href="${href}"]`)).toHaveCount(0);
  }

  await menu(page).getByRole("link", { name: "Mis citas", exact: true }).click();
  await expect(page).toHaveURL(/\/my\/appointments$/);
  const relacionados = page.getByRole("navigation", { name: "Más sobre tus citas" });
  await expect(relacionados.getByRole("link", { name: /Lista de espera/ })).toHaveAttribute("href", "/waitlist");
  await expect(relacionados.getByRole("link", { name: /Mis recibos/ })).toHaveAttribute("href", "/my/invoices");
  await expect(relacionados.getByRole("link", { name: /Nuestros barberos/ })).toHaveAttribute("href", "/equipo");

  await menu(page).getByRole("link", { name: "Tienda", exact: true }).click();
  await expect(page).toHaveURL(/\/store$/);
  await expect(page.getByRole("link", { name: "Mis pedidos" })).toHaveAttribute("href", "/my/orders");
});
