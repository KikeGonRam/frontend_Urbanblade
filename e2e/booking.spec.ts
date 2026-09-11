import { expect, test, type Page } from "@playwright/test";

/**
 * "Reserva" es uno de los recorridos críticos que pide la Fase 6. El
 * formulario original (<select> de barbero/servicio/hora dentro de un
 * <form>) se reemplazó por BookingWizard (app/components/booking/Wizard.vue),
 * el mismo componente por pasos que usa /reservar: aquí se abre embebido en
 * un modal desde /my/appointments. Estas pruebas se reescribieron para
 * interactuar con esa UI de botones en vez de <select>, conservando la misma
 * intención de cada una.
 *
 * Los catálogos (barberos/servicios) los sirve el mock de SSR
 * (e2e/support/mock-api.mjs); aquí solo se intercepta el POST o
 * /availability/slots, que es lo que cambia entre una prueba y otra.
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

test("un cliente puede reservar su propia cita", async ({ page }) => {
  await asLoggedInClient(page);
  await mockCreate(page, 201, {
    message: "Cita creada correctamente.",
    data: { code: "UB-1001" },
  });

  await page.goto("/my/appointments");
  await page.getByRole("button", { name: "Reservar nueva cita" }).click();
  await expect(
    page.getByRole("heading", { name: "Reserva tu cita" }),
  ).toBeVisible();

  // Paso 1-3: servicio, barbero (fixture de mock-api.mjs), día y hora reales.
  await page.getByRole("button", { name: /Corte clásico/ }).click();
  await page.getByRole("button", { name: /Nava Panther/ }).click();
  await page.getByRole("button", { name: "Hoy" }).click();
  await page.getByRole("button", { name: "10:00" }).click();

  const created = page.waitForRequest(
    (request) =>
      request.url().includes("/api/v1/appointments") &&
      request.method() === "POST",
  );
  await page.getByRole("button", { name: "Confirmar cita" }).click();

  const body = (await created).postDataJSON();
  expect(body.barber_id).toBe("b-1");
  expect(body.service_id).toBe("s-1");
  expect(body.hora_inicio).toBe("10:00");
  // El backend deriva el cliente del token; mandar client_id sería ignorado.
  expect(body.client_id).toBeUndefined();
  await expect(
    page.getByRole("heading", { name: "Solicitud de cita registrada" }),
  ).toBeVisible();
});

test("reservar desde la ficha del barbero salta directo al horario", async ({
  page,
}) => {
  await asLoggedInClient(page);

  await page.goto("/barbers/nava-panther");
  await page.getByRole("link", { name: /Reservar con/ }).click();

  await expect(page).toHaveURL(/\/my\/appointments\?barber=b-1$/);
  await expect(
    page.getByRole("heading", { name: "Reserva tu cita" }),
  ).toBeVisible();

  // Con el barbero ya preseleccionado (initial-barber), elegir el servicio
  // debe saltar el paso "2. Elige tu barbero" directo a "3. Elige día y hora".
  await page.getByRole("button", { name: /Corte clásico/ }).click();
  await expect(
    page.getByRole("heading", { name: "3. Elige día y hora" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "2. Elige tu barbero" }),
  ).toHaveCount(0);
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
    page.getByRole("heading", { name: "Reserva tu cita" }),
  ).toBeVisible();

  await page.getByRole("button", { name: /Corte clásico/ }).click();
  await page.getByRole("button", { name: "Hoy" }).click();
  await page.getByRole("button", { name: "10:00" }).click();
  await page.getByRole("button", { name: "Confirmar cita" }).click();

  await expect(
    page.getByRole("alert").filter({
      hasText: "El barbero ya tiene una cita en ese horario.",
    }),
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
  await page.getByRole("button", { name: /Corte clásico/ }).click();
  await page.getByRole("button", { name: "Hoy" }).click();

  // Solo el hueco libre que devolvió el backend: nada de horas inventadas.
  await expect(page.getByRole("button", { name: "16:30" })).toBeVisible();
  await expect(
    page.locator("section").filter({ hasText: "Elige día y hora" }).getByRole("button", { name: /^\d{2}:\d{2}$/ }),
  ).toHaveCount(1);
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
  await page.getByRole("button", { name: /Corte clásico/ }).click();
  await page.getByRole("button", { name: "Hoy" }).click();

  await expect(page.getByText("Sin horarios libres ese día")).toBeVisible();
});

async function asLoggedInStaff(page: Page) {
  await page.context().addCookies([
    { name: "ub_token", value: "test-staff-token", url: "http://127.0.0.1:3100" },
  ]);
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user: {
          id: "u-staff",
          name: "Staff Recepción",
          email: "staff@test.local",
          avatar_url: null,
          roles: ["recepcionista"],
          profile_complete: true,
          profile_missing: [],
          client_id: null,
          barber_id: null,
        },
      }),
    }),
  );
}

test("formulario de citas de staff ofrece sugerencias de disponibilidad sin bloquear captura", async ({
  page,
}) => {
  await asLoggedInStaff(page);
  await page.route("**/api/v1/availability/slots*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        slots: [
          { time: "10:00", label: "10:00 AM" },
          { time: "11:00", label: "11:00 AM" },
        ],
      }),
    }),
  );

  await page.goto("/appointments");
  await page.getByRole("button", { name: "+ Nueva Cita" }).click();

  const modal = page.locator("div.fixed");
  await modal.locator("select").first().selectOption("b-1");
  await modal.locator("select").nth(1).selectOption("s-1");
  await modal.locator('input[type="date"]').fill("2026-09-10");

  await expect(page.locator("#horarios-libres option")).toHaveCount(2);
  await expect(page.getByText("2 horario(s) libre(s) ese día.")).toBeVisible();

  const horaInput = modal.locator('input[type="time"]');
  await horaInput.fill("12:00");
  await expect(
    page.getByText(/Ese horario no aparece libre para este barbero/),
  ).toBeVisible();
  await expect(horaInput).toBeEnabled();
});

