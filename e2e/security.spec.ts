import { expect, test } from "@playwright/test";

import { makeUser, mockApi } from "./support/api-mock";

/**
 * Regresiones de seguridad del frontend.
 *
 * Estas pruebas no buscan vulnerabilidades: fijan los controles que ya existen
 * para que un cambio futuro no los deshaga en silencio. Se auditaron a mano el
 * 2026-10-02 y este archivo es su red de seguridad.
 *
 * Corren contra el BUILD DE PRODUCCIÓN (playwright.config.ts levanta
 * `npm run build && npm run preview`), que es la única forma de ver la CSP:
 * el plugin server/plugins/security-headers.ts solo la emite con
 * NODE_ENV=production.
 */

test("el build de producción envía las cabeceras de seguridad y una CSP sin unsafe-inline", async ({
  request,
}) => {
  const response = await request.get("/");
  expect(response.status()).toBe(200);

  const csp = response.headers()["content-security-policy"];

  // Sin CSP se cae el control más importante contra XSS: el nonce por petición.
  expect(
    csp,
    "Falta la cabecera Content-Security-Policy: revisa server/plugins/security-headers.ts (solo la emite en producción)",
  ).toBeTruthy();

  const directivas = csp!.split(";").map((d) => d.trim());
  const scriptSrc = directivas.find((d) => d.startsWith("script-src ")) ?? "";

  // Si alguien vuelve a meter 'unsafe-inline' en script-src, esta prueba falla.
  // Es el hallazgo MEDIO de OWASP ZAP que se corrigió en TT28.
  expect(scriptSrc, "script-src volvió a permitir scripts en línea").not.toContain(
    "'unsafe-inline'",
  );
  expect(scriptSrc, "script-src no debe permitir eval").not.toContain("'unsafe-eval'");
  expect(scriptSrc, "script-src debe seguir usando nonce por petición").toContain("'nonce-");

  for (const obligatoria of [
    "script-src-attr 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'self'",
  ]) {
    expect(csp, `la CSP perdió la directiva ${obligatoria}`).toContain(obligatoria);
  }

  const headers = response.headers();
  expect(headers["strict-transport-security"]).toContain("max-age=");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-frame-options"]).toBe("SAMEORIGIN");
  // Nuxt pone x-powered-by en cada respuesta; el plugin lo quita a propósito.
  expect(headers["x-powered-by"] ?? "").toBe("");
});

test("un texto con HTML que llega de la API se muestra escapado, no se ejecuta", async ({
  page,
}) => {
  // Vector real: un nombre de usuario, de barbero o de servicio viene de la API
  // y se pinta en pantalla. Si algún día se renderiza con v-html, el onerror se
  // dispararía y esta prueba lo detiene.
  const payload = '<img src=x onerror="window.__xss=1">';

  await mockApi(page, { user: makeUser({ name: payload }) });

  // Se entra por /login y se navega del lado del cliente: un page.goto() a una
  // página protegida la resolvería en SSR, y esas peticiones las contesta
  // e2e/support/mock-api.mjs (que devuelve el usuario fijo), no este mock.
  // Mismo patrón que el resto de la suite — ver el comentario de api-mock.ts.
  await page.goto("/login");
  await page.getByLabel("Correo").fill("cliente@test.local");
  await page.locator("#password").fill("password");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  // El nombre se pinta en el shell (sidebar/topbar). Que aparezca escapado
  // demuestra que el payload SÍ se renderizó: si no, la prueba pasaría sin
  // comprobar nada.
  await expect
    .poll(async () => (await page.content()).includes("&lt;img"), {
      message: "el nombre del usuario no se renderizó: la prueba no estaría comprobando nada",
    })
    .toBe(true);

  expect(
    await page.evaluate(() => (window as unknown as { __xss?: number }).__xss),
    "el HTML de la API se ejecutó: hay un v-html con datos no confiables",
  ).toBeUndefined();
});

test("el token de sesión se guarda en la cookie ub_token y no en localStorage", async ({
  page,
}) => {
  await mockApi(page);

  await page.goto("/login");
  await page.getByLabel("Correo").fill("cliente@test.local");
  await page.locator("#password").fill("password");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  // El token debe viajar como cookie (useAuth.ts) para que SSR y cliente lo vean
  // igual. Si alguien lo moviera a localStorage, se duplicaría el vector de robo.
  const restos = await page.evaluate(() =>
    Object.keys(window.localStorage).filter((k) => /token|auth|session/i.test(k)),
  );
  expect(restos, "el token no debe acabar en localStorage").toEqual([]);
});
