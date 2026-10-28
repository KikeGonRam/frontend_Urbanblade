import { expect, test, type Page } from "@playwright/test";

/**
 * Ficha 360 del cliente (/clients/[slug]).
 *
 * GET /admin/clients/{slug} ya devolvía historial, gasto, promedio, última
 * visita y barbero preferido, pero ninguna pantalla los mostraba: /clients
 * era solo alta/edición/baja. Nivel, puntos y notas del staff se agregaron a
 * esa respuesta para esta pantalla.
 */

const DETAIL = {
  data: {
    id: "c-1",
    slug: "cliente-prueba",
    name: "Cliente Prueba",
    email: "cliente@test.local",
    telefono: "7220000000",
    segment: "vip",
    nivel: "oro",
    puntos: 120,
    notas: "Alérgico al after shave con alcohol.",
    joinedAt: "2026-01-10T10:00:00+00:00",
    totalAppointments: 2,
    totalSpent: 430,
    averageSpent: 215,
    lastAppointment: "2026-09-01",
    daysSinceLastAppointment: 10,
    preferredBarber: "Nava Panther",
    appointments: [
      {
        id: "a-1",
        code: "UB-1",
        fecha: "2026-09-01",
        hora_inicio: "10:00:00",
        barber: "Nava Panther",
        service: "Corte clásico",
        precio: 180,
        estado: "completada",
      },
      {
        id: "a-2",
        code: "UB-2",
        fecha: "2026-08-01",
        hora_inicio: "11:00:00",
        barber: "Nava Panther",
        service: "Corte y barba",
        precio: 250,
        estado: "completada",
      },
    ],
  },
};

async function asAdmin(page: Page, detail: unknown = DETAIL) {
  return asRole(page, "administrador", detail);
}

async function asRole(
  page: Page,
  rol: string,
  detail: unknown = DETAIL,
) {
  await page.context().addCookies([
    {
      name: "ub_token",
      value: "test-admin-token",
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
          name: "Usuario Prueba",
          email: "staff@test.local",
          avatar_url: null,
          roles: [rol],
          profile_complete: true,
          profile_missing: [],
          client_id: null,
          barber_id: null,
        },
      }),
    }),
  );
  await page.route("**/api/v1/admin/clients/cliente-prueba", async (route) => {
    if (route.request().method() !== "GET") return route.fallback();

    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(detail),
    });
  });
}

test("la ficha muestra lealtad, métricas reales e historial", async ({
  page,
}) => {
  await asAdmin(page);
  await page.goto("/clients/cliente-prueba");

  await expect(
    page.getByRole("heading", { name: "Cliente Prueba" }),
  ).toBeVisible();
  await expect(page.getByText("Nivel oro")).toBeVisible();
  await expect(page.getByText("120 pts")).toBeVisible();
  await expect(page.getByText("VIP")).toBeVisible();
  // Métricas que ya calculaba el backend y no se veían en ninguna parte.
  await expect(page.getByText("$430")).toBeVisible();
  await expect(page.getByText("$215")).toBeVisible();
  await expect(page.getByText("Nava Panther").first()).toBeVisible();
  // Historial completo
  await expect(page.getByText("Corte clásico")).toBeVisible();
  await expect(page.getByText("Corte y barba")).toBeVisible();
});

test("las notas del equipo se cargan y se guardan mandando null al vaciarlas", async ({
  page,
}) => {
  await asAdmin(page);

  const guardado = page.waitForRequest(
    (r) =>
      r.url().includes("/admin/clients/cliente-prueba") && r.method() === "PUT",
  );
  await page.route("**/api/v1/admin/clients/cliente-prueba", async (route) => {
    if (route.request().method() === "PUT") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
    }

    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(DETAIL),
    });
  });

  await page.goto("/clients/cliente-prueba");

  const notas = page.getByLabel("Notas del equipo sobre este cliente");
  await expect(notas).toHaveValue("Alérgico al after shave con alcohol.");

  // Vaciar debe mandar null, no "": el backend distingue borrar de "no vino".
  await notas.fill("");
  await page.getByRole("button", { name: "Guardar notas" }).click();

  expect((await guardado).postDataJSON()).toEqual({ notas: null });
});

test("un cliente sin historial lo dice en vez de mostrar una tabla vacía", async ({
  page,
}) => {
  await asAdmin(page, {
    data: {
      ...DETAIL.data,
      totalAppointments: 0,
      totalSpent: 0,
      averageSpent: 0,
      lastAppointment: null,
      daysSinceLastAppointment: null,
      preferredBarber: "N/A",
      appointments: [],
    },
  });

  await page.goto("/clients/cliente-prueba");

  await expect(page.getByText("Sin citas todavía")).toBeVisible();
});

test("un error de carga muestra el estado de error, no una ficha vacía", async ({
  page,
}) => {
  await asAdmin(page);
  await page.route("**/api/v1/admin/clients/cliente-prueba", (route) =>
    route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ message: "Error" }),
    }),
  );

  await page.goto("/clients/cliente-prueba");

  await expect(page.getByText("No se pudo cargar la ficha")).toBeVisible();
});

test("recepción entra a la ficha del cliente desde el mostrador", async ({
  page,
}) => {
  // Antes la página estaba tras middleware 'admin': el menú lateral ya
  // mostraba "Clientes" a recepción, pero el enlace los rebotaba al
  // dashboard. Ahora es 'staff' y el backend lo permite por acción
  // (authorizeCounterStaff en show/update).
  await asRole(page, "recepcionista");
  await page.goto("/clients/cliente-prueba");

  await expect(
    page.getByRole("heading", { name: "Cliente Prueba" }),
  ).toBeVisible();
  await expect(page.getByText("Nivel oro")).toBeVisible();
  await expect(
    page.getByLabel("Notas del equipo sobre este cliente"),
  ).toBeVisible();
});
