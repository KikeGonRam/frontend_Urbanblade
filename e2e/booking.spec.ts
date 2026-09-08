import { expect, test, type Page } from "@playwright/test";

/**
 * "Reserva" es uno de los recorridos críticos que pide la Fase 6, y hasta
 * ahora no se podía probar porque no existía: el backend sí acepta que un
 * cliente cree su propia cita (AppointmentController::store() tiene una rama
 * explícita para el rol cliente), pero el frontend solo exponía la creación
 * en la página de staff. /my/appointments únicamente reagendaba y cancelaba,
 * y la ficha del barbero era un callejón sin salida.
 *
 * Los catálogos (barberos/servicios) los sirve el mock de SSR
 * (e2e/support/mock-api.mjs); aquí solo se intercepta el POST, que es lo que
 * cambia entre una prueba y otra.
 */

async function asLoggedInClient(page: Page) {
  await page.context().addCookies([
    { name: "ub_token", value: "test-token", url: "http://127.0.0.1:3100" },
  ]);
}

/**
 * El shell del dashboard tiene sus propios <select> (el selector de tema
 * entre ellos), así que hay que acotar al formulario del modal: un
 * page.locator("select").first() global apunta al tema, no al barbero.
 */
function bookingForm(page: Page) {
  return page.locator("form").filter({ hasText: "Barbero" });
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

test("un cliente puede reservar su propia cita", async ({ page }) => {
  await asLoggedInClient(page);
  await mockCreate(page, 201, { message: "Cita creada correctamente." });

  await page.goto("/my/appointments");
  await page.getByRole("button", { name: "Reservar nueva cita" }).click();
  await expect(
    page.getByRole("heading", { name: "Reservar cita" }),
  ).toBeVisible();

  const created = page.waitForRequest(
    (request) =>
      request.url().includes("/api/v1/appointments") &&
      request.method() === "POST",
  );

  const form = bookingForm(page);
  await form.locator("select").first().selectOption("b-1");
  await form.locator("select").nth(1).selectOption("s-1");
  // La hora ahora sale de los horarios disponibles que calcula el backend
  // (AvailabilityController::slots()), no de un input libre.
  await form.locator("select").nth(2).selectOption("10:00");
  await form.getByRole("button", { name: "Reservar", exact: true }).click();

  const body = (await created).postDataJSON();
  expect(body.barber_id).toBe("b-1");
  expect(body.service_id).toBe("s-1");
  expect(body.hora_inicio).toBe("10:00");
  // El backend deriva el cliente del token; mandar client_id sería ignorado.
  expect(body.client_id).toBeUndefined();
});

test("reservar desde la ficha del barbero lo llega preseleccionado", async ({
  page,
}) => {
  await asLoggedInClient(page);

  await page.goto("/barbers/nava-panther");
  await page.getByRole("link", { name: /Reservar con/ }).click();

  await expect(page).toHaveURL(/\/my\/appointments\?barber=b-1$/);
  await expect(
    page.getByRole("heading", { name: "Reservar cita" }),
  ).toBeVisible();
  await expect(bookingForm(page).locator("select").first()).toHaveValue("b-1");
});

test("un choque de horario muestra el motivo real del backend", async ({
  page,
}) => {
  await asLoggedInClient(page);
  // Mismo 422 que devuelve AppointmentController::store() cuando el índice
  // único de Fase 3 rechaza el slot.
  await mockCreate(page, 422, {
    message: "El barbero ya tiene una cita en ese horario.",
  });

  await page.goto("/my/appointments?barber=b-1");
  await expect(
    page.getByRole("heading", { name: "Reservar cita" }),
  ).toBeVisible();

  const form = bookingForm(page);
  await form.locator("select").nth(1).selectOption("s-1");
  // La hora ahora sale de los horarios disponibles que calcula el backend
  // (AvailabilityController::slots()), no de un input libre.
  await form.locator("select").nth(2).selectOption("10:00");
  await form.getByRole("button", { name: "Reservar", exact: true }).click();

  await expect(
    page.getByText("El barbero ya tiene una cita en ese horario."),
  ).toBeVisible();
});

/**
 * AvailabilityController::slots() existía desde hace tiempo sin que lo
 * consumiera nadie: el formulario pedía la hora con un <input type="time">
 * a ciegas y el cliente solo se enteraba de que estaba ocupada al recibir el
 * 422. Estas dos pruebas fijan que ahora las horas salen del backend.
 */
test("las horas ofrecidas salen de la disponibilidad del backend", async ({
  page,
}) => {
  await asLoggedInClient(page);
  await page.route("**/api/v1/availability/slots*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        slots: [{ time: "16:30", label: "4:30 PM", end_time: "17:00" }],
      }),
    }),
  );

  await page.goto("/my/appointments?barber=b-1");
  const form = bookingForm(page);
  await form.locator("select").nth(1).selectOption("s-1");

  const horas = form.locator("select").nth(2);
  await expect(horas.locator("option[value='16:30']")).toHaveText("4:30 PM");
  // Solo el hueco libre y el placeholder: nada de horas inventadas.
  await expect(horas.locator("option")).toHaveCount(2);
});

test("un día sin huecos lo dice en vez de dejar elegir cualquier hora", async ({
  page,
}) => {
  await asLoggedInClient(page);
  await page.route("**/api/v1/availability/slots*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ slots: [] }),
    }),
  );

  await page.goto("/my/appointments?barber=b-1");
  const form = bookingForm(page);
  await form.locator("select").nth(1).selectOption("s-1");

  const horas = form.locator("select").nth(2);
  await expect(horas).toBeDisabled();
  await expect(horas).toContainText("Sin horarios libres");
});
