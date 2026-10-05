import { expect, test, type Page } from "@playwright/test";

import { makeUser, mockApi } from "./support/api-mock";

/**
 * Diagnostico puntual: QUE elemento desborda y COMO esta la jerarquia de
 * encabezados, en las paginas y anchos donde la auditoria ya detecto el fallo.
 *
 * Herramienta de diagnostico; se salta salvo que se pida con UB_DIAGNOSTICO=1.
 */

const CASOS = [
  { ruta: "/", nombre: "landing", ancho: 768 },
  { ruta: "/equipo", nombre: "equipo", ancho: 320 },
  { ruta: "/reservar", nombre: "reservar", ancho: 320 },
  { ruta: "/servicios", nombre: "servicios", ancho: 320 },
];

const ENCABEZADOS: Array<{ ruta: string; nombre: string; protegida?: boolean }> = [
  { ruta: "/", nombre: "landing" },
  { ruta: "/login", nombre: "login" },
  { ruta: "/servicios", nombre: "servicios" },
  { ruta: "/dashboard", nombre: "dashboard", protegida: true },
];

async function culpables(page: Page) {
  // Todo el codigo vive dentro del evaluate: usar new Function() aqui lo
  // bloquearia la CSP del sitio (script-src sin unsafe-eval).
  return await page.evaluate(() => {
    const describir = (el: Element) => {
      const tag = el.tagName.toLowerCase();
      const clases = (el.getAttribute("class") ?? "").split(/\s+/).filter(Boolean).slice(0, 4).join(".");
      const texto = (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 30);
      return `${tag}${clases ? "." + clases : ""}${texto ? ` "${texto}"` : ""}`;
    };

    const ancho = document.documentElement.clientWidth;
    const culpables: Array<{ el: string; derecha: number; ancho: number }> = [];

    document.querySelectorAll("body *").forEach((el) => {
      const estilo = getComputedStyle(el);
      if (estilo.display === "none" || estilo.visibility === "hidden") return;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      if (r.right > ancho + 1) {
        culpables.push({
          el: describir(el),
          derecha: Math.round(r.right),
          ancho: Math.round(r.width),
        });
      }
    });

    culpables.sort((a, b) => b.derecha - a.derecha);
    return {
      ancho,
      scrollWidth: document.documentElement.scrollWidth,
      culpables: culpables.slice(0, 12),
    };
  });
}

test("diagnostico de desborde y encabezados", async ({ browser }) => {
  test.skip(!process.env.UB_DIAGNOSTICO, "diagnostico: se corre con UB_DIAGNOSTICO=1");
  test.setTimeout(10 * 60 * 1000);

  console.log("\n========== DESBORDE HORIZONTAL: culpables ==========");
  for (const caso of CASOS) {
    const contexto = await browser.newContext({ viewport: { width: caso.ancho, height: 800 } });
    const page = await contexto.newPage();
    try {
      await page.goto(caso.ruta, { waitUntil: "networkidle", timeout: 30_000 });
      await page.waitForTimeout(300);
      const r = await culpables(page);
      console.log(`\n${caso.nombre} @ ${caso.ancho}px  (scrollWidth ${r.scrollWidth} vs ${r.ancho})`);
      r.culpables.forEach((c) => console.log(`   derecha=${String(c.derecha).padStart(5)} ancho=${String(c.ancho).padStart(5)}  ${c.el}`));
      if (!r.culpables.length) console.log("   (ningun elemento se sale; el desborde viene de otro sitio)");
    } catch (e) {
      console.log(`  ${caso.nombre}: no cargo (${(e as Error).message.split("\n")[0]})`);
    } finally {
      await contexto.close();
    }
  }

  console.log("\n\n========== JERARQUIA DE ENCABEZADOS ==========");
  for (const enc of ENCABEZADOS) {
    const contexto = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    if (enc.protegida) {
      await contexto.addCookies([{ name: "ub_token", value: "token-de-auditoria", url: "http://127.0.0.1:3100" }]);
    }
    const page = await contexto.newPage();
    try {
      if (enc.protegida) await mockApi(page, { user: makeUser({ roles: ["administrador"], profile_complete: true }) });
      await page.goto(enc.ruta, { waitUntil: "networkidle", timeout: 30_000 });
      const lista = await page.evaluate(() =>
        [...document.querySelectorAll("h1, h2, h3, h4, h5, h6")]
          .filter((h) => (h as HTMLElement).offsetParent !== null)
          .map((h) => ({
            nivel: h.tagName,
            texto: (h.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 44),
          })),
      );
      console.log(`\n${enc.nombre}:`);
      lista.forEach((h) => console.log(`   ${h.nivel}  ${h.texto}`));
      if (!lista.length) console.log("   (sin encabezados visibles)");
    } catch (e) {
      console.log(`  ${enc.nombre}: no cargo (${(e as Error).message.split("\n")[0]})`);
    } finally {
      await contexto.close();
    }
  }

  console.log("\n========== FIN ==========");
  expect(true).toBe(true);
});
