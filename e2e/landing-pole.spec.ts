import { expect, test, type Page } from "@playwright/test";

import { mockApi } from "./support/api-mock";

/**
 * TT39 (HT-16): poste de barbería 3D en el hero de la portada. Solo aparece en pantallas
 * de 1280 px o más; en pantallas chicas o con movimiento reducido three.js ni se descarga.
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

test("en escritorio el hero muestra el poste 3D sin errores de consola", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await mockApi(page);
  await page.goto("/");

  const pole = page.getByTestId("hero-pole");
  await expect(pole).toHaveAttribute("aria-hidden", "true");
  await expect(pole.locator("canvas")).toBeVisible();
  await expect(pole).toHaveClass(/opacity-100/);
  // El texto y los botones del hero siguen siendo lo que se puede usar.
  await expect(page.getByRole("link", { name: /Agendar Cita Premium/ })).toBeVisible();
  expect(errors).toEqual([]);
});

test("en móvil no se descarga three.js ni se dibuja el poste", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const scripts = collectScripts(page);
  await mockApi(page);
  await page.goto("/");
  await page.waitForLoadState("load");
  await page.waitForTimeout(2500);

  await expect(page.getByTestId("hero-pole")).toBeHidden();
  await expect(page.locator("canvas")).toHaveCount(0);
  expect(await downloadedThree(scripts)).toBe(false);
});

test("con movimiento reducido el hero queda sin poste", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 900 });
  const scripts = collectScripts(page);
  await mockApi(page);
  await page.goto("/");
  await page.waitForLoadState("load");
  await page.waitForTimeout(2500);

  await expect(page.getByTestId("hero-pole").locator("canvas")).toHaveCount(0);
  expect(await downloadedThree(scripts)).toBe(false);
});
