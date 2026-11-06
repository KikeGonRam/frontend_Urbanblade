import { expect, test } from "@playwright/test";

/*
 * Fase 4 del plan de mejora de la interfaz: las páginas públicas no deben desbordar a 320 px (iPhone SE, el ancho
 * más estrecho que aún se usa) y las pantallas de acceso deben tener el landmark <main> (WCAG 1.3.1 y 2.4.1).
 */
const PUBLICAS = ["/", "/equipo", "/reservar", "/servicios"];

for (const ruta of PUBLICAS) {
  test(`${ruta} no tiene scroll horizontal a 320 px`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto(ruta, { waitUntil: "networkidle" });

    const { scroll, client } = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth,
    }));
    expect(scroll).toBeLessThanOrEqual(client);
  });
}

for (const ruta of ["/login", "/register", "/forgot-password"]) {
  test(`${ruta} tiene un único <main>`, async ({ page }) => {
    await page.goto(ruta, { waitUntil: "networkidle" });

    await expect(page.locator("main")).toHaveCount(1);
  });
}
