import { expect, test, type Page } from "@playwright/test";

/**
 * Gestión de cita por el enlace del recordatorio (/cita/[code]?t=...).
 *
 * Antes el recordatorio mandaba a /my/appointments, detrás de middleware
 * ['auth','client']: quien no recordaba su contraseña no entraba, y eso
 * termina en no-show. Aquí no hay sesión: autoriza el token de la cita.
 */

const CITA = {
  data: {
    code: "UB-9001",
    fecha: "2026-09-20",
    hora_inicio: "16:30:00",
    estado: "confirmada",
    servicio: "Corte clásico",
    duracion_min: 30,
    precio: 180,
    barbero: "Nava Panther",
    barber_id: "b-1",
    service_id: "s-1",
    politica_horas: 24,
    puede_gestionar: true,
    dentro_de_politica: true,
  },
};

async function mockCita(page: Page, data: unknown = CITA) {
  await page.route("**/api/v1/appointments/UB-9001/manage**", async (route) => {
    const url = route.request().url();
    if (url.includes("/manage/")) return route.fallback();

    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(data),
    });
  });
}

test("un cliente sin sesión ve su cita desde el enlace", async ({ page }) => {
  await mockCita(page);
  await page.goto("/cita/UB-9001?t=token-de-prueba");

  await expect(page.getByText("Corte clásico")).toBeVisible();
  await expect(page.getByText("Nava Panther")).toBeVisible();
  await expect(page.getByText("UB-9001")).toBeVisible();
  await expect(page.getByRole("button", { name: "Mover mi cita" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancelar cita" })).toBeVisible();
});

test("cancelar pide confirmación antes de hacerlo", async ({ page }) => {
  await mockCita(page);
  const cancelado = page.waitForRequest(
    (r) => r.url().includes("/manage/cancel") && r.method() === "POST",
  );
  await page.route("**/api/v1/appointments/UB-9001/manage/cancel**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ message: "ok", data: CITA.data }),
    }),
  );

  await page.goto("/cita/UB-9001?t=token-de-prueba");
  await page.getByRole("button", { name: "Cancelar cita" }).click();

  // Acción irreversible: no se dispara con un solo toque.
  await expect(page.getByRole("heading", { name: "¿Cancelar tu cita?" })).toBeVisible();
  await page.getByRole("button", { name: "Sí, cancelar" }).click();

  // El token viaja en la query, nunca en el cuerpo.
  expect((await cancelado).url()).toContain("t=token-de-prueba");
});

test("fuera de la ventana de política no se ofrecen acciones, se explica", async ({
  page,
}) => {
  await mockCita(page, {
    data: { ...CITA.data, dentro_de_politica: false },
  });

  await page.goto("/cita/UB-9001?t=token-de-prueba");

  await expect(
    page.getByText(
      "Los cambios se hacen con al menos 24 horas de anticipación.",
      { exact: false },
    ),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancelar cita" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Mover mi cita" })).toHaveCount(0);
});

test("un enlace inválido lo dice en términos del cliente", async ({ page }) => {
  await page.route("**/api/v1/appointments/UB-9001/manage**", (route) =>
    route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ message: "Not found" }),
    }),
  );

  await page.goto("/cita/UB-9001?t=token-vencido");

  await expect(page.getByText("Este enlace ya no es válido")).toBeVisible();
});

test("mover la cita ofrece horarios reales del backend", async ({ page }) => {
  await mockCita(page);
  await page.route("**/api/v1/availability/slots**", (route) =>
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

  const movido = page.waitForRequest(
    (r) => r.url().includes("/manage/reschedule") && r.method() === "POST",
  );
  await page.route("**/api/v1/appointments/UB-9001/manage/reschedule**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ message: "ok", data: CITA.data }),
    }),
  );

  await page.goto("/cita/UB-9001?t=token-de-prueba");
  await page.getByRole("button", { name: "Mover mi cita" }).click();
  await page.getByRole("button", { name: "Hoy" }).click();
  await page.getByRole("button", { name: "10:00" }).click();
  await page.getByRole("button", { name: "Confirmar nuevo horario" }).click();

  // Solo fecha y hora: el enlace no permite cambiar barbero ni servicio.
  expect((await movido).postDataJSON()).toEqual({
    fecha: expect.any(String),
    hora_inicio: "10:00",
  });
});

test("una cita ya cerrada invita a reservar de nuevo", async ({ page }) => {
  await mockCita(page, {
    data: { ...CITA.data, estado: "cancelada", puede_gestionar: false },
  });

  await page.goto("/cita/UB-9001?t=token-de-prueba");

  await expect(
    page.getByText("Esta cita ya no se puede modificar desde aquí."),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Reservar una nueva cita" }),
  ).toBeVisible();
});
