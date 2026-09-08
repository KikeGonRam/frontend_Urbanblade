import { expect, test } from "@playwright/test";
import { makeUser, mockApi } from "./support/api-mock";

test("el cobro con tarjeta conserva el contrato seguro con Stripe", async ({ page }) => {
  await page.addInitScript(() => {
    const card = { mount: () => {}, unmount: () => {}, on: () => {} };
    (window as unknown as { Stripe: (key: string) => unknown }).Stripe = () => ({
      elements: () => ({ create: () => card }),
      confirmCardPayment: async () => ({
        paymentIntent: { id: "pi_e2e_confirmed", status: "succeeded" },
      }),
    });
  });

  const staff = makeUser({ roles: ["recepcionista"], client_id: null });
  await mockApi(page, { user: staff });

  await page.route("**/api/v1/appointments/chargeable", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: [{
        id: "appt-1",
        fecha: "2026-09-10",
        client_name: "Cliente E2E",
        service_name: "Corte clásico",
        precio: 300,
        nivel: "nuevo",
        nivel_label: "Caballero",
        nivel_pct: 0,
        puntos_disponibles: 20,
        premio_rifa: null,
      }] }),
    }),
  );

  let intentBody: Record<string, unknown> | undefined;
  await page.route("**/api/v1/payments/stripe-intent", async (route) => {
    intentBody = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: { client_secret: "pi_secret_e2e" } }),
    });
  });

  let paymentBody: Record<string, unknown> | undefined;
  await page.route("**/api/v1/payments", async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    paymentBody = route.request().postDataJSON();
    await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ message: "ok" }) });
  });

  await page.goto("/login");
  await page.getByLabel("Correo").fill("staff@test.local");
  await page.locator("#password").fill("password");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.getByRole("button", { name: /Operación/ }).click();
  await page.getByRole("link", { name: "Pagos", exact: true }).click();
  await expect(page).toHaveURL(/\/payments$/);

  await page.getByRole("button", { name: /Nuevo cobro/i }).click();
  await page.locator("select").filter({ has: page.locator("option[value='appt-1']") }).selectOption("appt-1");
  await page.getByRole("button", { name: "Tarjeta" }).click();
  await page.getByRole("button", { name: "Cobrar con tarjeta" }).click();

  await expect.poll(() => intentBody).toEqual({ appointment_id: "appt-1", puntos_canjeados: 0 });
  await expect.poll(() => paymentBody?.stripe_payment_id).toBe("pi_e2e_confirmed");
  expect(paymentBody?.monto).toBe(300);
});
