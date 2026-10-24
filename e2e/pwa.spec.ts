import { expect, test } from "@playwright/test";

import { mockApi } from "./support/api-mock";

/**
 * PWA: la web es instalable (manifiesto + íconos) y sigue funcionando sin conexión
 * (service worker con caché de páginas y página de respaldo). Corre contra el build de
 * producción, igual que el resto de la suite.
 */

test("el manifiesto declara lo necesario para instalar la app y sus íconos existen", async ({ page, request }) => {
  await mockApi(page);
  await page.goto("/");

  const href = await page.locator('link[rel="manifest"]').getAttribute("href");
  expect(href).toBe("/manifest.webmanifest");

  const response = await request.get(href!);
  expect(response.ok()).toBe(true);
  const manifest = await response.json();

  expect(manifest.name).toBeTruthy();
  expect(manifest.short_name).toBeTruthy();
  expect(manifest.display).toBe("standalone");
  expect(manifest.start_url).toBeTruthy();
  expect(manifest.scope).toBe("/");
  const sizes = manifest.icons.map((i: { sizes: string }) => i.sizes);
  expect(sizes).toEqual(expect.arrayContaining(["192x192", "512x512"]));
  expect(manifest.icons.some((i: { purpose: string }) => i.purpose === "maskable")).toBe(true);

  for (const icon of manifest.icons) {
    const res = await request.get(icon.src);
    expect(res.ok(), icon.src).toBe(true);
    expect(res.headers()["content-type"]).toContain("image/png");
  }
});

test("sin conexión: una página ya visitada se sirve de la caché y una nueva muestra el respaldo", async ({ page, context }) => {
  await mockApi(page);

  await page.goto("/privacidad");
  await expect(page.locator("h1").first()).toBeVisible();

  // El worker se instala y toma el control de la pestaña (clients.claim).
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  // Se vuelve a visitar para que la respuesta quede guardada por el worker ya activo.
  await page.goto("/privacidad");

  await context.setOffline(true);

  await page.goto("/privacidad");
  await expect(page.locator("h1").first()).toBeVisible();

  await page.goto("/pagina-que-nunca-se-visito");
  await expect(page.getByRole("heading", { name: "Sin conexión" })).toBeVisible();

  await context.setOffline(false);
});

test("la API nunca se guarda en la caché del service worker", async ({ page }) => {
  await mockApi(page);
  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });

  const cachedApi = await page.evaluate(async () => {
    const names = await caches.keys();
    for (const name of names) {
      const keys = await (await caches.open(name)).keys();
      if (keys.some((r) => new URL(r.url).pathname.startsWith("/api/"))) return true;
    }
    return false;
  });
  expect(cachedApi).toBe(false);
});
