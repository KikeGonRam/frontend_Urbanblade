import { expect, test, type Page } from "@playwright/test";
import { BARBER_DASHBOARD, CLIENT_DASHBOARD } from "./support/dashboard-fixtures";

/** Dashboards de barbero y cliente con el kit: mismos datos de /dashboard, presentados con claridad. */
async function open(page: Page, role: string, dashboard: unknown, from: string) {
  await page.context().addCookies([{ name: "ub_token", value: "t", url: "http://127.0.0.1:3100" }]);
  await page.route("**/api/v1/auth/me", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user: { id: "u", name: `${role} Prueba`, email: "u@t.l", avatar_url: null, roles: [role], profile_complete: true, profile_missing: [], client_id: role === "cliente" ? "c-1" : null, barber_id: role === "barbero" ? "b-1" : null },
      }),
    }),
  );
  await page.route("**/api/v1/dashboard", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(dashboard) }));
  await page.goto(from);
  await page.locator('a[href="/dashboard"]:visible').first().click();
}

test("el barbero aprueba solicitudes y ve su semana en español", async ({ page }) => {
  await open(page, "barbero", BARBER_DASHBOARD, "/notifications");
  const status = page.waitForRequest((r) => r.url().includes("/appointments/UB-9/status") && r.method() === "PATCH");
  await page.route("**/api/v1/appointments/UB-9/status", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));

  await expect(page.getByRole("heading", { name: "Esperando tu aprobación" })).toBeVisible();
  await expect(page.getByText("4.8 ★")).toBeVisible();
  await expect(page.getByText("Siguiente")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Tu semana" })).toBeVisible();

  await page.getByRole("button", { name: "Aprobar" }).click();
  expect((await status).postDataJSON()).toEqual({ estado: "confirmada" });
});

test("el cliente ve su próxima cita con su estado, puntos y visitas", async ({ page }) => {
  await open(page, "cliente", CLIENT_DASHBOARD, "/notifications");

  const cita = page.getByRole("article", { name: "Tu próxima cita" });
  await expect(cita.getByText("Combo Corte + Barba")).toBeVisible();
  await expect(cita.getByText("Confirmada")).toBeVisible();
  await expect(page.getByText("Te faltan 2 visitas para V.I.P")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Tus visitas" })).toBeVisible();
  await expect(page.getByText("Arreglo de Barba", { exact: true })).toBeVisible();
});
