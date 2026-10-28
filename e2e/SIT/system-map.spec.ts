import { expect, test, type Page } from "@playwright/test";

/**
 * TT38 (HT-15): mapa del sistema en /system. La API se intercepta: Redis caído y una
 * tarea fallida para que el mapa tenga algo que señalar.
 */
const SYSTEM_STATUS = {
  app: { name: "UrbanBlade", env: "staging", laravel_version: "13.0.0", php_version: "8.3.12" },
  database: { status: "up", latency_ms: 42 },
  redis: { status: "down", latency_ms: null, error: "Connection refused" },
  queue: { connection: "database", pending: 3, failed: 0 },
  scheduled_tasks: [
    { name: "Recordatorios de citas", expression: "*/15 * * * *", status: "success", ran_at: "2026-10-04T15:00:00Z", runtime_ms: 120, error: null },
    { name: "Respaldo diario", expression: "0 3 * * *", status: "failed", ran_at: "2026-10-04T03:00:00Z", runtime_ms: 900, error: "Disco lleno" },
  ],
};

async function openSystemAsEngineer(page: Page) {
  await page.context().addCookies([{ name: "ub_token", value: "t", url: "http://127.0.0.1:3100" }]);
  await page.route("**/api/v1/auth/me", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user: { id: "u", name: "Ingeniero Prueba", email: "i@t.l", avatar_url: null, roles: ["ingeniero"], profile_complete: true, profile_missing: [], client_id: null, barber_id: null },
      }),
    }),
  );
  await page.route("**/api/v1/admin/system/status", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(SYSTEM_STATUS) }));
  await page.goto("/system");
  await expect(page.getByRole("heading", { name: "Mapa del sistema" })).toBeVisible();
}

test("el mapa del sistema señala lo caído y se recorre con teclado", async ({ page }) => {
  await openSystemAsEngineer(page);

  const list = page.getByRole("list", { name: "Componentes del sistema" });
  const detail = page.getByTestId("system-map-detail");
  await expect(page.getByText("2 componentes requieren atención")).toBeVisible();

  // Arranca en lo primero que está caído.
  await expect(list.getByRole("button", { name: /Redis/ })).toHaveAttribute("aria-pressed", "true");
  await expect(detail).toContainText("Caído");
  await expect(detail).toContainText("Connection refused");

  // Se elige otro componente solo con teclado.
  await list.getByRole("button", { name: /MongoDB/ }).focus();
  await page.keyboard.press("Enter");
  await expect(list.getByRole("button", { name: /MongoDB/ })).toHaveAttribute("aria-pressed", "true");
  await expect(detail).toContainText("42 ms de latencia");

  await list.getByRole("button", { name: /Respaldo diario/ }).click();
  await expect(detail).toContainText("Tarea programada");
  await expect(detail).toContainText("Disco lleno");

  // Con WebGL (Chromium de Playwright lo emula) se dibuja la vista 3D con sus etiquetas.
  const view = page.getByTestId("system-map-3d");
  await expect(view.locator("canvas")).toBeVisible();
  await expect(view.locator(".ub-sysmap-label", { hasText: "Respaldo diario" })).toHaveClass(/is-selected/);
});

test("un clic en un nodo de la vista 3D lo selecciona", async ({ page }) => {
  await openSystemAsEngineer(page);
  const view = page.getByTestId("system-map-3d");
  await expect(view.locator("canvas")).toBeVisible();

  // La API está en el eje de giro de la cámara: su esfera queda siempre un poco arriba
  // del centro del lienzo, aunque la escena rote sola.
  const box = await view.locator("canvas").boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2 - 12);

  await expect(page.getByRole("list", { name: "Componentes del sistema" }).getByRole("button", { name: /API/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("system-map-detail")).toContainText("Laravel 13.0.0");
});

test("con movimiento reducido no carga la vista 3D y conserva la lista", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openSystemAsEngineer(page);

  await expect(page.getByTestId("system-map-fallback")).toContainText("reducir el movimiento");
  await expect(page.getByTestId("system-map-3d")).toBeHidden();
  await expect(page.locator("canvas")).toHaveCount(0);
  await page.getByRole("button", { name: /MongoDB/ }).click();
  await expect(page.getByTestId("system-map-detail")).toContainText("42 ms de latencia");
  // La tabla de tareas de siempre sigue debajo.
  await expect(page.getByRole("cell", { name: "Respaldo diario" })).toBeVisible();
});
