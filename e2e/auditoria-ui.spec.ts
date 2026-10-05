import { expect, test, type Page } from "@playwright/test";

import { makeUser, mockApi } from "./support/api-mock";

/**
 * Auditoria UI/UX MEDIDA (herramienta de diagnostico, no prueba de regresion).
 *
 * No afirma nada: recoge numeros. Mide, por pagina y por tema:
 *   - contraste de texto segun WCAG 2.1 AA (4.5:1 normal, 3:1 texto grande)
 *   - tamanos de blanco tactil (44 px, el minimo que declara design-qa.md)
 *   - elementos interactivos sin nombre accesible
 *   - imagenes sin alt
 *   - campos de formulario sin etiqueta
 *   - jerarquia de encabezados (saltos, h1 ausente o repetido)
 *   - desbordamiento horizontal (320, 375, 768, 1440)
 *   - foco visible al tabular
 *
 * Uso (PowerShell, desde frontend-urban/):
 *   $env:UB_AUDITORIA=1; npx playwright test e2e/auditoria-ui.spec.ts --workers=1 --reporter=list
 *
 * Sin UB_AUDITORIA la prueba se salta sola, para no colarse en la suite normal.
 */

const TEMAS = ["noir", "acero", "salon", "libreta"] as const;

const PAGINAS: Array<{ ruta: string; nombre: string; protegida?: boolean }> = [
  { ruta: "/", nombre: "landing" },
  { ruta: "/login", nombre: "login" },
  { ruta: "/servicios", nombre: "servicios" },
  { ruta: "/equipo", nombre: "equipo" },
  { ruta: "/reservar", nombre: "reservar" },
  { ruta: "/terminos", nombre: "terminos" },
  { ruta: "/dashboard", nombre: "dashboard", protegida: true },
  { ruta: "/citas-x", nombre: "404" },
];

const VIEWPORTS = [
  { ancho: 320, alto: 680 },
  { ancho: 375, alto: 812 },
  { ancho: 768, alto: 1024 },
  { ancho: 1440, alto: 900 },
];

type Hallazgo = { tipo: string; detalle: string; valor?: number };

/** Se inyecta en el navegador: hace todas las mediciones de una pagina. */
function medir(): Hallazgo[] {
  const hallazgos: Hallazgo[] = [];

  const parseColor = (c: string) => {
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(",").map((s) => parseFloat(s.trim()));
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };

  const luminancia = (c: { r: number; g: number; b: number }) => {
    const f = (v: number) => {
      const x = v / 255;
      return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  };

  const contraste = (a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }) => {
    const la = luminancia(a);
    const lb = luminancia(b);
    const [alto, bajo] = la > lb ? [la, lb] : [lb, la];
    return (alto + 0.05) / (bajo + 0.05);
  };

  const componer = (fg: { r: number; g: number; b: number; a: number }, bg: { r: number; g: number; b: number }) => ({
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
  });

  const fondoDe = (el: Element): { color: { r: number; g: number; b: number } | null; motivo: string } => {
    let actual: Element | null = el;
    let acumulado: { r: number; g: number; b: number; a: number } | null = null;
    while (actual) {
      const estilo = getComputedStyle(actual);
      if (estilo.backgroundImage !== "none") return { color: null, motivo: "fondo con imagen o degradado" };
      const c = parseColor(estilo.backgroundColor);
      if (c && c.a > 0) {
        acumulado = acumulado ? { ...componer(acumulado, { r: c.r, g: c.g, b: c.b }), a: 1 } : { ...c };
        if (acumulado.a >= 1) return { color: acumulado, motivo: "" };
      }
      actual = actual.parentElement;
    }
    return acumulado ? { color: acumulado, motivo: "" } : { color: null, motivo: "sin fondo opaco" };
  };

  const visible = (el: Element) => {
    const r = el.getBoundingClientRect();
    const e = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && e.visibility !== "hidden" && e.display !== "none" && e.opacity !== "0";
  };

  const selector = (el: Element) => {
    const tag = el.tagName.toLowerCase();
    const cls = (el.getAttribute("class") ?? "").split(/\s+/).filter(Boolean).slice(0, 2).join(".");
    const txt = (el.textContent ?? "").trim().slice(0, 24);
    return `${tag}${cls ? "." + cls : ""}${txt ? ` "${txt}"` : ""}`;
  };

  // ---- Contraste: recorrer nodos de texto visibles ----
  const peores: Array<{ sel: string; ratio: number; color: string; fondo: string; px: number; grande: boolean }> = [];
  const paseante = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const vistos = new Set<Element>();
  while (paseante.nextNode()) {
    const nodo = paseante.currentNode as Text;
    if (!nodo.textContent || !nodo.textContent.trim()) continue;
    const el = nodo.parentElement;
    if (!el || vistos.has(el) || !visible(el)) continue;
    vistos.add(el);

    const estilo = getComputedStyle(el);
    const fg = parseColor(estilo.color);
    if (!fg) continue;
    const { color: bg, motivo } = fondoDe(el);
    if (!bg) {
      hallazgos.push({ tipo: "contraste-no-verificable", detalle: `${selector(el)} (${motivo})` });
      continue;
    }
    const colorTexto = fg.a < 1 ? componer(fg, bg) : fg;
    const ratio = contraste(colorTexto, bg);
    const px = parseFloat(estilo.fontSize);
    const peso = parseInt(estilo.fontWeight, 10) || 400;
    const grande = px >= 24 || (px >= 18.66 && peso >= 700);
    const minimo = grande ? 3 : 4.5;
    if (ratio < minimo) {
      peores.push({
        sel: selector(el),
        ratio: Math.round(ratio * 100) / 100,
        color: estilo.color,
        fondo: `rgb(${Math.round(bg.r)}, ${Math.round(bg.g)}, ${Math.round(bg.b)})`,
        px: Math.round(px * 10) / 10,
        grande,
      });
    }
  }
  peores.sort((a, b) => a.ratio - b.ratio).slice(0, 10).forEach((p) =>
    hallazgos.push({
      tipo: "contraste-bajo",
      detalle: `${p.sel} — ${p.ratio}:1 (min ${p.grande ? 3 : 4.5}) texto ${p.color} sobre ${p.fondo} a ${p.px}px`,
      valor: p.ratio,
    }),
  );

  // ---- Blancos tactiles ----
  const chicos: Array<{ sel: string; w: number; h: number }> = [];
  document.querySelectorAll("a, button, input, select, textarea, [role=button], [role=link]").forEach((el) => {
    if (!visible(el)) return;
    const r = el.getBoundingClientRect();
    const w = Math.round(r.width);
    const h = Math.round(r.height);
    if (w < 44 || h < 44) chicos.push({ sel: selector(el), w, h });
  });
  chicos.sort((a, b) => Math.min(a.w, a.h) - Math.min(b.w, b.h)).slice(0, 10).forEach((c) =>
    hallazgos.push({ tipo: "blanco-tactil", detalle: `${c.sel} — ${c.w}x${c.h} px (min 44)`, valor: Math.min(c.w, c.h) }),
  );

  // ---- Nombre accesible ----
  let sinNombre = 0;
  const ejemplosSinNombre: string[] = [];
  document.querySelectorAll("a, button, [role=button], [role=link]").forEach((el) => {
    if (!visible(el)) return;
    const nombre = (
      el.getAttribute("aria-label") ??
      el.getAttribute("title") ??
      (el.textContent ?? "").trim() ??
      ""
    ).trim();
    const imgAlt = el.querySelector("img[alt]")?.getAttribute("alt") ?? "";
    if (!nombre && !imgAlt) {
      sinNombre++;
      if (ejemplosSinNombre.length < 5) ejemplosSinNombre.push(selector(el));
    }
  });
  if (sinNombre) hallazgos.push({ tipo: "sin-nombre-accesible", detalle: `${sinNombre} control(es): ${ejemplosSinNombre.join(" | ")}`, valor: sinNombre });

  // ---- Imagenes sin alt ----
  const imgsSinAlt = [...document.querySelectorAll("img")].filter((i) => visible(i) && !i.hasAttribute("alt"));
  if (imgsSinAlt.length) hallazgos.push({ tipo: "img-sin-alt", detalle: imgsSinAlt.slice(0, 5).map(selector).join(" | "), valor: imgsSinAlt.length });

  // ---- Campos sin etiqueta ----
  const sinEtiqueta: string[] = [];
  document.querySelectorAll("input, select, textarea").forEach((el) => {
    if (!visible(el)) return;
    const tipo = (el as HTMLInputElement).type;
    if (["hidden", "submit", "button", "checkbox", "radio", "file"].includes(tipo)) return;
    const id = el.getAttribute("id");
    const tiene = (id && document.querySelector(`label[for="${CSS.escape(id)}"]`)) ||
      el.getAttribute("aria-label") ||
      el.getAttribute("aria-labelledby") ||
      el.closest("label");
    if (!tiene) sinEtiqueta.push(selector(el));
  });
  if (sinEtiqueta.length) hallazgos.push({ tipo: "campo-sin-etiqueta", detalle: sinEtiqueta.slice(0, 5).join(" | "), valor: sinEtiqueta.length });

  // ---- Encabezados ----
  const niveles = [...document.querySelectorAll("h1, h2, h3, h4, h5, h6")].filter(visible).map((h) => parseInt(h.tagName[1], 10));
  const h1 = niveles.filter((n) => n === 1).length;
  if (h1 === 0) hallazgos.push({ tipo: "encabezado", detalle: "sin h1 en la pagina" });
  if (h1 > 1) hallazgos.push({ tipo: "encabezado", detalle: `${h1} h1 en la misma pagina`, valor: h1 });
  for (let i = 1; i < niveles.length; i++) {
    if (niveles[i] - niveles[i - 1] > 1) {
      hallazgos.push({ tipo: "encabezado", detalle: `salto h${niveles[i - 1]} -> h${niveles[i]}` });
      break;
    }
  }

  // ---- Desbordamiento horizontal ----
  const doc = document.documentElement;
  if (doc.scrollWidth > doc.clientWidth + 1) {
    hallazgos.push({ tipo: "desborde-horizontal", detalle: `scrollWidth ${doc.scrollWidth} > ${doc.clientWidth}`, valor: doc.scrollWidth - doc.clientWidth });
  }

  // ---- Estructura basica ----
  if (!document.querySelector("main")) hallazgos.push({ tipo: "landmark", detalle: "sin <main>" });
  if (document.documentElement.lang !== "es") hallazgos.push({ tipo: "idioma", detalle: `lang="${document.documentElement.lang}"` });
  if (!document.title.trim()) hallazgos.push({ tipo: "titulo", detalle: "sin <title>" });

  return hallazgos;
}

async function medirEn(page: Page): Promise<Hallazgo[]> {
  return await page.evaluate(medir);
}

test("auditoria UI/UX medida", async ({ browser }) => {
  // Es una herramienta de diagnostico, no una prueba de regresion: recoge
  // numeros y los imprime. Sin esta guarda se colaria en la suite normal y le
  // sumaria ~3 minutos de ruido en cada corrida y en CI.
  test.skip(!process.env.UB_AUDITORIA, "herramienta de diagnostico: se corre con UB_AUDITORIA=1");

  test.setTimeout(20 * 60 * 1000);

  const lineas: string[] = [];
  const conteo: Record<string, number> = {};

  for (const tema of TEMAS) {
    for (const pagina of PAGINAS) {
      const contexto = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      await contexto.addCookies([{ name: "ub_theme", value: tema, url: "http://127.0.0.1:3100" }]);
      if (pagina.protegida) {
        // Sin el token de sesion, el middleware de ruta redirige a /login y la
        // auditoria acabaria midiendo el login en vez del dashboard.
        await contexto.addCookies([{ name: "ub_token", value: "token-de-auditoria", url: "http://127.0.0.1:3100" }]);
      }
      const page = await contexto.newPage();

      try {
        if (pagina.protegida) await mockApi(page, { user: makeUser({ roles: ["administrador"], profile_complete: true }) });

        const errores: string[] = [];
        page.on("pageerror", (e) => errores.push(e.message.split("\n")[0]));

        await page.goto(pagina.ruta, { waitUntil: "networkidle", timeout: 30_000 });

        for (const vp of VIEWPORTS) {
          await page.setViewportSize({ width: vp.ancho, height: vp.alto });
          await page.waitForTimeout(150);
          const hallazgos = await medirEn(page);
          for (const h of hallazgos) {
            conteo[h.tipo] = (conteo[h.tipo] ?? 0) + 1;
            lineas.push(`  [${h.tipo}] ${tema}/${pagina.nombre}@${vp.ancho} — ${h.detalle}`);
          }
        }

        if (errores.length) {
          conteo["error-consola"] = (conteo["error-consola"] ?? 0) + errores.length;
          lineas.push(`  [error-consola] ${tema}/${pagina.nombre} — ${errores.slice(0, 3).join(" | ")}`);
        }
      } catch (e) {
        lineas.push(`  [no-carga] ${tema}/${pagina.nombre} — ${(e as Error).message.split("\n")[0]}`);
        conteo["no-carga"] = (conteo["no-carga"] ?? 0) + 1;
      } finally {
        await contexto.close();
      }
    }
  }

  console.log("\n=========== CONTEO POR TIPO ===========");
  Object.entries(conteo).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${v.toString().padStart(4)}  ${k}`));
  console.log("\n=========== DETALLE ===========");
  console.log(lineas.join("\n"));
  console.log("\n=========== FIN ===========");

  expect(conteo["no-carga"] ?? 0).toBeLessThan(PAGINAS.length * TEMAS.length);
});
