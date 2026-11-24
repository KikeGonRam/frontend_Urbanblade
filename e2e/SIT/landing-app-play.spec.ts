import { expect, test } from "@playwright/test";

import { mockApi } from "../support/api-mock";

/**
 * La app móvil ya está publicada en Google Play: la portada debe llevar a la ficha real de la tienda
 * (botón y QR) y no mencionar la prueba cerrada / acceso anticipado.
 */
const PLAY_URL = "https://play.google.com/store/apps/details?id=com.urbanblade.mobile";

test("la sección de la app enlaza a la ficha publicada en Google Play", async ({ page }) => {
  await mockApi(page);
  await page.goto("/");
  const section = page.locator("#app");
  await section.scrollIntoViewIfNeeded();

  await expect(section.getByRole("link", { name: "Descargar en Google Play" })).toHaveAttribute("href", PLAY_URL);
  await expect(section.getByRole("link", { name: "Abrir UrbanBlade en Google Play" })).toHaveAttribute("href", PLAY_URL);
  await expect(section.getByAltText(/Código QR para descargar la app/)).toBeVisible();
  await expect(section).not.toContainText(/prueba cerrada|acceso anticipado/i);
});
