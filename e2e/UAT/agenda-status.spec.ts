import { expect, test, type Page } from "@playwright/test";

/**
 * Agenda operativa (/appointments): acciones rápidas de estado y cobro desde
 * la propia fila.
 *
 * Regresión que motivó estas pruebas: la agenda mandaba un PUT con el payload
 * completo de la cita para CUALQUIER cambio de estado, y ese endpoint valida
 * 'fecha' => after_or_equal:today. Marcar "no asistió", "completada" o incluso
 * cancelar una cita del día anterior respondía siempre 422 por la fecha, y el
 * PATCH /status —el endpoint de la máquina de estados— devolvía 403 a
 * recepción y administración. Ahora la pantalla usa el PATCH.
 */

/**
 * /appointments exige rol staff, y el usuario del mock de SSR es cliente:
 * hay que sobrescribir /auth/me en el navegador, igual que booking.spec.ts.
 */
async function asStaff(page: Page) {
  await page.context().addCookies([
    {
      name: "ub_token",
      value: "test-staff-token",
      url: "http://127.0.0.1:3100",
    },
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

/** Una cita de AYER: el caso que antes no tenía ningún camino posible. */
function pastAppointment(estado: string) {
  const ayer = new Date();
  ayer.setDate(ayer.getDate() - 1);
  const fecha = ayer.toISOString().slice(0, 10);

  return {
    data: [
      {
        id: "a-1",
        code: "UB-PAST1",
        fecha,
        hora_inicio: "10:00:00",
        hora_fin: "10:30:00",
        estado,
        notas: null,
        precio_cobrado: null,
        client: { id: "c-1", user: { name: "Cliente Prueba" } },
        barber: { id: "b-1", slug: "nava", user: { name: "Nava Panther" } },
        service: {
          id: "s-1",
          nombre: "Corte clásico",
          precio: 150,
          duracion_min: 30,
        },
      },
    ],
    meta: { total: 1 },
  };
}

async function mockAgenda(page: Page, estado: string) {
  await page.route("**/api/v1/appointments**", async (route) => {
    const url = route.request().url();
    if (route.request().method() !== "GET" || url.includes("/status"))
      return route.fallback();

    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(pastAppointment(estado)),
    });
  });
}

test("recepción marca 'no asistió' en una cita de ayer con una sola acción", async ({
  page,
}) => {
  await asStaff(page);
  await mockAgenda(page, "confirmada");

  const patch = page.waitForRequest(
    (r) => r.url().includes("/status") && r.method() === "PATCH",
  );
  await page.route("**/api/v1/appointments/*/status", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ message: "Estado actualizado correctamente." }),
    }),
  );

  await page.goto("/appointments");
  await page.getByRole("button", { name: "No asistió" }).click();

  const request = await patch;
  // Solo el estado: sin 'fecha', que es justo lo que bloqueaba el PUT.
  expect(request.postDataJSON()).toEqual({ estado: "no_asistio" });
  expect(request.url()).toContain("/appointments/UB-PAST1/status");
});

test("solo se ofrecen las transiciones válidas del estado actual", async ({
  page,
}) => {
  await asStaff(page);
  await mockAgenda(page, "pendiente");
  await page.goto("/appointments");

  // pendiente -> confirmada | cancelada
  await expect(page.getByRole("button", { name: "Confirmar" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancelar" })).toBeVisible();
  // ...y nada más: iniciar/completar/no-show no salen desde pendiente.
  await expect(page.getByRole("button", { name: "Iniciar" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Completar" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "No asistió" })).toHaveCount(0);
  // Tampoco se puede cobrar una cita pendiente (CHARGEABLE del backend).
  await expect(page.getByRole("link", { name: "Cobrar" })).toHaveCount(0);
});

test("una cita en estado terminal no ofrece acciones de estado", async ({
  page,
}) => {
  await asStaff(page);
  await mockAgenda(page, "cancelada");
  await page.goto("/appointments");

  await expect(page.getByRole("button", { name: "Editar" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancelar" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Confirmar" })).toHaveCount(0);
});

test("cobrar desde la agenda lleva a pagos con la cita preseleccionada", async ({
  page,
}) => {
  await asStaff(page);
  await mockAgenda(page, "completada");
  await page.goto("/appointments");

  await page.getByRole("link", { name: "Cobrar" }).click();

  await expect(page).toHaveURL(/\/payments\?cita=a-1/);
});

test("el motivo real del backend se muestra si la transición se rechaza", async ({
  page,
}) => {
  await asStaff(page);
  await mockAgenda(page, "confirmada");
  await page.route("**/api/v1/appointments/*/status", (route) =>
    route.fulfill({
      status: 422,
      contentType: "application/json",
      body: JSON.stringify({
        message: "No se puede pasar la cita de 'completada' a 'pendiente'.",
      }),
    }),
  );

  await page.goto("/appointments");
  await page.getByRole("button", { name: "Completar" }).click();

  await expect(
    page.getByText("No se puede pasar la cita de 'completada' a 'pendiente'."),
  ).toBeVisible();
});
