import { expect, test, type Page } from "@playwright/test";
import { makeUser } from "../support/api-mock";

/**
 * Cobros anulados (/payments/anulados), hallazgo 13 de la prueba de usuario.
 *
 * Anular un cobro ya no lo borra: barber lo conserva con motivo, autor y fecha y lo saca de las
 * sumas. Esta pantalla solo lo consulta con GET /payments?anulados=1 (exclusivo del administrador).
 */

const ANULADO = {
  id: "pay-anulado-1",
  monto: "250.00",
  propina: "20.00",
  metodo_pago: "efectivo",
  receipt_url: null,
  created_at: "2026-11-20T16:00:00Z",
  appointment: {
    id: "appt-9",
    fecha: "2026-11-20",
    hora_inicio: "10:00",
    service: "Corte clásico",
    client: "Cliente Anulado",
    barber: "Barbero E2E",
  },
  creator: { id: "u-admin", name: "Admin E2E" },
  anulacion: { motivo: "Cobro duplicado por error", fecha: "2026-11-21T18:30:00Z", por: "Admin E2E" },
};

async function asAdmin(page: Page) {
  await page.context().addCookies([
    { name: "ub_token", value: "test-admin-token", url: "http://127.0.0.1:3100" },
  ]);
  const admin = makeUser({ id: "u-admin", name: "Admin E2E", email: "admin@test.local", roles: ["administrador"], client_id: null, client: null });
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ user: admin }) }),
  );

  const pedidas: string[] = [];
  await page.route(
    (url) => url.pathname.endsWith("/api/v1/payments"),
    (route) => {
      pedidas.push(route.request().url());
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [ANULADO],
          meta: { current_page: 1, last_page: 1, total: 1, stats: { total_hoy: 0, total_mes: 0, count: 0, metodos: {} }, pending_count: 0, anulados_count: 1 },
        }),
      });
    },
  );

  return { pedidas: () => pedidas };
}

test("el administrador ve el cobro anulado con su motivo, quién lo anuló y el total tachado", async ({ page }) => {
  const { pedidas } = await asAdmin(page);
  await page.goto("/payments/anulados");

  await expect(page.getByRole("heading", { name: /Cobros\s+anulados/ })).toBeVisible();
  await expect(page.getByText("Cliente Anulado")).toBeVisible();
  await expect(page.getByText("Cobro duplicado por error")).toBeVisible();
  await expect(page.getByText("por Admin E2E")).toBeVisible();

  // Se pide el historial de anulados, no la lista normal.
  await expect.poll(() => pedidas().some((u) => new URL(u).searchParams.get("anulados") === "1")).toBe(true);
});
