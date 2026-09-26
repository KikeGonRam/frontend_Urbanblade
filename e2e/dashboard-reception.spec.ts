import { expect, test } from "@playwright/test";
import { RECEPTION_DASHBOARD } from "./support/dashboard-fixtures";

/** Dashboard de recepción con el kit: KPIs que llevan a donde se atienden y listas legibles. */
test("recepción ve sus pendientes y cada KPI lleva a su pantalla", async ({ page }) => {
  await page.context().addCookies([{ name: "ub_token", value: "t", url: "http://127.0.0.1:3100" }]);
  await page.route("**/api/v1/auth/me", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user: { id: "u", name: "Recepción Prueba", email: "r@t.l", avatar_url: null, roles: ["recepcionista"], profile_complete: true, profile_missing: [], client_id: null, barber_id: null },
      }),
    }),
  );
  await page.route("**/api/v1/dashboard", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(RECEPTION_DASHBOARD) }),
  );
  await page.goto("/orders");
  await page.locator('a[href="/dashboard"]:visible').first().click();

  const resumen = page.getByRole("region", { name: "Resumen del turno" });
  await expect(resumen.getByRole("link", { name: /Por cobrar/ })).toHaveAttribute("href", "/payments");
  await expect(resumen.getByRole("link", { name: /Stock crítico/ })).toHaveAttribute("href", "/inventory/products");
  await expect(page.getByText("Ana Torres")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Citas por hora" })).toBeVisible();
  await expect(page.getByText("PED-0001 · Cliente Prueba")).toBeVisible();
});
