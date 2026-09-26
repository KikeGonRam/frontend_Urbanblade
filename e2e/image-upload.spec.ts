import { expect, test, type Page, type Request } from "@playwright/test";

/**
 * Las imágenes del catálogo se eligen del dispositivo, no se pegan como URL.
 *
 * Antes servicios, productos y barberos pedían "URL de imagen": el dueño no
 * tiene dónde alojar la foto, y en productos el backend solo acepta archivo,
 * así que el campo ni siquiera podía funcionar. Ahora se manda multipart; al
 * editar va como POST con _method=PUT porque PHP no lee archivos de un PUT.
 */

// PNG 1x1 válido.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

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

function multipartText(request: Request): string {
  return request.postDataBuffer()?.toString("latin1") ?? "";
}

test("el servicio se edita eligiendo la imagen del dispositivo", async ({ page }) => {
  await asAdmin(page);
  await page.route("**/api/v1/services/manage/corte-clasico", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ message: "ok", data: {} }),
    }),
  );

  await page.goto("/services");
  await page.getByRole("button", { name: "Editar" }).first().click();

  // Ya no hay campo de URL; se ve la imagen guardada y el botón para cambiarla.
  const form = page.getByRole("dialog", { name: "Formulario de servicio" });
  await expect(form.getByPlaceholder(/https:/)).toHaveCount(0);
  await expect(form.getByText("Cambiar imagen")).toBeVisible();

  await form
    .locator("#service-imagen")
    .setInputFiles({ name: "fade.png", mimeType: "image/png", buffer: PNG });
  await expect(form.getByRole("button", { name: "Descartar" })).toBeVisible();

  const saved = page.waitForRequest(
    (r) => r.url().includes("/services/manage/corte-clasico") && r.method() === "POST",
  );
  await form.getByRole("button", { name: "Guardar servicio" }).click();

  const body = multipartText(await saved);
  expect(body).toContain('name="_method"');
  expect(body).toContain("PUT");
  expect(body).toContain('name="imagen"; filename="fade.png"');
});

test("una imagen demasiado pesada se rechaza antes de enviarla", async ({ page }) => {
  await asAdmin(page);
  await page.goto("/services");
  await page.getByRole("button", { name: /Nuevo Servicio/ }).click();

  const form = page.getByRole("dialog", { name: "Formulario de servicio" });
  await form.locator("#service-imagen").setInputFiles({
    name: "enorme.png",
    mimeType: "image/png",
    buffer: Buffer.alloc(3 * 1024 * 1024),
  });

  await expect(form.getByRole("alert")).toHaveText("La imagen pesa más de 2 MB.");
  await expect(form.getByText("Elegir imagen")).toBeVisible();
});

test("la foto del barbero se sube como archivo y sin foto nueva no se manda", async ({ page }) => {
  await asAdmin(page);
  const requests: Request[] = [];
  await page.route("**/api/v1/barbers/manage/nava-panther", (route) => {
    requests.push(route.request());
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ message: "ok", data: {} }),
    });
  });

  await page.goto("/barbers/manage");
  const dialog = page.getByRole("dialog", { name: "Editar barbero" });

  // Sin elegir foto: el campo no viaja y el servidor conserva la actual.
  await page.getByRole("button", { name: "Editar" }).first().click();
  await dialog.getByRole("button", { name: /Guardar/ }).click();
  await expect.poll(() => requests.length).toBe(1);
  expect(multipartText(requests[0]!)).not.toContain('name="foto"');

  await page.getByRole("button", { name: "Editar" }).first().click();
  await dialog
    .locator("#barber-foto")
    .setInputFiles({ name: "nava.png", mimeType: "image/png", buffer: PNG });
  await dialog.getByRole("button", { name: /Guardar/ }).click();
  await expect.poll(() => requests.length).toBe(2);
  expect(requests[1]!.method()).toBe("POST");
  expect(multipartText(requests[1]!)).toContain('name="foto"; filename="nava.png"');
});
