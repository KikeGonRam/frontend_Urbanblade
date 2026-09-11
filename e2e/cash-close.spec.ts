import { expect, test, type Page } from "@playwright/test";

/**
 * Corte de caja (/payments/corte).
 *
 * El dinero del día son dos fuentes: cobros de citas (Payment verificado) y
 * ventas de tienda (Order entregado), que no generan Payment. El desglose lo
 * calcula el backend; esta pantalla solo lo muestra y captura el arqueo.
 *
 * El arqueo compara únicamente el EFECTIVO: tarjeta y transferencia no pasan
 * por el cajón físico. La diferencia definitiva la calcula el servidor.
 */

const PREVIEW = {
  data: {
    fecha: "2026-09-11",
    esperado: { efectivo: 400, tarjeta: 300 },
    esperado_total: 700,
    efectivo_esperado: 400,
    propinas: 50,
    pagos: 2,
    pedidos: 1,
    cierre: null,
  },
};

async function asStaff(page: Page, preview: unknown = PREVIEW) {
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
  await page.route("**/api/v1/cash-closes/preview**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(preview),
    }),
  );
}

test("el desglose separa métodos e informa cuántos cobros y pedidos incluye", async ({
  page,
}) => {
  await asStaff(page);
  await page.goto("/payments/corte");

  await expect(page.getByRole("heading", { name: "Corte de caja" })).toBeVisible();
  // exact: "Efectivo" suelto también aparece en "Arqueo de efectivo",
  // "Efectivo contado", etc.
  await expect(page.getByText("Efectivo", { exact: true })).toBeVisible();
  await expect(page.getByText("Tarjeta", { exact: true })).toBeVisible();
  await expect(page.getByText("$700.00")).toBeVisible();
  // Deja explícito que el corte incluye tienda, no solo citas.
  await expect(
    page.getByText("2 cobro(s) de cita y 1 pedido(s) entregado(s)."),
  ).toBeVisible();
});

test("el arqueo anticipa la diferencia y manda solo el efectivo contado", async ({
  page,
}) => {
  await asStaff(page);

  const enviado = page.waitForRequest(
    (r) => r.url().includes("/api/v1/cash-closes") && r.method() === "POST",
  );
  await page.route("**/api/v1/cash-closes", (route) => {
    if (route.request().method() !== "POST") return route.fallback();

    return route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ message: "ok", data: {} }),
    });
  });

  await page.goto("/payments/corte");
  await page.getByPlaceholder("0.00").fill("340");

  // 340 contados contra 400 esperados en efectivo = faltante de 60.
  await expect(page.getByText("-$60.00")).toBeVisible();

  await page.getByRole("button", { name: "Cerrar caja del día" }).click();

  const body = (await enviado).postDataJSON();
  expect(body.efectivo_contado).toBe(340);
  // La diferencia nunca viaja desde el cliente: la recalcula el servidor.
  expect(body.diferencia).toBeUndefined();
});

test("un día ya cerrado muestra el corte en vez de ofrecer cerrarlo otra vez", async ({
  page,
}) => {
  await asStaff(page, {
    data: {
      ...PREVIEW.data,
      cierre: {
        fecha: "2026-09-11",
        esperado_total: 700,
        efectivo_esperado: 400,
        efectivo_contado: 400,
        diferencia: 0,
        notas: "Sin novedades.",
        cerrado_por_nombre: "Staff Recepción",
      },
    },
  });

  await page.goto("/payments/corte");

  await expect(page.getByRole("heading", { name: "Caja cerrada" })).toBeVisible();
  await expect(page.getByText("Cerró Staff Recepción")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Cerrar caja del día" }),
  ).toHaveCount(0);
});

test("un día sin movimientos lo dice en vez de mostrar totales en cero sueltos", async ({
  page,
}) => {
  await asStaff(page, {
    data: {
      fecha: "2026-09-11",
      esperado: {},
      esperado_total: 0,
      efectivo_esperado: 0,
      propinas: 0,
      pagos: 0,
      pedidos: 0,
      cierre: null,
    },
  });

  await page.goto("/payments/corte");

  await expect(page.getByText("Sin movimientos ese día")).toBeVisible();
});
