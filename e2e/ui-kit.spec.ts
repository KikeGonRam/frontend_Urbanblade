import { expect, test, type Page, type Request } from "@playwright/test";

/**
 * Kit de UI (skill urbanblade-ui-kit): el interruptor y las tarjetas de método de pago cambian
 * cómo se ve el control, nunca el dato que llega al backend.
 */

async function asAdmin(page: Page) {
  await page.context().addCookies([
    { name: "ub_token", value: "test-admin-token", url: "http://127.0.0.1:3100" },
  ]);
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user: {
          id: "u-admin",
          name: "Admin Prueba",
          email: "admin@test.local",
          avatar_url: null,
          roles: ["administrador"],
          profile_complete: true,
          profile_missing: [],
          client_id: null,
          barber_id: null,
        },
      }),
    }),
  );
}

test("el interruptor se cambia con el teclado y el servicio sigue mandando activo 1/0", async ({ page }) => {
  await asAdmin(page);
  const requests: Request[] = [];
  await page.route("**/api/v1/services/manage/corte-clasico", (route) => {
    requests.push(route.request());
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ message: "ok", data: {} }) });
  });

  await page.goto("/services");
  await page.getByRole("button", { name: "Editar" }).first().click();

  const form = page.getByRole("dialog", { name: "Formulario de servicio" });
  const activo = form.getByRole("switch", { name: "Activo" });
  await expect(activo).toHaveAttribute("aria-checked", "true");

  await activo.focus();
  await page.keyboard.press("Space");
  await expect(activo).toHaveAttribute("aria-checked", "false");

  await form.getByRole("button", { name: "Guardar servicio" }).click();
  await expect.poll(() => requests.length).toBe(1);
  const body = requests[0]!.postDataBuffer()?.toString("latin1") ?? "";
  expect(body).toMatch(/name="activo"\r\n\r\n0\r\n/);
});

test("entregar un pedido elige el método con tarjetas y manda el mismo metodo_pago", async ({ page }) => {
  await asAdmin(page);
  const deliver = page.waitForRequest((r) => r.url().includes("/orders/o-1/deliver") && r.method() === "PATCH");
  await page.route("**/api/v1/orders/o-1/deliver", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ message: "ok" }) }),
  );

  await page.goto("/orders");
  await page.getByRole("button", { name: "Entregar" }).first().click();

  const metodo = page.getByRole("radiogroup", { name: "Método de pago" });
  // Solo los tres que acepta el backend (antes aparecía "QR" y respondía 422).
  await expect(metodo.getByRole("radio")).toHaveCount(3);
  await expect(metodo.getByRole("radio", { name: /Efectivo/ })).toHaveAttribute("aria-checked", "true");

  // Flecha a la derecha mueve la selección, como un radio nativo.
  await metodo.getByRole("radio", { name: /Efectivo/ }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(metodo.getByRole("radio", { name: /Transferencia/ })).toHaveAttribute("aria-checked", "true");

  await page.getByRole("button", { name: /Confirmar/ }).click();
  expect((await deliver).postDataJSON()).toEqual({ metodo_pago: "transferencia" });
});
