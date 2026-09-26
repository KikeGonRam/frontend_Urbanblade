import { expect, test, type Page } from "@playwright/test";
import { ADMIN_DASHBOARD } from "./support/dashboard-fixtures";

/**
 * Dashboard del administrador con el kit (skill urbanblade-ui-kit, fase 2): KPIs con variación,
 * gráficas principales a la vista y estados de cita con etiqueta (antes "confirmada" salía "—").
 * Los datos son los mismos de GET /dashboard; solo cambia cómo se presentan.
 */
async function openAdminDashboard(page: Page) {
  await page.context().addCookies([{ name: "ub_token", value: "t", url: "http://127.0.0.1:3100" }]);
  await page.route("**/api/v1/auth/me", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user: { id: "u", name: "Admin Prueba", email: "a@t.l", avatar_url: null, roles: ["administrador"], profile_complete: true, profile_missing: [], client_id: null, barber_id: null },
      }),
    }),
  );
  await page.route("**/api/v1/dashboard", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(ADMIN_DASHBOARD) }),
  );
  // Se entra por una página sin datos y se navega del lado del cliente: en SSR page.route no aplica.
  await page.goto("/services");
  await page.locator('a[href="/dashboard"]:visible').first().click();
}

test("los KPIs muestran valor y variación contra el mes pasado", async ({ page }) => {
  await openAdminDashboard(page);

  const resumen = page.getByRole("region", { name: "Resumen" });
  await expect(resumen.getByText("Ingresos de hoy")).toBeVisible();
  await expect(resumen.getByText("$2,340")).toBeVisible();
  await expect(resumen.getByText("12.5%")).toBeVisible();
  await expect(resumen.getByText("4.2%")).toBeVisible();
  await expect(page.getByRole("link", { name: /3 productos con stock bajo/ })).toHaveAttribute("href", "/inventory/products");
});

test("las gráficas principales están a la vista sin abrir la analítica", async ({ page }) => {
  await openAdminDashboard(page);

  await expect(page.getByRole("heading", { name: "Ingresos por semana" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Servicios más pedidos" })).toBeVisible();
  await expect(page.locator("canvas").first()).toBeVisible();
});

test("una cita confirmada muestra su estado en lugar de un guion", async ({ page }) => {
  await openAdminDashboard(page);

  await expect(page.getByText("Confirmada").first()).toBeVisible();
});
