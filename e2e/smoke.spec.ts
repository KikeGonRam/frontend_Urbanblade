import { expect, test } from "@playwright/test";

import { mockApi } from "./support/api-mock";

/**
 * Humo sobre el bundle de producción: que las páginas públicas rendericen de
 * verdad tras `nuxt build` (no solo en `nuxt dev`) y que no lleguen errores
 * de consola. Esta fase existe justamente porque ya nos pasó dos veces que
 * algo se veía bien en dev y estaba roto en el build real.
 */

test("la landing renderiza y ofrece iniciar sesión", async ({ page }) => {
  await mockApi(page);

  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/");

  await expect(page).toHaveTitle(/UrbanBlade/i);
  await expect(
    page.getByRole("link", { name: "Acceso" }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Reservar", exact: true }).first(),
  ).toBeVisible();
  expect(consoleErrors).toEqual([]);
});

test("las páginas legales públicas cargan", async ({ page }) => {
  await mockApi(page);

  await page.goto("/privacidad");

  await expect(page.locator("h1").first()).toBeVisible();
});
