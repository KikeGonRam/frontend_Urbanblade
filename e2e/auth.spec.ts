import { expect, test } from "@playwright/test";

import { makeUser, mockApi } from "./support/api-mock";

/**
 * Fase 6: recorridos críticos de sesión sobre el BUILD DE PRODUCCIÓN.
 * Cubre los guards de ruta (auth/guest), el login por correo con sus errores
 * reales del backend, el acceso con Google y — lo que motivó la corrección de
 * esta fase — el gate de "perfil incompleto", que antes solo respetaba el
 * camino de Google.
 */

test("una ruta protegida manda al login y recuerda a dónde iba", async ({
  page,
}) => {
  await page.goto("/dashboard");

  await expect(page).toHaveURL("/login?redirect=/dashboard");
});

test("el login rechaza credenciales inválidas sin sacar al usuario de la página", async ({
  page,
}) => {
  await mockApi(page, {
    loginStatus: 422,
    errorBody: { message: "Credenciales inválidas." },
  });

  await page.goto("/login");
  await page.getByLabel("Correo").fill("cliente@test.local");
  await page.locator("#password").fill("mala-contrasena");
  await page.getByRole("button", { name: "Ingresar" }).click();

  await expect(page.getByText("Las credenciales no son válidas.")).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});

test("un cliente con el perfil completo entra al dashboard", async ({
  page,
}) => {
  await mockApi(page, { user: makeUser({ profile_complete: true }) });

  await page.goto("/login");
  await page.getByLabel("Correo").fill("cliente@test.local");
  await page.locator("#password").fill("password");
  await page.getByRole("button", { name: "Ingresar" }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
});

/**
 * Regresión de la corrección de Fase 6: antes, `login()` mandaba siempre a
 * /dashboard sin mirar profile_complete. Como el registro por correo nunca
 * pide teléfono ni fecha de nacimiento (los dos datos que
 * User::profileCompletion() exige a un cliente en barber), esos usuarios
 * entraban con el perfil incompleto y nada volvía a pedírselo — solo el
 * callback de Google respetaba el gate.
 */
test("un cliente con el perfil incompleto va a completarlo, no al dashboard", async ({
  page,
}) => {
  await mockApi(page, {
    user: makeUser({
      profile_complete: false,
      profile_missing: ["telefono", "fecha_nacimiento"],
    }),
  });

  await page.goto("/login");
  await page.getByLabel("Correo").fill("cliente@test.local");
  await page.locator("#password").fill("password");
  await page.getByRole("button", { name: "Ingresar" }).click();

  await expect(page).toHaveURL(/\/complete-profile$/);
});

test("el registro por correo lleva directo a completar el perfil", async ({
  page,
}) => {
  await mockApi(page, {
    user: makeUser({
      profile_complete: false,
      profile_missing: ["telefono", "fecha_nacimiento"],
    }),
  });

  await page.goto("/register");
  await page.locator("#name").fill("Cliente Prueba");
  await page.locator("#email").fill("nuevo@test.local");
  await page.locator("#password").fill("Password123!");
  await page.locator("#password_confirmation").fill("Password123!");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Crear mi cuenta" }).click();

  await expect(page).toHaveURL(/\/complete-profile$/);
});

test("el acceso con Google apunta al redirect del backend", async ({
  page,
}) => {
  await page.goto("/login");

  const google = page.getByRole("link", { name: /Continuar con Google/i });
  await expect(google).toHaveAttribute("href", /\/auth\/google\/redirect$/);
});

test("un usuario ya autenticado no se queda en el login", async ({
  page,
  context,
}) => {
  await mockApi(page);
  await context.addCookies([
    {
      name: "ub_token",
      value: "test-token",
      url: "http://127.0.0.1:3100",
    },
  ]);

  await page.goto("/login");

  await expect(page).toHaveURL(/\/dashboard$/);
});
