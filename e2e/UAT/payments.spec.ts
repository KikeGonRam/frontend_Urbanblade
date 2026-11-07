import { expect, test, type Page } from "@playwright/test";
import { makeUser, mockApi } from "../support/api-mock";

/** Staff con una cita cobrable de $300; lo demás lo pone cada prueba. */
async function prepararCobro(page: Page, puntosDisponibles: number) {
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
        puntos_disponibles: puntosDisponibles,
        premio_rifa: null,
      }] }),
    }),
  );

  let paymentBody: Record<string, unknown> | undefined;
  await page.route("**/api/v1/payments", async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    paymentBody = route.request().postDataJSON();
    await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ message: "ok" }) });
  });

  return { getPaymentBody: () => paymentBody };
}

/** Entra como staff, abre «Nuevo cobro» y elige la cita preparada. */
async function abrirCobro(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Correo").fill("staff@test.local");
  await page.locator("#password").fill("password");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.getByRole("button", { name: /Operación/ }).click();
  await page.getByRole("link", { name: "Pagos", exact: true }).click();
  await expect(page).toHaveURL(/\/payments$/);

  await page.getByRole("button", { name: /Nuevo cobro/i }).click();
  await page.locator("select").filter({ has: page.locator("option[value='appt-1']") }).selectOption("appt-1");
}

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

  const { getPaymentBody } = await prepararCobro(page, 20);

  let intentBody: Record<string, unknown> | undefined;
  await page.route("**/api/v1/payments/stripe-intent", async (route) => {
    intentBody = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: { client_secret: "pi_secret_e2e" } }),
    });
  });

  await abrirCobro(page);
  // Método de pago como tarjetas del kit (role="radio"), mismo valor "tarjeta".
  await page.getByRole("radio", { name: /^Tarjeta/ }).click();
  await page.getByRole("button", { name: "Cobrar con tarjeta" }).click();

  await expect.poll(() => intentBody).toEqual({ appointment_id: "appt-1", puntos_canjeados: 0 });
  await expect.poll(() => getPaymentBody()?.stripe_payment_id).toBe("pi_e2e_confirmed");
  expect(getPaymentBody()?.monto).toBe(300);
});

test("al cobrar en efectivo se pueden agregar productos y viajan en el cobro", async ({ page }) => {
  const { getPaymentBody } = await prepararCobro(page, 0);
  await page.route("**/api/v1/products", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: [{ id: "prod-1", nombre: "Cera mate", precio_venta: 120, imagen: null, stock_actual: 4 }] }),
    }),
  );

  await abrirCobro(page);

  await page.getByRole("button", { name: "Agregar" }).click();
  await expect(page.getByRole("button", { name: "Agregado ✓" })).toBeVisible();
  // 300 del servicio + 120 del producto.
  await expect(page.getByText("$420")).toBeVisible();

  await page.getByRole("button", { name: "Confirmar y cerrar servicio" }).click();

  await expect.poll(() => getPaymentBody()?.productos).toEqual([{ product_id: "prod-1", cantidad: 1 }]);
});
