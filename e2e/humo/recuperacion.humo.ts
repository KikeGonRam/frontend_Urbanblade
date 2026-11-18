import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

import { expect, test, type APIRequestContext, type Browser, type Page, type TestInfo } from "@playwright/test";

import { Apk } from "./apk";

/*
 * T076 (HT-43): «Recuperar la contraseña con enlace o código». Prueba de integración de sistemas del módulo
 * «Recuperación de contraseña», con enfoque de caja negra, para RF-03 (Recuperación de contraseña).
 *
 *   1. Solicitar la recuperación: llega el correo con el enlace (staging: se pide desde la app; local: desde la web).
 *   2. Usar un enlace vencido: el del paso 1, pasados más de 60 minutos, sin pedir otro antes. Se rechaza.
 *   3. Usar el vigente (se pide otro desde la web) y definir otra contraseña: queda guardada.
 *   4. Entrar con ella en la web (y en la app en staging): se entra, y la anterior ya no funciona.
 *
 * El enlace vence a los 60 minutos, así que la prueba corre por fases: HUMO_FASE=solicitar | vencido | vigente (o
 * varias separadas por comas). El estado entre fases queda en ~/.urbanblade-humo-recuperacion-<entorno>.json, fuera del
 * repositorio. Los enlaces se leen de Mailpit (local) o de ~/.urbanblade-humo-enlaces-staging.json (staging: el correo
 * llega a un buzón real y de ahí se copia el enlace de cada correo).
 *
 * Al terminar se restaura la contraseña original de la cuenta. Correos, contraseñas y enlaces no quedan en las
 * capturas, en el reporte ni en la salida.
 */

const LOCAL = process.env.HUMO_ENTORNO === "local";
const ENTORNO = LOCAL ? "local" : "staging";
const API_URL = process.env.HUMO_API_URL ?? (LOCAL ? "http://127.0.0.1:8000" : "https://api.urbanblade.com.mx");
const MAILPIT_URL = process.env.HUMO_MAILPIT_URL ?? "http://127.0.0.1:8025";
const APK_RUTA = resolve(process.env.HUMO_APK ?? "../documentacion/HT-46/T075/apk/UrbanBlade-staging-main-095f168.apk");
// La app se prueba contra staging (el APK de staging apunta a la API de staging). En local se omite.
const CON_APP = !LOCAL && process.env.HUMO_SIN_APP !== "1";
const FASES = ["preparar", "solicitar", "vencido", "vigente"] as const;
type Fase = (typeof FASES)[number];
const A_CORRER = (process.env.HUMO_FASE ?? "solicitar").split(",").map((f) => f.trim()) as Fase[];
const ARCHIVO_ESTADO = join(homedir(), `.urbanblade-humo-recuperacion-${ENTORNO}.json`);
const ARCHIVO_ENLACES = join(homedir(), ".urbanblade-humo-enlaces-staging.json");
const VIGENCIA_MIN = 60;
// La cuenta necesita un buzón al que se pueda entrar. En staging la de humo no lo tiene, así que esta prueba usa su
// propia cuenta de ~/.urbanblade-humo-recuperacion.env (HUMO_EMAIL / HUMO_PASSWORD) si existe.
function leerCuenta(ruta: string): Record<string, string> {
  if (!existsSync(ruta)) return {};
  const valores: Record<string, string> = {};
  for (const linea of readFileSync(ruta, "utf8").split(/\r?\n/)) {
    const m = linea.match(/^\s*(HUMO_[A-Z_]+)\s*=\s*(.*?)\s*$/);
    if (m) valores[m[1]!] = m[2]!.replace(/^['"]|['"]$/g, "");
  }

  return valores;
}
// Si la cuenta se creó con Google no tiene contraseña: la fase «preparar» le da una con un enlace de recuperación
// (HUMO_RECUPERACION_EMAIL indica el correo) y la guarda en ese archivo.
const ARCHIVO_CUENTA = join(homedir(), ".urbanblade-humo-recuperacion.env");
const CUENTA_PROPIA = LOCAL ? {} : leerCuenta(ARCHIVO_CUENTA);
const EMAIL_PROPIO = LOCAL ? undefined : (CUENTA_PROPIA.HUMO_EMAIL ?? process.env.HUMO_RECUPERACION_EMAIL);
const EMAIL = EMAIL_PROPIO ?? process.env.HUMO_EMAIL ?? "";
const CLAVE_ORIGINAL = EMAIL_PROPIO ? (CUENTA_PROPIA.HUMO_PASSWORD ?? "") : (process.env.HUMO_PASSWORD ?? "");
const MENSAJE_SOLICITUD = /Si el correo está registrado/;
const ERROR_ENLACE = /Token de recuperación inválido o expirado/;
const ERROR_CREDENCIALES = /Las credenciales no son válidas/;
// La app no repite el mensaje de la API: con un 422 en el acceso dice «Revisa tu correo y tu contraseña e inténtalo de nuevo.».
const ERROR_CREDENCIALES_APP = /Revisa tu correo y tu contraseña|credenciales/i;

// En local la web corre en otro puerto que el que acepta el CORS de la API local: el navegador de la prueba no aplica
// CORS (solo en este ensayo local, con HUMO_WEB_SIN_CORS=1). En staging no se usa.
if (process.env.HUMO_WEB_SIN_CORS === "1") test.use({ launchOptions: { args: ["--disable-web-security"] } });

type Resultado = "pasó" | "falló" | "bloqueado" | "omitido" | "no se ejecutó" | "observación";
interface Paso { n: string; fase: Fase; donde: string; titulo: string; esperado: string; resultado: Resultado; detalle: string; cuando?: string }
interface Solicitud { n: number; origen: "app" | "web"; en: string }
interface Correo { enlace: string; recibido: string; asunto: string; html?: string; texto?: string }
interface Estado { solicitudes: Solicitud[]; claveNueva?: string; restaurada?: boolean; pasos: Paso[]; datos: Record<string, unknown> }

const DEFINICION: Omit<Paso, "resultado" | "detalle">[] = [
  { n: "P0-solicitud", fase: "preparar", donde: "Web", titulo: "Precondición: la cuenta entró con Google y no tiene contraseña; se pide un enlace para crearla", esperado: "Se confirma el envío del enlace" },
  { n: "P0", fase: "preparar", donde: "Web", titulo: "Precondición: definir con ese enlace la contraseña inicial de la cuenta", esperado: "La cuenta queda con una contraseña conocida" },
  { n: "P", fase: "solicitar", donde: "API", titulo: "Precondición: la cuenta sintética entra con su contraseña actual", esperado: "Inicia sesión como cliente" },
  { n: "1", fase: "solicitar", donde: CON_APP ? "APK" : "Web", titulo: "Solicitar la recuperación", esperado: "Se confirma el envío del enlace" },
  { n: "1-correo", fase: "vencido", donde: "Correo", titulo: "Llega el correo con el enlace de recuperación", esperado: "Trae un enlace a «Nueva contraseña» para esa cuenta" },
  { n: "2", fase: "vencido", donde: "Web", titulo: `Usar el enlace vencido (más de ${VIGENCIA_MIN} min)`, esperado: "Se rechaza y la contraseña no cambia" },
  { n: "3-solicitud", fase: "vencido", donde: "Web", titulo: "Pedir un enlace nuevo desde la web", esperado: "Se confirma el envío del enlace" },
  { n: "3-correo", fase: "vigente", donde: "Correo", titulo: "Llega el correo con el enlace nuevo", esperado: "Trae un enlace a «Nueva contraseña» para esa cuenta" },
  { n: "3", fase: "vigente", donde: "Web", titulo: "Usar el enlace vigente y definir otra contraseña", esperado: "La nueva contraseña queda guardada" },
  { n: "3-reuso", fase: "vigente", donde: "Web", titulo: "Complementaria: volver a usar el mismo enlace", esperado: "Se rechaza (el enlace es de un solo uso)" },
  { n: "4-web-nueva", fase: "vigente", donde: "Web", titulo: "Entrar con la contraseña nueva", esperado: "Entra a su panel" },
  { n: "4-web-anterior", fase: "vigente", donde: "Web", titulo: "Entrar con la contraseña anterior", esperado: "Se muestra el error y no entra" },
  { n: "4-app-nueva", fase: "vigente", donde: "APK", titulo: "Entrar con la contraseña nueva en la app", esperado: "Entra a su inicio" },
  { n: "4-app-anterior", fase: "vigente", donde: "APK", titulo: "Entrar con la contraseña anterior en la app", esperado: "Se muestra el error y no entra" },
  { n: "4-sesion-previa", fase: "vigente", donde: "API", titulo: "Complementaria: sesión abierta antes del cambio", esperado: "(Informativo) Se anota si sigue activa" },
  { n: "R", fase: "vigente", donde: "API", titulo: "Restaurar la contraseña original de la cuenta", esperado: "Vuelve a entrar con la original" },
];

function leerEstado(): Estado {
  const previo: Partial<Estado> = existsSync(ARCHIVO_ESTADO) ? JSON.parse(readFileSync(ARCHIVO_ESTADO, "utf8")) : {};
  const pasos = DEFINICION.map((d) => previo.pasos?.find((p) => p.n === d.n) ?? { ...d, resultado: "no se ejecutó" as Resultado, detalle: "" });

  return { solicitudes: previo.solicitudes ?? [], claveNueva: previo.claveNueva, restaurada: previo.restaurada, pasos, datos: previo.datos ?? {} };
}

const estado = leerEstado();
const guardarEstado = () => writeFileSync(ARCHIVO_ESTADO, JSON.stringify(estado, null, 2));

/** Corre un paso. Si falla, lo marca en rojo en el reporte y sigue con el siguiente; al final la prueba falla. */
async function paso(n: string, fn: () => Promise<string>) {
  const p = estado.pasos.find((x) => x.n === n)!;
  try {
    await test.step(`${n} · ${p.titulo}`, async () => {
      try {
        p.detalle = await fn();
        if (p.resultado !== "observación") p.resultado = "pasó";
      } catch (error) {
        p.resultado = "falló";
        const sinColores = (error as Error).message.split(String.fromCharCode(27)).map((t, i) => (i ? t.replace(/^\[[0-9;]*m/, "") : t)).join("");
        p.detalle = sinColores.split("\n")[0]!.replace(/^Error:\s*/, "").trim();
        throw error;
      } finally {
        p.cuando = new Date().toISOString();
        guardarEstado();
      }
    });
  } catch {
    // Ya quedó anotado: se sigue con el siguiente paso.
  }
}

function marcar(n: string, resultado: "bloqueado" | "omitido" | "observación", motivo: string) {
  const p = estado.pasos.find((x) => x.n === n)!;
  p.resultado = resultado;
  p.detalle = motivo;
}

const pausa = (ms: number) => new Promise((r) => setTimeout(r, ms));

// La API acepta 5 intentos de acceso por minuto por correo e IP: la prueba deja como máximo 4 en cualquier minuto.
const intentosDeAcceso: number[] = [];
async function respetarLimiteDeAcceso() {
  for (;;) {
    const ahora = Date.now();
    while (intentosDeAcceso.length && ahora - intentosDeAcceso[0]! > 61_000) intentosDeAcceso.shift();
    if (intentosDeAcceso.length < 4) break;
    await pausa(61_000 - (ahora - intentosDeAcceso[0]!) + 500);
  }
  intentosDeAcceso.push(Date.now());
}

const JSON_HEADERS = { Accept: "application/json" };

async function loginApi(request: APIRequestContext, password: string) {
  await respetarLimiteDeAcceso();
  const r = await request.post(`${API_URL}/api/v1/auth/login`, { headers: JSON_HEADERS, data: { email: EMAIL, password, device_name: "QA T076 recuperacion" } });
  const cuerpo = (await r.json().catch(() => ({}))) as { token?: string; message?: string; user?: { roles?: string[]; profile_complete?: boolean } };

  return { estado: r.status(), token: cuerpo.token ?? "", roles: cuerpo.user?.roles ?? [], perfilCompleto: Boolean(cuerpo.user?.profile_complete), mensaje: cuerpo.message ?? "" };
}

async function cerrarSesionApi(request: APIRequestContext, token: string) {
  if (token) await request.post(`${API_URL}/api/v1/auth/logout`, { headers: { ...JSON_HEADERS, Authorization: `Bearer ${token}` } }).catch(() => {});
}

/** Captura de página completa con correos y contraseñas tapados. */
async function capturaWeb(page: Page, testInfo: TestInfo, archivo: string) {
  const ruta = testInfo.outputPath(archivo);
  const tapar = [page.locator('input[type="email"], input[type="password"], input[autocomplete="username"]'), page.getByText(/[\w.+-]+@[\w-]+\.[\w.-]+/)];
  await page.screenshot({ path: ruta, fullPage: true, mask: tapar });
  await testInfo.attach(archivo.replace(/\.png$/, ""), { path: ruta, contentType: "image/png" });
}

/** Tapa zonas de una captura del emulador (el campo de correo) dibujando encima, sin depender de otra librería. */
async function taparEnPng(browser: Browser, ruta: string, zonas: { x1: number; y1: number; x2: number; y2: number }[]) {
  if (!zonas.length) return;
  const png = readFileSync(ruta);
  const ancho = png.readUInt32BE(16);
  const alto = png.readUInt32BE(20);
  const ctx = await browser.newContext({ viewport: { width: ancho, height: alto }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  const cajas = zonas
    .map((z) => `<div style="position:absolute;left:${z.x1}px;top:${z.y1}px;width:${z.x2 - z.x1}px;height:${z.y2 - z.y1}px;background:#3b3b3b;border-radius:18px;color:#e6e6e6;font:600 34px sans-serif;display:flex;align-items:center;justify-content:center">correo oculto</div>`)
    .join("");
  await p.setContent(`<body style="margin:0"><div id="c" style="position:relative;width:${ancho}px;height:${alto}px"><img src="data:image/png;base64,${png.toString("base64")}" style="display:block;width:${ancho}px;height:${alto}px">${cajas}</div></body>`);
  await p.locator("#c").screenshot({ path: ruta });
  await ctx.close();
}

async function capturaApp(apk: Apk, browser: Browser, testInfo: TestInfo, archivo: string) {
  const ruta = testInfo.outputPath(archivo);
  const nodos = await apk.nodos();
  apk.captura(ruta);
  const zonas = nodos.filter((n) => n.texto.includes(EMAIL) || n.descripcion.includes(EMAIL)).map((n) => ({ x1: n.izquierda, y1: n.arriba, x2: n.derecha, y2: n.abajo }));
  await taparEnPng(browser, ruta, zonas);
  await testInfo.attach(archivo.replace(/\.png$/, ""), { path: ruta, contentType: "image/png" });
}

/**
 * El correo tal como llegó, con el destinatario y el enlace tapados. De Mailpit se tiene el HTML; del buzón real,
 * el texto del correo (se muestra con el enlace, el correo y el nombre del destinatario ocultos).
 */
async function capturaCorreo(browser: Browser, testInfo: TestInfo, archivo: string, correo: Correo) {
  if (!correo.html && !correo.texto) return;
  const ctx = await browser.newContext({ viewport: { width: 760, height: 900 } });
  const p = await ctx.newPage();
  if (correo.html) {
    await p.setContent(correo.html, { waitUntil: "domcontentloaded" });
  } else {
    const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;");
    const texto = correo.texto!
      .replace(/https?:\/\/\S*reset-password\?\S+/g, "[enlace oculto]")
      .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[correo oculto]")
      .replace(/^Hola .+,$/m, "Hola [nombre del destinatario],");
    await p.setContent(
      `<body style="margin:0;background:#f1f3f4;font:15px/1.5 Arial,sans-serif"><div style="max-width:680px;margin:24px auto;background:#fff;border-radius:10px;padding:20px 26px;box-shadow:0 1px 3px #0003">` +
        `<div style="font-size:20px;margin-bottom:6px">${esc(correo.asunto)}</div><div style="color:#5f6368;font-size:13px;margin-bottom:16px">Recibido en el buzón de la cuenta el ${esc(correo.recibido)} · versión de texto del correo</div>` +
        `<pre style="white-space:pre-wrap;font:15px/1.5 Arial,sans-serif;margin:0">${esc(texto)}</pre></div></body>`,
    );
  }
  await p.waitForTimeout(1500);
  const ruta = testInfo.outputPath(archivo);
  await p.screenshot({ path: ruta, fullPage: true, mask: [p.getByText(/[\w.+-]+@[\w-]+\.[\w.-]+/), p.getByText(/token=|reset-password\?/)] });
  await ctx.close();
  await testInfo.attach(archivo.replace(/\.png$/, ""), { path: ruta, contentType: "image/png" });
}

/**
 * Escribe en un campo sin que el valor quede en el reporte HTML: fill() anota cada paso como «Fill "valor"», y el
 * reporte se comparte. Se asigna el valor y se avisa al formulario con el evento «input», como al teclear.
 */
async function escribirSinRegistro(page: Page, selector: string, valor: string) {
  await page.locator(selector).evaluate((el, v) => {
    const campo = el as HTMLInputElement;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(campo, v);
    campo.dispatchEvent(new Event("input", { bubbles: true }));
  }, valor);
}

function extraerEnlace(texto: string) {
  const m = texto.replace(/&amp;/g, "&").match(/https?:\/\/[^\s"'<>]+\/reset-password\?token=[^\s"'<>]+/);
  if (!m) throw new Error("El correo no trae un enlace a /reset-password");

  return m[0];
}

/** El enlace sin el token ni el correo, para la evidencia. */
function describirEnlace(enlace: string) {
  const u = new URL(enlace);
  const token = u.searchParams.get("token") ?? "";

  return `${u.origin}${u.pathname}?token=(${token.length} caracteres)&email=(${u.searchParams.get("email") === EMAIL ? "el de la cuenta" : "otro correo"})`;
}

/** El correo de recuperación que llegó después de `desde`: de Mailpit (local) o del archivo copiado del buzón (staging). */
async function correoDeRecuperacion(request: APIRequestContext, n: number, desde: string, hasta?: string): Promise<Correo> {
  if (!LOCAL) {
    const enlaces = existsSync(ARCHIVO_ENLACES) ? (JSON.parse(readFileSync(ARCHIVO_ENLACES, "utf8")) as Record<string, Correo>) : {};
    const correo = enlaces[String(n)];
    if (!correo?.enlace) throw new Error(`Falta copiar el enlace del correo ${n} del buzón de la cuenta`);
    expect(Date.parse(correo.recibido), `el correo ${n} debe haber llegado después de pedirlo`).toBeGreaterThanOrEqual(Date.parse(desde) - 60_000);

    return { ...correo, enlace: extraerEnlace(correo.enlace) };
  }
  const limite = Date.now() + 90_000;
  const desdeMs = Date.parse(desde) - 5_000;
  for (;;) {
    const r = await request.get(`${MAILPIT_URL}/api/v1/search`, { params: { query: `to:"${EMAIL}" subject:"Restablece"` } });
    const lista = (((await r.json()) as { messages?: { ID: string; Created: string; Subject: string }[] }).messages ?? [])
      .filter((m) => Date.parse(m.Created) >= desdeMs && (!hasta || Date.parse(m.Created) < Date.parse(hasta)))
      .sort((a, b) => Date.parse(b.Created) - Date.parse(a.Created));
    if (lista[0]) {
      const m = (await (await request.get(`${MAILPIT_URL}/api/v1/message/${lista[0].ID}`)).json()) as { HTML?: string; Text?: string };

      return { enlace: extraerEnlace(`${m.HTML ?? ""}\n${m.Text ?? ""}`), recibido: lista[0].Created, asunto: lista[0].Subject, html: m.HTML };
    }
    if (Date.now() > limite) throw new Error("No llegó el correo de recuperación a Mailpit en 90 s");
    await pausa(3000);
  }
}

/** Abre el enlace del correo (sin que el token quede en el reporte). En local se abre en la web local. */
async function abrirEnlace(page: Page, enlace: string, baseURL: string) {
  const u = new URL(enlace);
  const destino = LOCAL ? `${baseURL}${u.pathname}${u.search}` : enlace;
  // Se navega desde la página (y no con goto) porque goto anota la dirección completa en el reporte.
  await page.evaluate((d) => void window.setTimeout(() => window.location.assign(d), 0), destino);
  await page.waitForURL(/\/reset-password/, { timeout: 60_000 });
  await expect(page.locator("#password")).toBeVisible({ timeout: 60_000 });
  await page.waitForLoadState("networkidle").catch(() => {});
}

/** Escribe la contraseña nueva dos veces, envía el formulario y devuelve la respuesta de POST /auth/reset-password. */
async function definirClave(page: Page, clave: string) {
  await escribirSinRegistro(page, "#password", clave);
  await escribirSinRegistro(page, "#password_confirmation", clave);
  const respuesta = page.waitForResponse((r) => r.url().includes("/auth/reset-password") && r.request().method() === "POST", { timeout: 60_000 });
  await page.getByRole("button", { name: "Restablecer contraseña", exact: true }).click();
  const r = await respuesta;

  return { estado: r.status(), mensaje: ((await r.json().catch(() => ({}))) as { message?: string }).message ?? "" };
}

async function pedirEnWeb(page: Page, testInfo: TestInfo, prefijo: string) {
  await page.goto("/forgot-password");
  await page.waitForLoadState("networkidle").catch(() => {});
  await escribirSinRegistro(page, "#email", EMAIL);
  await capturaWeb(page, testInfo, `${prefijo}-a-web-recuperar-acceso.png`);
  const en = new Date().toISOString();
  const respuesta = page.waitForResponse((r) => r.url().includes("/auth/forgot-password") && r.request().method() === "POST", { timeout: 60_000 });
  await page.getByRole("button", { name: "Enviar enlace de recuperación" }).click();
  const r = await respuesta;
  expect(r.status(), "POST /auth/forgot-password debe responder 200").toBe(200);
  const aviso = page.getByText(MENSAJE_SOLICITUD).first();
  await expect(aviso, "la web debe confirmar el envío").toBeVisible({ timeout: 30_000 });
  await capturaWeb(page, testInfo, `${prefijo}-b-web-enlace-enviado.png`);

  return { en, aviso: (await aviso.innerText()).trim() };
}

async function entrarWeb(page: Page, password: string) {
  await page.goto("/login");
  await page.waitForLoadState("networkidle").catch(() => {});
  await escribirSinRegistro(page, "#email", EMAIL);
  await escribirSinRegistro(page, "#password", password);
  await respetarLimiteDeAcceso();
  const respuesta = page.waitForResponse((r) => r.url().includes("/auth/login") && r.request().method() === "POST", { timeout: 60_000 });
  await page.getByRole("button", { name: "Ingresar" }).click();

  return (await respuesta).status();
}

async function entrarApp(apk: Apk, password: string) {
  await apk.abrirLimpia("Iniciar sesión");
  await apk.tocar("Iniciar sesión");
  await apk.esperar("Entrar a UrbanBlade");
  await apk.escribir(0, EMAIL, "el correo de la cuenta");
  await apk.escribir(1, password, "la contraseña", { oculto: true });
  await respetarLimiteDeAcceso();
  await apk.tocar("Entrar a UrbanBlade");
}

function veredicto() {
  // «preparar» solo se usa si la cuenta no tenía contraseña.
  const pendientes = FASES.filter((f) => f !== "preparar" && estado.pasos.some((p) => p.fase === f && p.resultado === "no se ejecutó"));
  const fallidos = estado.pasos.filter((p) => p.resultado === "falló");
  const bloqueados = estado.pasos.filter((p) => p.resultado === "bloqueado");
  if (fallidos.length) return `FALLIDA: falló ${fallidos.map((p) => p.n).join(", ")}.`;
  if (pendientes.length) return `EN CURSO: faltan las fases ${pendientes.join(", ")}.`;
  if (bloqueados.length) return `BLOQUEADA: ${bloqueados.map((p) => p.n).join(", ")}.`;

  return "APROBADA: el enlace vencido se rechaza; con el vigente se define otra contraseña, se entra con ella y la anterior ya no funciona.";
}

test("T076: recuperar la contraseña con enlace (RF-03)", async ({ request, browser, baseURL }, testInfo) => {
  test.setTimeout(40 * 60_000);
  expect(EMAIL, "la cuenta tiene correo (HUMO_EMAIL)").toBeTruthy();
  if (!A_CORRER.includes("preparar")) expect(CLAVE_ORIGINAL, "la cuenta tiene contraseña (HUMO_PASSWORD)").toBeTruthy();
  let apk: Apk | undefined;
  const corre = (f: Fase) => A_CORRER.includes(f);

  // Antes de usar el enlace «vencido» tienen que haber pasado más de 60 minutos desde que se pidió, sin pedir otro.
  if (corre("vencido")) {
    const primera = estado.solicitudes.find((s) => s.n === 1);
    expect(primera, "primero hay que correr la fase «solicitar»").toBeTruthy();
    const minutos = (Date.now() - Date.parse(primera!.en)) / 60_000;
    test.skip(minutos <= VIGENCIA_MIN + 1, `El enlace 1 aún no vence: lleva ${minutos.toFixed(1)} min; faltan ${(VIGENCIA_MIN + 1 - minutos).toFixed(1)} min.`);
  }

  // «preparar» corre dos veces: la primera pide el enlace; la segunda, ya copiado el enlace, define la contraseña.
  const usarEnlaceInicial = corre("preparar") && estado.solicitudes.some((s) => s.n === 0) && estado.pasos.find((p) => p.n === "P0")!.resultado === "no se ejecutó";

  // Una corrida nueva empieza de cero (conserva la preparación de la cuenta), salvo que la anterior haya cambiado la
  // contraseña sin revertirla.
  if ((corre("preparar") && !usarEnlaceInicial) || corre("solicitar")) {
    const pendiente = Boolean(estado.claveNueva) && !estado.restaurada && estado.pasos.find((p) => p.n === "3")!.resultado !== "no se ejecutó";
    expect(pendiente, "la corrida anterior pudo cambiar la contraseña y no la revirtió: primero hay que restaurarla").toBe(false);
    const conservar = corre("preparar") ? [] : estado.solicitudes.filter((s) => s.n === 0);
    const preparacion = corre("preparar") ? undefined : estado.datos.preparacion;
    Object.assign(estado, { solicitudes: conservar, datos: preparacion ? { preparacion } : {}, claveNueva: undefined, restaurada: undefined });
    for (const p of estado.pasos) {
      if (p.fase !== "preparar" || corre("preparar")) Object.assign(p, { resultado: "no se ejecutó", detalle: "", cuando: undefined });
    }
  } else {
    for (const p of estado.pasos) {
      const seVuelveACorrer = usarEnlaceInicial ? p.n === "P0" : A_CORRER.includes(p.fase);
      if (seVuelveACorrer) Object.assign(p, { resultado: "no se ejecutó", detalle: "", cuando: undefined });
    }
  }
  const datos = estado.datos;

  try {
    datos[`entorno-${A_CORRER.join("+")}`] = await test.step(`0 · Entorno (${A_CORRER.join(", ")})`, async () => {
      const web = await request.get(`${baseURL}/login`);
      expect(web.status(), "la web debe responder").toBe(200);
      const api = await request.get(`${API_URL}/api/v1/services`, { headers: JSON_HEADERS });
      expect(api.status(), "la API debe responder").toBe(200);
      Object.assign(datos, { entorno: LOCAL ? "local (web en este equipo + API en Docker con Atlas + Mailpit)" : "staging (correo real por Gmail SMTP)", web: baseURL, api: API_URL });
      if (LOCAL) expect((await request.get(`${MAILPIT_URL}/api/v1/info`)).status(), "Mailpit debe responder").toBe(200);
      const necesitaApp = CON_APP && (corre("solicitar") || corre("vigente"));
      if (necesitaApp) {
        apk = Apk.elegirEmulador();
        apk.mantenerDespierto();
        datos.apk = `${APK_RUTA.split(/[\\/]/).pop()} (SHA-256 ${apk.instalar(APK_RUTA)})`;
        datos.emulador = `${apk.nombreDelEmulador()} (${apk.serie})`;
      }

      return `${new Date().toISOString()} · web ${web.status()} · API ${api.status()}${necesitaApp ? ` · app ${String(datos.apk)}` : ""}`;
    });

    if (!CON_APP) for (const n of ["4-app-nueva", "4-app-anterior"]) marcar(n, "omitido", LOCAL ? "La app se prueba en staging" : "Corrida solo de la web (HUMO_SIN_APP=1)");

    // ======================= Fase «preparar» (solo si la cuenta no tiene contraseña) =======================
    if (corre("preparar") && !usarEnlaceInicial) {
      await paso("P0-solicitud", async () => {
        const ctx = await browser.newContext();
        const page = await ctx.newPage();
        try {
          const { en, aviso } = await pedirEnWeb(page, testInfo, "P0");
          estado.solicitudes = [{ n: 0, origen: "web", en }];
          guardarEstado();

          return `La web muestra «${aviso}» (pedido a las ${en})`;
        } finally {
          await ctx.close();
        }
      });
    }
    if (usarEnlaceInicial) {
      await paso("P0", async () => {
        const pedida = estado.solicitudes.find((s) => s.n === 0)!;
        const correo0 = await correoDeRecuperacion(request, 0, pedida.en);
        await capturaCorreo(browser, testInfo, "P0-c-correo-recibido.png", correo0);
        const clave = `Ub${randomBytes(6).toString("hex")}Q7`;
        // Se guarda antes de enviarla, para no perderla si algo se corta; si la API la rechaza, se borra.
        writeFileSync(ARCHIVO_CUENTA, `# Cuenta cliente de staging para T076 «Recuperar la contraseña» (HT-43). Contraseña inicial definida por la prueba.\nHUMO_EMAIL=${EMAIL}\nHUMO_PASSWORD=${clave}\n`, { mode: 0o600 });
        const ctx = await browser.newContext();
        const page = await ctx.newPage();
        try {
          await abrirEnlace(page, correo0.enlace, baseURL!);
          await capturaWeb(page, testInfo, "P0-d-web-nueva-contrasena.png");
          const r = await definirClave(page, clave);
          if (r.estado !== 200) writeFileSync(ARCHIVO_CUENTA, `# La contraseña inicial no se pudo definir (POST /auth/reset-password ${r.estado}).\nHUMO_EMAIL=${EMAIL}\n`);
          expect(r.estado, "POST /auth/reset-password debe responder 200").toBe(200);
          await page.waitForURL(/\/login/, { timeout: 30_000 });
        } finally {
          await ctx.close();
        }
        const login = await loginApi(request, clave);
        await cerrarSesionApi(request, login.token);
        expect(login.estado, "la cuenta debe entrar con la contraseña inicial").toBe(200);
        datos.preparacion = { correo: { asunto: correo0.asunto, recibido: correo0.recibido, enlace: describirEnlace(correo0.enlace) }, loginConLaInicial: login.estado };

        return `Con el enlace de «${correo0.asunto}» (${describirEnlace(correo0.enlace)}) se definió la contraseña inicial; entra con ella (POST /auth/login 200)`;
      });
    }

    // ======================= Fase «solicitar» =======================
    if (corre("solicitar")) {
      if (!estado.solicitudes.some((s) => s.n === 0)) {
        for (const n of ["P0-solicitud", "P0"]) marcar(n, "omitido", "La cuenta ya tenía contraseña");
      }
      await paso("P", async () => {
        const r = await loginApi(request, CLAVE_ORIGINAL);
        try {
          expect(r.estado, "la cuenta debe iniciar sesión con su contraseña actual").toBe(200);
          expect(r.roles, "la cuenta debe ser de cliente").toContain("cliente");
          if (r.perfilCompleto) return `POST /auth/login 200 con la contraseña actual; rol ${r.roles.join(", ")}; perfil completo`;
          // Un cliente sin teléfono ni fecha de nacimiento entra primero a «Completa tu perfil» (así funciona la web).
          // La cuenta de prueba se completa una sola vez con datos inventados, y queda en la evidencia.
          const p = await request.put(`${API_URL}/api/v1/profile`, {
            headers: { ...JSON_HEADERS, Authorization: `Bearer ${r.token}` },
            data: { telefono: "5512345678", fecha_nacimiento: "1995-04-12", sexo: "prefiero_no_decir" },
          });
          expect(p.status(), "PUT /profile debe completar el perfil").toBe(200);
          datos.perfilCompletado = "teléfono 5512345678, nacimiento 1995-04-12, sexo «prefiero no decir» (datos sintéticos)";

          return `POST /auth/login 200 con la contraseña actual; rol ${r.roles.join(", ")}; se completó su perfil con datos sintéticos`;
        } finally {
          await cerrarSesionApi(request, r.token);
        }
      });

      await paso("1", async () => {
        if (CON_APP && apk) {
          await apk.abrirLimpia("Iniciar sesión");
          await apk.tocar("Iniciar sesión");
          await apk.esperar("Entrar a UrbanBlade");
          await apk.tocar("¿Olvidaste tu contraseña?");
          await apk.esperar("Enviar instrucciones");
          await capturaApp(apk, browser, testInfo, "1-a-app-recupera-tu-acceso.png");
          await apk.escribir(0, EMAIL, "el correo de la cuenta");
          await capturaApp(apk, browser, testInfo, "1-b-app-correo-escrito.png");
          const en = new Date().toISOString();
          await apk.tocar("Enviar instrucciones");
          const aviso = await apk.esperar(MENSAJE_SOLICITUD, 60);
          await apk.esperar("Revisa tu correo", 15);
          await pausa(1500);
          await capturaApp(apk, browser, testInfo, "1-c-app-correo-enviado.png");
          estado.solicitudes.push({ n: 1, origen: "app", en });
          guardarEstado();

          return `La app muestra «Revisa tu correo» y «${aviso.texto || aviso.descripcion}» (pedido a las ${en})`;
        }
        const ctx = await browser.newContext();
        const page = await ctx.newPage();
        try {
          const { en, aviso } = await pedirEnWeb(page, testInfo, "1");
          estado.solicitudes.push({ n: 1, origen: "web", en });
          guardarEstado();

          return `La web muestra «${aviso}» (pedido a las ${en})`;
        } finally {
          await ctx.close();
        }
      });
    }

    // ======================= Fase «vencido» =======================
    if (corre("vencido")) {
      const primera = estado.solicitudes.find((s) => s.n === 1)!;
      let correo1: Correo | undefined;

      await paso("1-correo", async () => {
        correo1 = await correoDeRecuperacion(request, 1, primera.en, estado.solicitudes.find((s) => s.n === 2)?.en);
        await capturaCorreo(browser, testInfo, "1-d-correo-recibido.png", correo1);
        const u = new URL(correo1.enlace);
        expect(u.pathname, "el enlace debe abrir la página «Nueva contraseña»").toBe("/reset-password");
        expect(u.searchParams.get("token"), "el enlace debe traer el token").toBeTruthy();
        expect(u.searchParams.get("email"), "el enlace debe ser para el correo de la cuenta").toBe(EMAIL);
        datos.correo1 = { asunto: correo1.asunto, recibido: correo1.recibido, enlace: describirEnlace(correo1.enlace) };

        return `«${correo1.asunto}», recibido ${correo1.recibido}; enlace ${describirEnlace(correo1.enlace)}`;
      });

      await paso("2", async () => {
        expect(correo1, "sin el correo 1 no hay enlace que usar").toBeTruthy();
        expect(estado.solicitudes.filter((s) => s.n > 1), "no debe haberse pedido otro enlace (así solo puede fallar por vencido)").toEqual([]);
        const minutos = (Date.now() - Date.parse(primera.en)) / 60_000;
        estado.claveNueva ??= `Qa${randomBytes(5).toString("hex")}T76`;
        guardarEstado();
        const ctx = await browser.newContext();
        const page = await ctx.newPage();
        try {
          await abrirEnlace(page, correo1!.enlace, baseURL!);
          await capturaWeb(page, testInfo, "2-a-web-enlace-vencido-abierto.png");
          const r = await definirClave(page, estado.claveNueva);
          expect(r.estado, "POST /auth/reset-password con el enlace vencido debe rechazarse (400)").toBe(400);
          await expect(page.getByText(ERROR_ENLACE).first(), "la web debe mostrar el error del enlace").toBeVisible({ timeout: 30_000 });
          await expect(page, "debe seguir en la página del enlace").toHaveURL(/\/reset-password/);
          await capturaWeb(page, testInfo, "2-b-web-enlace-vencido-rechazado.png");
        } finally {
          await ctx.close();
        }
        // La contraseña no cambió: la original sigue entrando y la que se intentó poner, no.
        const original = await loginApi(request, CLAVE_ORIGINAL);
        await cerrarSesionApi(request, original.token);
        const intentada = await loginApi(request, estado.claveNueva);
        await cerrarSesionApi(request, intentada.token);
        expect(original.estado, "la contraseña original debe seguir funcionando").toBe(200);
        expect(intentada.estado, "la contraseña que se intentó poner no debe funcionar").toBe(422);
        datos.accion2 = { minutosDesdeLaSolicitud: Number(minutos.toFixed(1)), respuesta: 400, loginOriginal: original.estado, loginIntentada: intentada.estado };

        return `Enlace de hace ${minutos.toFixed(1)} min: POST /auth/reset-password 400 y la web muestra «Token de recuperación inválido o expirado.»; la contraseña no cambió (original 200, intentada 422)`;
      });

      await paso("3-solicitud", async () => {
        const ctx = await browser.newContext();
        const page = await ctx.newPage();
        try {
          const { en, aviso } = await pedirEnWeb(page, testInfo, "3");
          estado.solicitudes.push({ n: 2, origen: "web", en });
          guardarEstado();

          return `La web muestra «${aviso}» (pedido a las ${en})`;
        } finally {
          await ctx.close();
        }
      });
    }

    // ======================= Fase «vigente» =======================
    if (corre("vigente")) {
      const segunda = estado.solicitudes.find((s) => s.n === 2);
      let correo2: Correo | undefined;
      let tokenPrevio = "";

      await paso("3-correo", async () => {
        expect(segunda, "primero hay que pedir el enlace nuevo (fase «vencido»)").toBeTruthy();
        correo2 = await correoDeRecuperacion(request, 2, segunda!.en);
        await capturaCorreo(browser, testInfo, "3-c-correo-nuevo-recibido.png", correo2);
        const u = new URL(correo2.enlace);
        expect(u.pathname).toBe("/reset-password");
        expect(u.searchParams.get("email"), "el enlace debe ser para el correo de la cuenta").toBe(EMAIL);
        datos.correo2 = { asunto: correo2.asunto, recibido: correo2.recibido, enlace: describirEnlace(correo2.enlace) };

        return `«${correo2.asunto}», recibido ${correo2.recibido}; enlace ${describirEnlace(correo2.enlace)}`;
      });

      await paso("3", async () => {
        expect(correo2, "sin el correo 2 no hay enlace vigente").toBeTruthy();
        const minutos = (Date.now() - Date.parse(segunda!.en)) / 60_000;
        expect(minutos, "el enlace debe estar vigente").toBeLessThan(VIGENCIA_MIN);
        // Una sesión abierta con la contraseña original, para ver después si sobrevive al cambio (paso complementario).
        const previa = await loginApi(request, CLAVE_ORIGINAL);
        expect(previa.estado, "antes del cambio la contraseña original debe funcionar").toBe(200);
        tokenPrevio = previa.token;
        estado.claveNueva ??= `Qa${randomBytes(5).toString("hex")}T76`;
        guardarEstado();
        const ctx = await browser.newContext();
        const page = await ctx.newPage();
        try {
          await abrirEnlace(page, correo2!.enlace, baseURL!);
          await capturaWeb(page, testInfo, "3-d-web-nueva-contrasena.png");
          const r = await definirClave(page, estado.claveNueva);
          expect(r.estado, "POST /auth/reset-password con el enlace vigente debe responder 200").toBe(200);
          await page.waitForURL(/\/login/, { timeout: 30_000 });
          // La página cambia con una transición: se espera a que la de acceso esté a la vista.
          await expect(page.getByRole("button", { name: "Ingresar" })).toBeVisible({ timeout: 30_000 });
          await expect(page.getByText("Restableciendo…")).toHaveCount(0, { timeout: 15_000 });
          await page.waitForLoadState("networkidle").catch(() => {});
          await page.waitForTimeout(800);
          await capturaWeb(page, testInfo, "3-e-web-vuelve-al-acceso.png");
          const aviso = page.getByText(/restablecid|actualizad|cambiad|ya puedes/i);
          const avisoEnLaWeb = (await aviso.count()) > 0 ? (await aviso.first().innerText()).trim() : "";
          datos.accion3 = { minutosDesdeLaSolicitud: Number(minutos.toFixed(1)), respuesta: r.estado, mensajeApi: r.mensaje, avisoEnLaWeb: avisoEnLaWeb || "(ninguno)" };

          return `Enlace de hace ${minutos.toFixed(1)} min: POST /auth/reset-password ${r.estado} «${r.mensaje}»; la web lleva a «Acceso» ${avisoEnLaWeb ? `con el aviso «${avisoEnLaWeb}»` : "sin aviso de que la contraseña cambió"}`;
        } finally {
          await ctx.close();
        }
      });

      await paso("3-reuso", async () => {
        expect(correo2, "sin el correo 2 no hay enlace").toBeTruthy();
        const ctx = await browser.newContext();
        const page = await ctx.newPage();
        try {
          await abrirEnlace(page, correo2!.enlace, baseURL!);
          const r = await definirClave(page, `Qa${randomBytes(5).toString("hex")}R76`);
          expect(r.estado, "el mismo enlace no debe servir dos veces (400)").toBe(400);
          await expect(page.getByText(ERROR_ENLACE).first()).toBeVisible({ timeout: 30_000 });
          await capturaWeb(page, testInfo, "3-f-web-enlace-usado-rechazado.png");

          return "POST /auth/reset-password 400 y la web muestra «Token de recuperación inválido o expirado.»";
        } finally {
          await ctx.close();
        }
      });

      const clave = estado.claveNueva ?? "";

      await paso("4-web-nueva", async () => {
        const ctx = await browser.newContext();
        const page = await ctx.newPage();
        try {
          expect(await entrarWeb(page, clave), "POST /auth/login con la contraseña nueva debe responder 200").toBe(200);
          await page.waitForURL(/\/dashboard/, { timeout: 60_000 });
          await expect(page.locator('[aria-label="Tu nivel"]').first(), "debe entrar al panel del cliente").toBeVisible({ timeout: 60_000 });
          await page.waitForLoadState("networkidle").catch(() => {});
          await capturaWeb(page, testInfo, "4-a-web-entra-con-la-nueva.png");

          return "POST /auth/login 200; entra a /dashboard con el panel del cliente («Tu nivel»)";
        } finally {
          await ctx.close();
        }
      });

      await paso("4-web-anterior", async () => {
        const ctx = await browser.newContext();
        const page = await ctx.newPage();
        try {
          expect(await entrarWeb(page, CLAVE_ORIGINAL), "POST /auth/login con la contraseña anterior debe responder 422").toBe(422);
          await expect(page.getByText(ERROR_CREDENCIALES).first(), "debe mostrarse el error").toBeVisible({ timeout: 30_000 });
          await expect(page).toHaveURL(/\/login/);
          await capturaWeb(page, testInfo, "4-b-web-la-anterior-ya-no-entra.png");

          return "POST /auth/login 422; la web muestra «Las credenciales no son válidas.» y sigue en /login";
        } finally {
          await ctx.close();
        }
      });

      if (CON_APP && apk) {
        await paso("4-app-nueva", async () => {
          await entrarApp(apk!, clave);
          await apk!.esperar("Mis citas", 90);
          await apk!.esperar("Inicio", 30);
          await pausa(2500);
          await capturaApp(apk!, browser, testInfo, "4-c-app-entra-con-la-nueva.png");
          expect(await apk!.hay("Entrar a UrbanBlade"), "ya no debe estar en el acceso").toBe(false);

          return "La app entra al inicio del cliente (Inicio · Reservar · Mis citas · Cuenta)";
        });

        await paso("4-app-anterior", async () => {
          await entrarApp(apk!, CLAVE_ORIGINAL);
          const error = await apk!.esperar(ERROR_CREDENCIALES_APP, 60);
          await capturaApp(apk!, browser, testInfo, "4-d-app-la-anterior-ya-no-entra.png");
          expect(await apk!.hay("Entrar a UrbanBlade"), "debe seguir en el acceso").toBe(true);
          expect(await apk!.hay("Mis citas"), "no debe entrar al inicio").toBe(false);

          return `La app muestra «${error.texto || error.descripcion}» y sigue en el acceso`;
        });
      }

      await paso("4-sesion-previa", async () => {
        expect(tokenPrevio, "no se abrió la sesión previa").toBeTruthy();
        const r = await request.get(`${API_URL}/api/v1/auth/me`, { headers: { ...JSON_HEADERS, Authorization: `Bearer ${tokenPrevio}` } });
        datos.sesionPrevia = { getAuthMe: r.status() };
        await cerrarSesionApi(request, tokenPrevio);
        if (r.status() === 200) {
          marcar("4-sesion-previa", "observación", "");

          return "La sesión abierta con la contraseña anterior sigue activa después del cambio (GET /auth/me 200)";
        }

        return `La sesión abierta con la contraseña anterior ya no sirve (GET /auth/me ${r.status()})`;
      });

      await paso("R", async () => {
        expect(clave, "no hay contraseña nueva que revertir").toBeTruthy();
        const nueva = await loginApi(request, clave);
        expect(nueva.estado, "la contraseña nueva debe entrar para poder revertirla").toBe(200);
        const r = await request.put(`${API_URL}/api/v1/profile/password`, {
          headers: { ...JSON_HEADERS, Authorization: `Bearer ${nueva.token}` },
          data: { current_password: clave, password: CLAVE_ORIGINAL, password_confirmation: CLAVE_ORIGINAL },
        });
        await cerrarSesionApi(request, nueva.token);
        expect(r.status(), "PUT /profile/password debe responder 200").toBe(200);
        const original = await loginApi(request, CLAVE_ORIGINAL);
        await cerrarSesionApi(request, original.token);
        expect(original.estado, "la contraseña original debe volver a entrar").toBe(200);
        estado.restaurada = true;
        delete estado.claveNueva;
        guardarEstado();

        return "La cuenta vuelve a tener su contraseña original (PUT /profile/password 200; entra con la original)";
      });
    }
  } finally {
    const final = veredicto();
    const md = [
      `# Acta T076 (HT-43) — Recuperar la contraseña — ${ENTORNO} — fases ${A_CORRER.join(", ")} — ${new Date().toISOString()}`,
      "",
      ...Object.entries(datos).filter(([, v]) => typeof v === "string").map(([k, v]) => `- ${k}: ${String(v)}`),
      `- solicitudes: ${estado.solicitudes.map((s) => `${s.n} (${s.origen}, ${s.en})`).join("; ") || "(ninguna)"}`,
      "",
      "| # | Fase | Dónde | Paso | Resultado esperado | Resultado | Detalle |",
      "|---|---|---|---|---|---|---|",
      ...estado.pasos.map((p) => `| ${p.n} | ${p.fase} | ${p.donde} | ${p.titulo} | ${p.esperado} | ${p.resultado} | ${p.detalle.replace(/\|/g, "/")} |`),
      "",
      `**Veredicto (${ENTORNO}):** ${final}`,
    ].join("\n");
    const sufijo = A_CORRER.join("-");
    writeFileSync(testInfo.outputPath(`acta-T076-recuperacion-${sufijo}.md`), md);
    const { claveNueva: _omitida, ...publico } = estado;
    writeFileSync(testInfo.outputPath(`datos-T076-recuperacion-${sufijo}.json`), JSON.stringify({ ...publico, veredicto: final }, null, 2));
    await testInfo.attach(`acta-T076-recuperacion-${sufijo}.md`, { path: testInfo.outputPath(`acta-T076-recuperacion-${sufijo}.md`), contentType: "text/markdown" });
    console.log(`\n${md}\n`);
  }

  expect(estado.pasos.filter((p) => p.resultado === "falló").map((p) => `${p.n}: ${p.detalle}`), "pasos que fallaron").toEqual([]);
});
