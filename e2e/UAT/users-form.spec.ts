import { expect, test, type Page } from "@playwright/test";
import { makeUser, mockApi } from "../support/api-mock";

const sent: { users?: Record<string, unknown>; clients?: Record<string, unknown> } = {};

/** Admin con el listado de usuarios simulado; devuelve lo que se mande a la API. */
async function prepararUsuarios(page: Page) {
  await mockApi(page, { user: makeUser({ roles: ["administrador"], client_id: null }) });

  await page.route("**/api/v1/users**", async (route) => {
    const req = route.request();
    if (req.method() === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [],
          meta: { current_page: 1, last_page: 1, total: 0 },
          roles: ["administrador", "recepcionista", "barbero", "cliente"],
        }),
      });
    }
    sent.users = req.postDataJSON();
    return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ message: "ok" }) });
  });
  await page.route("**/api/v1/admin/clients", async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    sent.clients = route.request().postDataJSON();
    return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ message: "ok" }) });
  });

  await page.goto("/login");
  await page.getByLabel("Correo").fill("admin@test.local");
  await page.locator("#password").fill("password");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.goto("/users");
  await page.getByRole("button", { name: /Nuevo Usuario/i }).click();
  return sent;
}

test("el formulario único muestra solo los campos del rol elegido", async ({ page }) => {
  await prepararUsuarios(page);
  const panel = page.getByRole("dialog", { name: "Nueva persona" });

  await panel.getByLabel("Rol").selectOption("cliente");
  await expect(panel.getByLabel("Teléfono")).toBeVisible();
  await expect(panel.getByLabel("Especialidades")).toHaveCount(0);

  await panel.getByLabel("Rol").selectOption("barbero");
  await expect(panel.getByLabel("Especialidades")).toBeVisible();
  await expect(panel.getByLabel("Teléfono")).toHaveCount(0);

  await panel.getByLabel("Rol").selectOption("recepcionista");
  await expect(panel.getByLabel("Teléfono")).toHaveCount(0);
  await expect(panel.getByLabel("Especialidades")).toHaveCount(0);
});

test("un cliente nuevo se da de alta con su teléfono en una sola llamada", async ({ page }) => {
  await prepararUsuarios(page);
  const panel = page.getByRole("dialog", { name: "Nueva persona" });

  await panel.getByLabel("Nombre").fill("Cliente Nuevo");
  await panel.getByLabel("Email").fill("nuevo@test.local");
  await panel.getByLabel("Rol").selectOption("cliente");
  await panel.getByLabel("Teléfono").fill("5551234567");
  await panel.getByLabel("Contraseña", { exact: true }).fill("password123");
  await panel.getByLabel("Confirmar contraseña").fill("password123");
  await panel.getByRole("button", { name: "Guardar" }).click();

  await expect.poll(() => sent.clients).toEqual({
    name: "Cliente Nuevo",
    email: "nuevo@test.local",
    telefono: "5551234567",
    password: "password123",
  });
});
