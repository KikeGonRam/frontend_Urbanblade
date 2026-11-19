import { expect, test, type Page } from "@playwright/test";

import { mockApi } from "../support/api-mock";

/**
 * La portada ya no lleva el poste de barbería 3D (se quitó por innecesario y por peso): el héroe es
 * foto, texto y botones. Estas pruebas evitan que three.js vuelva a descargarse en la portada pública.
 * (El mapa 3D del ingeniero sigue usando three.js, pero solo dentro del panel.)
 */

/** Junta el código de los JS que baja la página, para saber si se descargó three.js. */
function collectScripts(page: Page): Promise<string>[] {
  const bodies: Promise<string>[] = [];
  page.on("response", (response) => {
    if (response.url().includes("/_nuxt/") && response.url().endsWith(".js")) bodies.push(response.text().catch(() => ""));
  });
  return bodies;
}

async function downloadedThree(bodies: Promise<string>[]): Promise<boolean> {
  return (await Promise.all(bodies)).some((code) => code.includes("WebGLRenderer"));
}

for (const viewport of [{ name: "escritorio", width: 1440, height: 900 }, { name: "móvil", width: 390, height: 844 }]) {
  test(`en ${viewport.name} la portada no dibuja un canvas 3D ni descarga three.js`, async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const scripts = collectScripts(page);
    await mockApi(page);
    await page.goto("/");
    await page.waitForLoadState("load");
    await page.waitForTimeout(2500);

    // Lo que sí se usa: el titular y el botón de reservar.
    await expect(page.getByRole("link", { name: /Reservar mi cita/ })).toBeVisible();
    await expect(page.getByTestId("hero-pole")).toHaveCount(0);
    await expect(page.locator("canvas")).toHaveCount(0);
    expect(await downloadedThree(scripts)).toBe(false);
    expect(errors).toEqual([]);
  });
}
