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

  await panel.getByRole("radio", { name: /Cliente/ }).click();
  await expect(panel.getByLabel("Teléfono")).toBeVisible();
  await expect(panel.getByLabel("Especialidades")).toHaveCount(0);

  await panel.getByRole("radio", { name: /Barbero/ }).click();
  await expect(panel.getByLabel("Especialidades")).toBeVisible();
  await expect(panel.getByLabel("Teléfono")).toHaveCount(0);

  await panel.getByRole("radio", { name: /Recepción/ }).click();
  await expect(panel.getByLabel("Teléfono")).toHaveCount(0);
  await expect(panel.getByLabel("Especialidades")).toHaveCount(0);
});

test("un cliente nuevo se da de alta con su teléfono en una sola llamada", async ({ page }) => {
  await prepararUsuarios(page);
  const panel = page.getByRole("dialog", { name: "Nueva persona" });

  await panel.getByLabel("Nombre").fill("Cliente Nuevo");
  await panel.getByLabel("Email").fill("nuevo@test.local");
  await panel.getByRole("radio", { name: /Cliente/ }).click();
  await panel.getByLabel("Teléfono").fill("5551234567");
  await panel.getByLabel("Contraseña", { exact: true }).fill("password123");
  await panel.getByLabel("Confirmar contraseña").fill("password123");
  await panel.getByRole("button", { name: "Crear persona" }).click();

  await expect.poll(() => sent.clients).toEqual({
    name: "Cliente Nuevo",
    email: "nuevo@test.local",
    telefono: "5551234567",
    password: "password123",
  });
});

test("la lista de usuarios pide 10 por página, filtra por rol con chips y edita con el ícono", async ({ page }) => {
  await mockApi(page, { user: makeUser({ roles: ["administrador"], client_id: null }) });
  let ultima: URL | undefined;
  await page.route("**/api/v1/users**", async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    ultima = new URL(route.request().url());
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: [{ id: "u1", name: "Luis Prueba", email: "luis@test.local", roles: ["barbero"] }],
        meta: { current_page: 1, last_page: 1, total: 1 },
        roles: ["administrador", "recepcionista", "barbero", "cliente"],
      }),
    });
  });

  await page.goto("/login");
  await page.getByLabel("Correo").fill("admin@test.local");
  await page.locator("#password").fill("password");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.goto("/users");

  await expect.poll(() => ultima?.searchParams.get("per_page")).toBe("10");
  await page.getByRole("button", { name: "Barbero", exact: true }).click();
  await expect.poll(() => ultima?.searchParams.get("role")).toBe("barbero");

  await page.getByRole("button", { name: "Editar a Luis Prueba" }).click();
  await expect(page.getByRole("dialog", { name: "Editar persona" })).toBeVisible();
});
