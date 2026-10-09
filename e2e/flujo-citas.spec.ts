import { expect, test, type Page } from "@playwright/test";

import {
  apiMessage,
  canForceExtend,
  minutesLeft,
  money,
  remainingLabel,
  remainingTone,
} from "../app/utils/serviceFlow";

/**
 * Flujo de citas V2 en las pantallas: aprobar, iniciar solo con pago resuelto, cuenta regresiva del servicio, agregar
 * tiempo y ticket al terminar.
 */

test.describe("helpers del flujo de citas", () => {
  test("minutesLeft redondea hacia arriba y tolera datos vacíos", () => {
    const now = new Date("2026-10-08T10:00:00Z");
    expect(minutesLeft("2026-10-08T10:12:10Z", now)).toBe(13);
    expect(minutesLeft("2026-10-08T09:57:00Z", now)).toBe(-3);
    expect(minutesLeft(null, now)).toBeNull();
    expect(minutesLeft("no-es-fecha", now)).toBeNull();
  });

  test("remainingLabel y remainingTone", () => {
    expect(remainingLabel(12)).toBe("Quedan 12 min");
    expect(remainingLabel(1)).toBe("Termina en 1 min");
    expect(remainingLabel(0)).toBe("Termina ahora");
    expect(remainingLabel(-3)).toBe("Se pasó 3 min");
    expect(remainingLabel(null)).toBe("Sin hora de fin");
    expect(remainingTone(20)).toBe("ok");
    expect(remainingTone(4)).toBe("soon");
    expect(remainingTone(-1)).toBe("over");
    expect(remainingTone(null)).toBe("ok");
  });

  test("apiMessage, canForceExtend y money", () => {
    expect(apiMessage({ data: { message: "Pago pendiente" } }, "x")).toBe("Pago pendiente");
    expect(apiMessage({ data: {} }, "respaldo")).toBe("respaldo");
    expect(apiMessage(null, "respaldo")).toBe("respaldo");
    expect(canForceExtend({ data: { puede_forzar: true } })).toBe(true);
    expect(canForceExtend({ data: { puede_forzar: false } })).toBe(false);
    expect(canForceExtend(undefined)).toBe(false);
    expect(money(1234.5)).toBe("$1,234.50");
    expect(money("200")).toBe("$200.00");
    expect(money(null)).toBe("$0.00");
  });
});

const TICKET = {
  folio: "F-ABC123",
  cita: "UB-1",
  fecha: "2026-10-08",
  cliente: "Cliente Prueba",
  barbero: "Barbero Prueba",
  servicio: "Corte clásico",
  duracion_min: 30,
  minutos_extra: 10,
  metodo_pago: "tarjeta",
  precio_servicio: 200,
  descuentos: 0,
  deposito_aplicado: 0,
  monto: 200,
  propina: 20,
  total_pagado: 220,
  comprobante_url: "https://example.test/comprobante.pdf",
};

function cita(over: Record<string, unknown>) {
  return {
    id: "a-1",
    code: "UB-1",
    fecha: "2026-10-08",
    hora_inicio: "10:00:00",
    hora_fin: "10:30:00",
    estado: "confirmada",
    notas: null,
    client: { id: "c-1", user: { name: "Cliente Prueba" } },
    barber: { id: "b-1", user: { name: "Barbero Prueba" } },
    service: { id: "s-1", nombre: "Corte clásico" },
    pago_resuelto: null,
    puede_iniciar: null,
    motivo_no_iniciar: null,
    fin_estimado: null,
    minutos_extra: null,
    ...over,
  };
}

/** Entra como barbero: el SSR del mock es cliente, así que se navega desde una página pública con /auth/me del navegador. */
async function asBarber(page: Page, citas: unknown[]) {
  await page.context().addCookies([{ name: "ub_token", value: "t", url: "http://127.0.0.1:3100" }]);
  await page.route("**/api/v1/auth/me", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user: { id: "u-b", name: "Barbero Prueba", email: "b@t.l", avatar_url: null, roles: ["barbero"], profile_complete: true, profile_missing: [], client_id: null, barber_id: "b-1" },
      }),
    }),
  );
  await page.route("**/api/v1/barber/agenda**", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: citas, range: { label: "Hoy" }, stats: { total_period: citas.length } }),
    }),
  );
  await page.goto("/notifications");
  // El enlace al dashboard existe para todos los roles; ya con el barbero cargado se navega a la agenda sin recargar.
  await page.locator('a[href="/dashboard"]:visible').first().click();
  await page.waitForURL("**/dashboard");
  await page.waitForFunction(() => Boolean((window as unknown as { useNuxtApp?: () => { $router?: unknown } }).useNuxtApp?.().$router));
  await page.evaluate(() => (window as unknown as { useNuxtApp: () => { $router: { push: (to: string) => Promise<void> } } }).useNuxtApp().$router.push("/barber/agenda"));
  await expect(page.getByRole("heading", { name: /Agenda/ })).toBeVisible();
}

test.describe("agenda del barbero", () => {
  test("Iniciar queda bloqueado con el motivo cuando falta el pago", async ({ page }) => {
    await asBarber(page, [
      cita({ puede_iniciar: false, pago_resuelto: false, motivo_no_iniciar: "El pago de esta cita aún no está resuelto. Cóbrala en recepción." }),
    ]);

    await expect(page.getByRole("button", { name: "Iniciar" })).toBeDisabled();
    await expect(page.getByText("El pago de esta cita aún no está resuelto")).toBeVisible();
  });

  test("con el pago resuelto Iniciar manda el cambio de estado", async ({ page }) => {
    await asBarber(page, [cita({ puede_iniciar: true, pago_resuelto: true })]);
    const patch = page.waitForRequest((r) => r.url().includes("/appointments/UB-1/status") && r.method() === "PATCH");
    await page.route("**/api/v1/appointments/UB-1/status", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));

    await page.getByRole("button", { name: "Iniciar" }).click();

    expect((await patch).postDataJSON()).toEqual({ estado: "en_proceso" });
  });

  test("aprueba una cita pendiente", async ({ page }) => {
    await asBarber(page, [cita({ estado: "pendiente" })]);
    const patch = page.waitForRequest((r) => r.url().includes("/appointments/UB-1/status") && r.method() === "PATCH");
    await page.route("**/api/v1/appointments/UB-1/status", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));

    await page.getByRole("button", { name: "Aprobar" }).click();

    expect((await patch).postDataJSON()).toEqual({ estado: "confirmada" });
  });

  test("servicio en proceso: muestra el tiempo restante y agrega 10 minutos", async ({ page }) => {
    const fin = new Date(Date.now() + 12 * 60000).toISOString();
    await asBarber(page, [cita({ estado: "en_proceso", fin_estimado: fin, minutos_extra: 5 })]);
    await expect(page.getByText(/Quedan 1[12] min/)).toBeVisible();
    await expect(page.getByText("+5 min agregados")).toBeVisible();

    const extend = page.waitForRequest((r) => r.url().includes("/appointments/UB-1/extend") && r.method() === "POST");
    await page.route("**/api/v1/appointments/UB-1/extend", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
    await page.getByRole("button", { name: "+10 min" }).click();

    expect((await extend).postDataJSON()).toEqual({ minutos: 10, forzar: false });
    await expect(page.getByText("Se agregaron 10 minutos")).toBeVisible();
  });

  test("terminar el servicio muestra el ticket", async ({ page }) => {
    const fin = new Date(Date.now() + 3 * 60000).toISOString();
    await asBarber(page, [cita({ estado: "en_proceso", fin_estimado: fin })]);
    await page.route("**/api/v1/appointments/UB-1/status", (r) =>
      r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ message: "ok", data: {}, ticket: TICKET }) }),
    );

    await page.getByRole("button", { name: "Terminar ahora" }).click();

    const dialog = page.getByRole("dialog", { name: "Ticket del servicio" });
    await expect(dialog.getByText("Folio F-ABC123")).toBeVisible();
    await expect(dialog.getByText("$220.00")).toBeVisible();
    await expect(dialog.getByRole("link", { name: "Ver comprobante (PDF)" })).toBeVisible();
  });
});
