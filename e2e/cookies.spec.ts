import { request as httpRequest } from "node:http";

import { expect, test } from "@playwright/test";

import { mockApi } from "./support/api-mock";

/**
 * Consentimiento de cookies: hasta que la persona acepta, no se carga Google Tag Manager ni
 * Microsoft Clarity, y Stripe solo se carga al abrir un pago. Parte de un contexto limpio (sin la
 * cookie ub_consent que usa el resto de la suite).
 */
test.use({ storageState: { cookies: [], origins: [] } });

const TERCEROS = /googletagmanager\.com|clarity\.ms|google-analytics\.com|js\.stripe\.com|m\.stripe/;

function vigilar(page: import("@playwright/test").Page) {
  const pedidas: string[] = [];
  page.on("request", (r) => {
    if (TERCEROS.test(r.url())) pedidas.push(r.url());
  });
  return pedidas;
}

test("la primera visita muestra el banner y no contacta a terceros", async ({ page, context }) => {
  await mockApi(page);
  const pedidas = vigilar(page);

  await page.goto("/");
  await expect(page.getByTestId("cookie-banner")).toBeVisible();
  await page.waitForLoadState("networkidle");

  expect(pedidas, "se contactó a terceros sin consentimiento").toEqual([]);
  const cookies = await context.cookies();
  expect(cookies.map((c) => c.name).filter((n) => /^_clck|^_clsk|^_ga|^__stripe/.test(n))).toEqual([]);
});

test("rechazar conserva la elección y no carga analítica", async ({ page, context }) => {
  await mockApi(page);
  const pedidas = vigilar(page);

  await page.goto("/");
  await page.getByTestId("cookie-reject").click();
  await expect(page.getByTestId("cookie-banner")).toBeHidden();
  expect((await context.cookies()).find((c) => c.name === "ub_consent")?.value).toBe("rejected");

  await page.reload();
  await page.waitForLoadState("networkidle");
  await expect(page.getByTestId("cookie-banner")).toBeHidden();
  expect(pedidas).toEqual([]);
});

test("aceptar carga Google Tag Manager y las preferencias permiten cambiar de opinión", async ({ page, context }) => {
  await mockApi(page);
  // El contenedor real no se descarga: basta ver que la página lo pide tras aceptar.
  await page.route(/googletagmanager\.com/, (route) =>
    route.fulfill({ status: 200, contentType: "application/javascript", body: "" }),
  );
  const pedidas = vigilar(page);

  await page.goto("/");
  await page.getByTestId("cookie-accept").click();
  await expect.poll(() => pedidas.some((u) => u.includes("googletagmanager.com/gtm.js"))).toBe(true);
  expect((await context.cookies()).find((c) => c.name === "ub_consent")?.value).toBe("accepted");

  await page.getByTestId("cookie-prefs").click();
  await expect(page.getByTestId("cookie-banner")).toBeVisible();
});

test("el aviso de privacidad describe las cookies de analítica y tiene ancla", async ({ page }) => {
  await mockApi(page);
  await page.goto("/privacidad");

  const seccion = page.locator("#cookies");
  await expect(seccion).toBeVisible();
  await expect(page.locator("article")).toContainText("Microsoft Clarity");
  await expect(page.locator("article")).not.toContainText("no usa cookies de publicidad ni herramientas de rastreo");
});

test("las páginas públicas declaran su dirección canónica y los errores llevan HSTS", async ({ page, request }) => {
  await mockApi(page);
  await page.goto("/privacidad");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/privacidad$/);

  const error = await request.get("/esta-ruta-no-existe-xyz");
  expect(error.status()).toBe(404);
  expect(error.headers()["strict-transport-security"]).toContain("max-age=");
});

test("la web solo acepta GET, HEAD y OPTIONS y rechaza rutas malformadas con 404", async ({ request }) => {
  for (const metodo of ["put", "patch", "delete", "post"] as const) {
    const res = await request[metodo]("/");
    expect(res.status(), `${metodo.toUpperCase()} / debe dar 405`).toBe(405);
    expect(res.headers()["allow"]).toContain("GET");
  }

  // Se pide con http crudo: el cliente de Playwright trataría «//host» como una URL absoluta.
  const crudo = (ruta: string) =>
    new Promise<number>((resolve, reject) => {
      const req = httpRequest({ host: "127.0.0.1", port: 3100, path: ruta }, (res) => {
        res.resume();
        resolve(res.statusCode ?? 0);
      });
      req.on("error", reject);
      req.end();
    });
  for (const ruta of ["//evil.example/%2e%2e", "//evil.example", "/%5cevil"]) {
    expect(await crudo(ruta), `GET ${ruta}`).toBe(404);
  }

  expect((await request.get("/")).status()).toBe(200);
});

test("security.txt cumple el RFC 9116 (contacto y vencimiento)", async ({ request }) => {
  const res = await request.get("/.well-known/security.txt");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("text/plain");

  const texto = await res.text();
  expect(texto).toMatch(/^Contact: mailto:.+@.+/m);
  const vence = /^Expires: (.+)$/m.exec(texto)?.[1];
  expect(vence, "falta Expires").toBeTruthy();
  expect(new Date(vence!).getTime()).toBeGreaterThan(Date.now());
});
