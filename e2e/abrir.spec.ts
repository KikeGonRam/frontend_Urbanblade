import { expect, test } from "@playwright/test";

import {
  appRouteFor,
  buildAndroidIntent,
  isAndroid,
  safeWebPath,
} from "../app/utils/appLinks";

/**
 * Enlaces inteligentes de los correos (/abrir): celular Android -> app; computadora, iPhone o ruta sin
 * equivalente en la app -> web; y nunca una redirección hacia otro dominio.
 */

const DESKTOP =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36";
const ANDROID =
  "Mozilla/5.0 (Linux; Android 14; SM-S731B) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36";
const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1";

test.describe("utilidades de enlaces", () => {
  test("solo acepta rutas internas del sitio", () => {
    expect(safeWebPath("/my/invoices")).toBe("/my/invoices");
    expect(safeWebPath("/reservar?servicio=1")).toBe("/reservar?servicio=1");
    expect(safeWebPath("//evil.com")).toBeNull();
    expect(safeWebPath("https://evil.com")).toBeNull();
    expect(safeWebPath("/\\evil.com")).toBeNull();
    expect(safeWebPath("/a\nb")).toBeNull();
    expect(safeWebPath("")).toBeNull();
    expect(safeWebPath(undefined)).toBeNull();
    expect(safeWebPath(["/my/orders", "/otra"])).toBe("/my/orders");
    expect(safeWebPath("/" + "a".repeat(400))).toBeNull();
  });

  test("traduce cada ruta web a su pantalla de la app", () => {
    expect(appRouteFor("/my/appointments")).toBe("appointments");
    expect(appRouteFor("/my/invoices")).toBe("payments");
    expect(appRouteFor("/my/orders")).toBe("orders");
    expect(appRouteFor("/reservar")).toBe("catalog");
    expect(appRouteFor("/barber/agenda")).toBe("barber_agenda");
    expect(appRouteFor("/inventory/products")).toBe("inventory");
    expect(appRouteFor("/appointments?x=1#y")).toBe("appointments");
    expect(appRouteFor("/servicios")).toBeNull();
    expect(appRouteFor("/reset-password")).toBeNull();
    expect(appRouteFor("/my/invoices-falsa")).toBeNull();
  });

  test("solo Android abre la app", () => {
    expect(isAndroid(ANDROID)).toBe(true);
    expect(isAndroid(DESKTOP)).toBe(false);
    expect(isAndroid(IPHONE)).toBe(false);
  });

  test("el intent abre la app y cae a la web si no está instalada", () => {
    const intent = buildAndroidIntent("payments", "https://urbanblade.com.mx/my/invoices");
    expect(intent).toBe(
      "intent://open?route=payments#Intent;scheme=urbanblade;package=com.urbanblade.mobile;S.browser_fallback_url=https%3A%2F%2Furbanblade.com.mx%2Fmy%2Finvoices;end",
    );
  });
});

test.describe("página /abrir", () => {
  const abrir = (ruta?: string) => (ruta === undefined ? "/abrir" : `/abrir?ruta=${encodeURIComponent(ruta)}`);

  test("en computadora redirige directo a la web", async ({ request }) => {
    const res = await request.get(abrir("/my/invoices"), {
      headers: { "user-agent": DESKTOP },
      maxRedirects: 0,
    });
    expect(res.status()).toBe(302);
    expect(new URL(res.headers().location!, "http://127.0.0.1").pathname).toBe("/my/invoices");
  });

  test("en iPhone (sin app) redirige a la web", async ({ request }) => {
    const res = await request.get(abrir("/my/invoices"), {
      headers: { "user-agent": IPHONE },
      maxRedirects: 0,
    });
    expect(res.status()).toBe(302);
    expect(new URL(res.headers().location!, "http://127.0.0.1").pathname).toBe("/my/invoices");
  });

  test("en Android con pantalla equivalente ofrece abrir la app", async ({ request }) => {
    const res = await request.get(abrir("/my/invoices"), {
      headers: { "user-agent": ANDROID },
      maxRedirects: 0,
    });
    expect(res.status()).toBe(200);
    const html = (await res.text()).replace(/&amp;/g, "&");
    expect(html).toContain("intent://open?route=payments#Intent;scheme=urbanblade;package=com.urbanblade.mobile;");
    expect(html).toContain("Abrir en la app");
    expect(html).toContain("Continuar en el navegador");
  });

  test("en Android, una ruta sin equivalente en la app va a la web", async ({ request }) => {
    const res = await request.get(abrir("/servicios"), {
      headers: { "user-agent": ANDROID },
      maxRedirects: 0,
    });
    expect(res.status()).toBe(302);
    expect(new URL(res.headers().location!, "http://127.0.0.1").pathname).toBe("/servicios");
  });

  for (const peligrosa of ["//evil.com", "https://evil.com", "/\\evil.com"]) {
    test(`no es una redirección abierta (${peligrosa})`, async ({ request }) => {
      for (const ua of [DESKTOP, ANDROID]) {
        const res = await request.get(abrir(peligrosa), {
          headers: { "user-agent": ua },
          maxRedirects: 0,
        });
        expect(res.status()).toBe(302);
        const destino = new URL(res.headers().location!, "http://127.0.0.1:3100");
        expect(destino.host).toBe("127.0.0.1:3100");
        expect(destino.pathname).toBe("/");
      }
    });
  }

  test("sin ruta lleva al inicio", async ({ request }) => {
    const res = await request.get(abrir(), { headers: { "user-agent": DESKTOP }, maxRedirects: 0 });
    expect(res.status()).toBe(302);
    expect(new URL(res.headers().location!, "http://127.0.0.1").pathname).toBe("/");
  });
});
