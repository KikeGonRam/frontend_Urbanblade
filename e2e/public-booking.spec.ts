import { expect, test, type Page } from "@playwright/test";

/**
 * Reserva pública (/reservar). El punto comercial que verifica este archivo
 * es concreto: un visitante SIN cuenta tiene que poder ver servicio, barbero
 * y horarios reales antes de que se le pida nada. Hasta el 2026-09-10 el
 * único camino para reservar era /my/appointments, detrás de middleware
 * ['auth','client'], y todos los CTA "Reservar" de la landing mandaban a
 * /register: el visitante que llegaba desde un enlace o QR chocaba con un
 * muro de registro antes de ver un solo horario.
 *
 * Los catálogos (/barbershop, /services, /barbers, /availability/slots) los
 * sirve el mock de SSR (e2e/support/mock-api.mjs); el POST, que es lo que
 * cambia entre pruebas, se intercepta con page.route().
 */

async function asLoggedInClient(page: Page) {
  await page.context().addCookies([
    { name: "ub_token", value: "test-token", url: "http://127.0.0.1:3100" },
  ]);
}

async function mockCreate(page: Page, status: number, body: unknown) {
  await page.route("**/api/v1/appointments", async (route) => {
    if (route.request().method() !== "POST") return route.fallback();

    return route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
}

test("un visitante sin cuenta llega hasta ver horarios reales", async ({
  page,
}) => {
  await page.goto("/reservar");

  // Paso 1: catálogo con precio y duración a la vista, sin pedir nada.
  await expect(
    page.getByRole("heading", { name: "1. Elige tu servicio" }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Corte clásico/ }).click();

  // Paso 2: equipo real.
  await expect(
    page.getByRole("heading", { name: "2. Elige tu barbero" }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Nava Panther/ }).click();

  // Paso 3: horarios reales del backend, todavía como anónimo.
  await expect(
    page.getByRole("heading", { name: "3. Elige día y hora" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Hoy" }).click();
  await expect(page.getByRole("button", { name: "10:00" })).toBeVisible();
  await expect(page.getByRole("button", { name: "11:00" })).toBeVisible();
});

test("la cuenta se pide solo al confirmar y conserva la selección", async ({
  page,
}) => {
  await page.goto("/reservar?servicio=s-1&barbero=b-1");

  await page.getByRole("button", { name: "Hoy" }).click();
  await page.getByRole("button", { name: "10:00" }).click();

  // Sin sesión el botón no promete confirmar todavía.
  const cta = page.getByRole("button", { name: "Continuar y confirmar" });
  await expect(cta).toBeVisible();
  await cta.click();

  // Va al login con la selección completa en ?redirect, para volver al mismo
  // punto sin que el visitante tenga que rehacer nada.
  await expect(page).toHaveURL(/\/login\?redirect=/);
  const redirect = decodeURIComponent(
    new URL(page.url()).searchParams.get("redirect") ?? "",
  );
  expect(redirect).toContain("/reservar");
  expect(redirect).toContain("servicio=s-1");
  expect(redirect).toContain("barbero=b-1");
  expect(redirect).toContain("hora=10:00");
  // getSafeRedirectUrl() (app/utils/security.ts) solo acepta rutas locales:
  // si esto dejara de ser relativo, el login descartaría la selección.
  expect(redirect.startsWith("/reservar?")).toBe(true);
});

test("un enlace profundo con servicio entra directo al paso del barbero", async ({
  page,
}) => {
  await page.goto("/reservar?servicio=s-1");

  await expect(
    page.getByRole("heading", { name: "2. Elige tu barbero" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "1. Elige tu servicio" }),
  ).toHaveCount(0);
});

test("un cliente con sesión confirma y recibe el código de su cita", async ({
  page,
}) => {
  await asLoggedInClient(page);
  await mockCreate(page, 201, {
    message: "Cita creada correctamente.",
    data: { code: "UB-4821" },
  });

  await page.goto("/reservar?servicio=s-1&barbero=b-1");
  await page.getByRole("button", { name: "Hoy" }).click();
  await page.getByRole("button", { name: "10:00" }).click();

  const created = page.waitForRequest(
    (request) =>
      request.url().includes("/api/v1/appointments") &&
      request.method() === "POST",
  );
  await page.getByRole("button", { name: "Confirmar cita" }).click();

  // El cuerpo es el que el backend espera de un cliente: sin client_id, que
  // AppointmentController::store() deriva del token.
  const body = (await created).postDataJSON();
  expect(body).toMatchObject({
    barber_id: "b-1",
    service_id: "s-1",
    hora_inicio: "10:00",
  });
  expect(body.client_id).toBeUndefined();

  await expect(
    page.getByRole("heading", { name: "Cita confirmada" }),
  ).toBeVisible();
  await expect(page.getByText("UB-4821")).toBeVisible();
});

test("un conflicto de horario muestra el motivo real del backend", async ({
  page,
}) => {
  await asLoggedInClient(page);
  // 422 real de AppointmentController: el backend es la autoridad sobre
  // conflictos (índice único parcial en Mongo), así que su mensaje se
  // muestra tal cual en vez de uno genérico.
  await mockCreate(page, 422, {
    message: "El barbero ya tiene una cita en ese horario.",
  });

  await page.goto("/reservar?servicio=s-1&barbero=b-1");
  await page.getByRole("button", { name: "Hoy" }).click();
  await page.getByRole("button", { name: "10:00" }).click();
  await page.getByRole("button", { name: "Confirmar cita" }).click();

  // El motivo tiene que sobrevivir al regreso al paso 3: al liberarse la hora
  // el asistente vuelve al selector, y un mensaje pintado dentro del paso 4
  // se desmontaba con él (el visitante volvía sin saber por qué).
  await expect(
    page.getByRole("heading", { name: "3. Elige día y hora" }),
  ).toBeVisible();
  await expect(
    page.getByRole("alert").filter({
      hasText: "El barbero ya tiene una cita en ese horario.",
    }),
  ).toBeVisible();
});
