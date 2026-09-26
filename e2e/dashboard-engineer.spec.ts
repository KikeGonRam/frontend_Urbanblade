import { expect, test } from "@playwright/test";
import { ENGINEER_DASHBOARD, SYSTEM_STATUS } from "./support/dashboard-fixtures";

/** Dashboard del ingeniero con el kit: estado del sistema y módulos del negocio, solo lectura. */
test("el ingeniero ve el estado del sistema y los módulos sin datos de clientes", async ({ page }) => {
  await page.context().addCookies([{ name: "ub_token", value: "t", url: "http://127.0.0.1:3100" }]);
  await page.route("**/api/v1/auth/me", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user: { id: "u", name: "Ingeniero Prueba", email: "i@t.l", avatar_url: null, roles: ["ingeniero"], profile_complete: true, profile_missing: [], client_id: null, barber_id: null },
      }),
    }),
  );
  await page.route("**/api/v1/dashboard", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(ENGINEER_DASHBOARD) }));
  await page.route("**/api/v1/admin/system/status", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(SYSTEM_STATUS) }));
  await page.goto("/notifications");
  await page.locator('a[href="/dashboard"]:visible').first().click();

  await expect(page.getByRole("heading", { name: "Módulos del negocio" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Citas", exact: true })).toBeVisible();
  await expect(page.getByText("Lo que dicen tus datos")).toBeVisible();
  await expect(page.getByText("42")).toBeVisible();
});
