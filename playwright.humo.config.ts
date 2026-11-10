import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { defineConfig, devices } from "@playwright/test";

/**
 * T075 (HT-46): prueba de humo del flujo crítico contra el sitio y la API DESPLEGADOS en staging, no contra el build
 * local con la API simulada de playwright.config.ts. Se corre a mano con `npm run test:humo`.
 *
 * Los archivos terminan en .humo.ts para que la suite normal nunca los tome: usan cuentas reales y, con
 * HUMO_PERMITIR_RESERVA=1, crean, aprueban, pagan (tarjeta de prueba de Stripe) y cancelan una cita de verdad.
 *
 * Las cuentas salen de variables de entorno HUMO_* o, si no están, de ~/.urbanblade-humo.env (fuera del
 * repositorio, nunca en git):
 *   HUMO_EMAIL / HUMO_PASSWORD               cliente de prueba
 *   HUMO_STAFF_EMAIL / HUMO_STAFF_PASSWORD   barbero, recepción o administrador que aprueba la cita
 */
// HUMO_ENTORNO=local: ensayo contra la web y la API locales (build propio en localhost:3000 y barber en Docker en el
// puerto 8000), con sus propias cuentas en ~/.urbanblade-humo-local.env. No reemplaza la corrida oficial en staging.
const LOCAL = process.env.HUMO_ENTORNO === "local";

function cargarCuentas() {
  try {
    const archivo = readFileSync(join(homedir(), LOCAL ? ".urbanblade-humo-local.env" : ".urbanblade-humo.env"), "utf8");
    for (const linea of archivo.split(/\r?\n/)) {
      const m = linea.match(/^\s*(HUMO_[A-Z_]+)\s*=\s*(.*?)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
    }
  } catch {
    // Sin archivo: la prueba lo avisa en el paso que necesita la cuenta.
  }
}
cargarCuentas();

// En local, «localhost» y no 127.0.0.1: es el único origen que el CORS de la API local acepta por defecto.
const BASE_URL = process.env.HUMO_BASE_URL ?? (LOCAL ? "http://localhost:3000" : "https://urbanblade.com.mx");

export default defineConfig({
  testDir: "./e2e/humo",
  testMatch: "**/*.humo.ts",
  fullyParallel: false,
  workers: 1,
  // Una prueba de humo no reintenta: si el flujo falla, la versión no es apta.
  retries: 0,
  // El recorrido completo incluye la app en el emulador y la espera del webhook de Stripe.
  timeout: 20 * 60_000,
  expect: { timeout: 20_000 },
  outputDir: "test-results-humo",
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report-humo" }]],
  use: {
    ...devices["Desktop Chrome"],
    baseURL: BASE_URL,
    locale: "es-MX",
    timezoneId: "America/Mexico_City",
    // Igual que la suite normal: se parte de una visita que ya rechazó la analítica para que el banner de
    // cookies no tape botones.
    storageState: {
      cookies: [
        {
          name: "ub_consent",
          value: "rejected",
          domain: new URL(BASE_URL).hostname,
          path: "/",
          expires: -1,
          httpOnly: false,
          secure: BASE_URL.startsWith("https"),
          sameSite: "Lax",
        },
      ],
      origins: [],
    },
    // Evidencia de cada corrida: capturas y video. Sin traza: la traza guarda en texto plano lo que se escribe
    // (también las contraseñas) y los tokens de sesión, y la evidencia se comparte.
    screenshot: "on",
    video: "on",
    trace: "off",
  },
});
