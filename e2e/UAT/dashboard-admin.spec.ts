import { expect, test, type Page } from "@playwright/test";
import { ADMIN_DASHBOARD } from "../support/dashboard-fixtures";

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
  // Las gráficas se dibujan al entrar en pantalla (para que su animación se vea).
  await page.getByRole("heading", { name: "Ingresos por semana" }).scrollIntoViewIfNeeded();
  await expect(page.locator("canvas").first()).toBeVisible();
});

test("tocar una cita de hoy abre su detalle completo en una ventana", async ({ page }) => {
  await page.route("**/api/v1/appointments/UB-A1", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          code: "UB-A1",
          fecha: "2026-09-26",
          hora_inicio: "10:00:00",
          hora_fin: "10:30:00",
          estado: "completada",
          notas: "Prefiere el degradado bajo",
          precio_cobrado: 180,
          propina_sugerida: 20,
          deposito_requerido: false,
          deposito_monto: null,
          deposito_estado: null,
          client: { id: "c1", user: { name: "Carlos Ruiz", avatar_url: null } },
          barber: { id: "b1", slug: "nava", user: { name: "Nava Panther" }, foto_url: null },
          service: { id: "s1", nombre: "Corte Clásico", precio: 180, duracion_min: 30 },
          contacto: { email: "carlos@example.com", telefono: "55 1111 2222" },
          pagos: [{ metodo_pago: "tarjeta", estado: "completado", monto: 180, propina: 20, fecha: "2026-09-26T16:40:00Z" }],
          creada_en: "2026-09-24T15:00:00Z",
        },
      }),
    }),
  );
  await openAdminDashboard(page);

  await page.getByRole("button", { name: "Ver detalle de la cita de Carlos Ruiz" }).first().click();

  const detalle = page.getByRole("dialog");
  await expect(detalle.getByRole("heading", { name: "Corte Clásico" })).toBeVisible();
  await expect(detalle.getByText("carlos@example.com")).toBeVisible();
  await expect(detalle.getByText("Prefiere el degradado bajo")).toBeVisible();
  await expect(detalle.getByText("Tarjeta")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(detalle).toBeHidden();
});

test("«Lo que dicen tus datos» va plegada al final y se abre al tocarla", async ({ page }) => {
  await openAdminDashboard(page);

  const datos = page.getByRole("button", { name: /Lo que dicen tus datos/ });
  await expect(datos).toHaveAttribute("aria-expanded", "false");
  await datos.click();
  await expect(datos).toHaveAttribute("aria-expanded", "true");
});

test("una cita confirmada muestra su estado en lugar de un guion", async ({ page }) => {
  await openAdminDashboard(page);

  await expect(page.getByText("Confirmada").first()).toBeVisible();
});
