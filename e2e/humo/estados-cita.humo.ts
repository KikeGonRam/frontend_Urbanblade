import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { expect, test, type Browser, type Locator, type Page, type TestInfo } from "@playwright/test";

import { Apk } from "./apk";

/*
 * T057 (HT-20): «El estado de la cita es el mismo en la app y en la web en cada paso». Prueba de integración de sistemas
 * del módulo «App ↔ web ↔ base de datos», con enfoque de caja negra, para RF-24 (Información compartida entre la app y
 * la web) y RNF-21 (Consistencia de la información).
 *
 * Precondiciones: el cliente en la app y el personal (recepción) en la web. Datos: una cita sintética.
 *   1. Recorrer pendiente → confirmada → pago → en_proceso → completada: la cita recorre todos los estados sin errores.
 *   2. Revisar cada estado en ambos canales y en la base: en cada paso el estado y los datos coinciden en la app, la web
 *      y la base.
 *
 * Entorno LOCAL completo (decisión del usuario: en staging no hay cuenta de personal y la base no se puede consultar):
 * el APK de debug en el emulador (API por el túnel de adb), la web local servida por el proxy de mismo origen
 * (HUMO_BASE_URL=http://localhost:3004) y la API de barber en Docker con su base MongoDB. La base se lee DIRECTO con
 * documentacion/HT-20/T057/herramientas/leer-t057.php (solo lectura) dentro del contenedor barber-app.
 *
 * Escribe en la base (exige HUMO_PERMITIR_RESERVA=1): crea el cliente sintético «Cliente QA T057 …»
 * (qa.t057.*@urbanblade.test), su cita de HOY (el servicio solo se puede iniciar el día de la cita y desde 15 minutos
 * antes) y su cobro en efectivo. Al terminar borra todo con limpiar-t057.php (HUMO_T057_LIMPIAR=0 lo deja para revisar).
 */

const LOCAL = process.env.HUMO_ENTORNO === "local";
const API_URL = process.env.HUMO_API_URL ?? "http://127.0.0.1:8000";
const APK_RUTA = resolve(process.env.HUMO_APK ?? "../documentacion/HT-46/T075/apk/UrbanBlade-debug-local-main-095f168.apk");
const HERRAMIENTAS = resolve("../documentacion/HT-20/T057/herramientas");
const PERMITIR = process.env.HUMO_PERMITIR_RESERVA === "1";
const LIMPIAR = process.env.HUMO_T057_LIMPIAR !== "0";
const RECEPCION = { email: process.env.HUMO_STAFF_EMAIL ?? "", password: process.env.HUMO_STAFF_PASSWORD ?? "" };
const SERVICIO = "Afeitado Clásico";
const JSON_HEADERS = { Accept: "application/json" };
const CORREO = /[\w.+-]+@[\w-]+\.[\w.-]+/;
const ZONA = "America/Mexico_City";
const MARGEN_INICIO_MIN = 15;

// ---------------------------------------------------------------- Acta ----------------------------------------------------------------

type Resultado = "pasó" | "falló" | "no se ejecutó";
interface Paso { n: string; titulo: string; esperado: string; resultado: Resultado; detalle: string }
const PASOS: Paso[] = [];
const nuevoPaso = (n: string, titulo: string, esperado: string) => PASOS.push({ n, titulo, esperado, resultado: "no se ejecutó", detalle: "" });
nuevoPaso("0", "Entorno: API, web, app y base", "Responden");
nuevoPaso("P", "Precondiciones: cliente sintético en la app y recepción en la web", "Ambas sesiones abiertas");
nuevoPaso("1", "Pendiente: el cliente reserva en la app", "La cita nace «pendiente» y coincide en app, web y base");
nuevoPaso("2", "Confirmada: la recepción la confirma en la web", "«confirmada» en app, web y base");
nuevoPaso("3", "Pago: la recepción cobra en efectivo en la web", "Pago registrado y visto igual en app, web y base");
nuevoPaso("4", "En proceso: la recepción inicia el servicio en la web", "«en_proceso» en app, web y base");
nuevoPaso("5", "Completada: la recepción completa el servicio en la web", "«completada» en app, web y base");
nuevoPaso("R", "Limpieza: borrar los datos sintéticos", "Cliente, cita, pago y derivados borrados");

/** Una fila de la tabla de coincidencias: un dato de la cita en un estado, visto en los tres lados. */
interface Comparacion { estado: string; campo: string; app: string; web: string; base: string; coincide: boolean }
const COMPARACIONES: Comparacion[] = [];
/** Cada cambio de estado o cobro que pidió el personal y lo que respondió la API. */
const ACCIONES: { paso: string; accion: string; metodo: string; ruta: string; estado: number; mensaje: string }[] = [];

/** Una diferencia entre canales hace fallar el paso, pero la corrida sigue; cualquier otro error la detiene. */
let diferencias = 0;
async function paso(n: string, fn: () => Promise<string>) {
  const p = PASOS.find((x) => x.n === n)!;
  await test.step(`${n} · ${p.titulo}`, async () => {
    try {
      p.detalle = await fn();
      p.resultado = "pasó";
    } catch (error) {
      p.resultado = "falló";
      const sinColores = (error as Error).message.split(String.fromCharCode(27)).map((t, i) => (i ? t.replace(/^\[[0-9;]*m/, "") : t)).join("");
      p.detalle = sinColores.split("\n")[0]!.replace(/^Error:\s*/, "").trim();
      if (!p.detalle.startsWith("DIFERENCIA")) throw error;
      diferencias++;
    }
  });
}

const pausa = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------- Base (lectura directa) ----------------------------------------------------------------

interface CitaBase {
  existe: boolean;
  id: string;
  estado: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  servicio: string;
  precio_servicio: number;
  precio_cobrado: number | null;
  barbero: string;
  cliente: string;
  servicio_iniciado_en: string | null;
  actualizada_en: string;
  pagos: { metodo: string; monto: number; propina: number; estado: string; deposito: boolean; comprobante_pdf: boolean }[];
  lealtad: { movimientos: number; puntos: number };
}

function tinker(script: string, env: Record<string, string>) {
  const args = ["exec", "-i", ...Object.entries(env).flatMap(([k, v]) => ["-e", `${k}=${v}`]), "barber-app", "php", "artisan", "tinker"];
  return execFileSync("docker", args, { input: readFileSync(resolve(HERRAMIENTAS, script)), encoding: "utf8", maxBuffer: 16 * 1024 * 1024, timeout: 120_000 });
}

function leerBase(codigo: string): CitaBase {
  const salida = tinker("leer-t057.php", { T057_CODIGO: codigo });
  const json = salida.match(/@@T057@@(.*)@@FIN@@/s)?.[1];
  if (!json) throw new Error("La lectura de la base no devolvió datos");
  return JSON.parse(json) as CitaBase;
}

// ---------------------------------------------------------------- Formatos de cada canal ----------------------------------------------------------------

const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"];
const ESTADO_APP: Record<string, string> = { Pendiente: "pendiente", Confirmada: "confirmada", "En proceso": "en_proceso", Completada: "completada", Cancelada: "cancelada" };
const ESTADO_WEB: Record<string, string> = { Pendiente: "pendiente", Confirmada: "confirmada", "En Proceso": "en_proceso", Completada: "completada", Cancelada: "cancelada" };

/** «2026-11-27» como lo muestra la app: «Viernes 27 de noviembre». */
function fechaApp(iso: string) {
  const [a, m, d] = iso.split("-").map(Number) as [number, number, number];
  return `${DIAS[new Date(Date.UTC(a, m - 1, d)).getUTCDay()]} ${d} de ${MESES[m - 1]}`;
}
/** «2026-11-27» como lo muestra la tabla de la web: «27 nov 2026» (es-MX abrevia septiembre como «sept»). */
function fechaWeb(iso: string) {
  const [a, m, d] = iso.split("-").map(Number) as [number, number, number];
  return `${d} ${MESES_CORTOS[m - 1]} ${a}`;
}
/** «18:30» → «6:30 PM», como la app. */
function horaApp(hhmm: string) {
  const [h, m] = hhmm.slice(0, 5).split(":").map(Number) as [number, number];
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}
const dinero = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const soloNumero = (t: string) => Number(t.replace(/[^\d.]/g, ""));
const ahoraLocal = () => new Intl.DateTimeFormat("en-CA", { timeZone: ZONA, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date()).replace(",", "");

function comparar(estado: string, campo: string, app: string, web: string, base: string, iguales: boolean) {
  COMPARACIONES.push({ estado, campo, app, web, base, coincide: iguales });
}

// ---------------------------------------------------------------- App ----------------------------------------------------------------

async function textosApp(apk: Apk) {
  return [...new Set((await apk.nodos()).flatMap((n) => [n.texto, n.descripcion]).filter(Boolean))];
}

/** Captura de la app con los textos con forma de correo tapados (el pie de privacidad muestra uno). */
async function capturaApp(apk: Apk, browser: Browser, testInfo: TestInfo, archivo: string) {
  const ruta = testInfo.outputPath(archivo);
  const nodos = await apk.nodos();
  apk.captura(ruta);
  const zonas = nodos.filter((n) => CORREO.test(n.texto + n.descripcion)).map((n) => ({ x1: n.izquierda, y1: n.arriba, x2: n.derecha, y2: n.abajo }));
  if (zonas.length) {
    const png = readFileSync(ruta);
    const ancho = png.readUInt32BE(16);
    const alto = png.readUInt32BE(20);
    const ctx = await browser.newContext({ viewport: { width: ancho, height: alto }, deviceScaleFactor: 1 });
    const p = await ctx.newPage();
    const cajas = zonas.map((z) => `<div style="position:absolute;left:${z.x1}px;top:${z.y1}px;width:${z.x2 - z.x1}px;height:${z.y2 - z.y1}px;background:#3b3b3b;border-radius:18px"></div>`).join("");
    await p.setContent(`<body style="margin:0"><div id="c" style="position:relative;width:${ancho}px;height:${alto}px"><img src="data:image/png;base64,${png.toString("base64")}" style="display:block">${cajas}</div></body>`);
    await p.locator("#c").screenshot({ path: ruta });
    await ctx.close();
  }
  await testInfo.attach(archivo.replace(/\.png$/, ""), { path: ruta, contentType: "image/png" });
}

/** Lo que la app muestra de la cita: estado, hora, fecha, servicio, barbero, precio y el texto de ayuda. */
interface VistaApp { estado: string; hora: string; fecha: string; servicio: string; barbero: string; precio: string; ayuda: string; textos: string[] }

function vistaApp(t: string[], barbero: string): VistaApp {
  return {
    estado: t.find((x) => x in ESTADO_APP) ?? "",
    hora: t.find((x) => /^\d{1,2}:\d{2} (AM|PM)$/.test(x)) ?? "",
    fecha: t.find((x) => new RegExp(`^(${DIAS.join("|")}) \\d{1,2} de (${MESES.join("|")})$`).test(x)) ?? "",
    servicio: t.find((x) => x === SERVICIO) ?? "",
    barbero: t.find((x) => x === barbero) ?? "",
    precio: t.find((x) => /^\$\d[\d,]*(\.\d{2})?$/.test(x)) ?? "",
    ayuda: t.find((x) => /^(Esperando que tu barbero|Cita aprobada|Tu servicio está en curso)/.test(x)) ?? "",
    textos: t,
  };
}

/**
 * Abre «Mis citas», la ACTUALIZA (como haría el cliente) y sigue actualizando hasta que la tarjeta de la próxima cita
 * muestre el estado esperado y, si se indica, el texto de ayuda esperado (por ejemplo, el del pago). Si en `segundos` no
 * llega, devuelve lo último que mostró: la comparación lo marca como diferencia.
 */
async function verEnApp(apk: Apk, estadoEsperado: string, barbero: string, ayudaEsperada?: RegExp, segundos = 90): Promise<VistaApp> {
  const etiqueta = Object.entries(ESTADO_APP).find(([, v]) => v === estadoEsperado)![0];
  await apk.tocar("Mis citas", 60);
  const limite = Date.now() + segundos * 1000;
  let vista: VistaApp;
  do {
    if (await apk.hay("Actualizar")) await apk.tocar("Actualizar", 10);
    else await pausa(1500);
    vista = vistaApp(await textosApp(apk), barbero);
  } while ((vista.estado !== etiqueta || (ayudaEsperada && !ayudaEsperada.test(vista.ayuda))) && Date.now() < limite);
  return vista;
}

async function reservarEnApp(apk: Apk, fecha: string, hora: string, barbero: string) {
  await apk.tocar("Reservar", 60);
  await apk.esperar(/^Afeitado Clásico$/, 60);
  // La lista de servicios se acomoda al cargar: se espera, se toca y, si no avanza al horario, se vuelve a tocar.
  let enHorario = false;
  for (let i = 0; i < 3 && !enHorario; i++) {
    await pausa(2000);
    const servicio = await apk.buscar(/^Afeitado Clásico$/);
    if (servicio) apk.adb(["shell", "input", "tap", String(servicio.x), String(servicio.y)]);
    enHorario = await apk.esperar("DÍA", i < 2 ? 20 : 60).then(() => true, () => false);
  }
  if (!enHorario) throw new Error("La app no pasó al paso del horario («DÍA») al tocar el servicio.");
  // Con varios barberos la app pide «Elige el barbero de tu visita»: las fichas muestran solo el nombre de pila y van en
  // el orden de la API, así que se toca la primera ficha con ese nombre (la de más a la izquierda de su fila).
  const nodos = await apk.nodos();
  const etiquetaBarbero = nodos.find((n) => n.texto === "BARBERO");
  const filaDia = nodos.find((n) => n.texto === "DÍA");
  const ficha = nodos
    .filter((n) => n.texto === barbero.split(" ")[0] && etiquetaBarbero && filaDia && n.arriba > etiquetaBarbero.abajo && n.abajo < filaDia.arriba)
    .sort((a, b) => a.izquierda - b.izquierda)[0];
  if (ficha) apk.adb(["shell", "input", "tap", String(ficha.x), String(ficha.y)]);
  await pausa(1500);
  const dia = String(Number(fecha.slice(8, 10)));
  const chip = nodos.find((n) => n.texto === dia && filaDia && n.arriba > filaDia.abajo && n.arriba < filaDia.abajo + 300);
  if (chip) apk.adb(["shell", "input", "tap", String(chip.x), String(chip.y)]);
  await apk.tocar(hora, 60);
  await apk.tocar("Elegir extras", 60);
  await apk.tocar("Continuar sin extras", 60);
  await apk.esperar("Revisa y reserva", 60);
  for (let i = 0; i < 4 && !(await apk.hay(/^Acepto el cargo por inasistencia/)); i++) {
    apk.deslizar();
    await pausa(1200);
  }
  await apk.tocar("Efectivo", 30);
  await apk.tocar(/^Acepto el cargo por inasistencia/, 30);
}

// ---------------------------------------------------------------- Web (recepción) ----------------------------------------------------------------

async function escribirSinRegistro(page: Page, selector: string, valor: string) {
  await page.locator(selector).evaluate((el, v) => {
    const campo = el as HTMLInputElement;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(campo, v);
    campo.dispatchEvent(new Event("input", { bubbles: true }));
  }, valor);
}

async function capturaWeb(page: Page, testInfo: TestInfo, archivo: string, zona?: Locator) {
  const ruta = testInfo.outputPath(archivo);
  const tapar = [page.locator('input[type="email"], input[type="password"]'), page.getByText(CORREO)];
  if (zona) await zona.screenshot({ path: ruta, mask: tapar });
  else await page.screenshot({ path: ruta, fullPage: false, mask: tapar });
  await testInfo.attach(archivo.replace(/\.png$/, ""), { path: ruta, contentType: "image/png" });
}

/** La fila de la cita en «Citas & Reservas» (la más reciente de la base, así que sale arriba). */
async function filaWeb(page: Page, cliente: string) {
  await page.goto("/appointments");
  await page.waitForLoadState("networkidle").catch(() => {});
  const fila = page.locator("tbody tr").filter({ hasText: cliente }).first();
  await expect(fila, `la web debe listar la cita de «${cliente}»`).toBeVisible({ timeout: 60_000 });
  return fila;
}

interface VistaWeb { estado: string; fecha: string; hora: string; servicio: string; barbero: string; aviso: string; acciones: string[] }

async function vistaWeb(fila: Locator): Promise<VistaWeb> {
  const celda = async (etiqueta: string) => (await fila.locator(`td[data-label="${etiqueta}"]`).innerText()).replace(/\s+/g, " ").trim();
  const aviso = fila.getByRole("img", { name: /^No se puede iniciar/ });
  return {
    estado: (await fila.locator('td[data-label="Estado"] span').first().innerText()).trim(),
    fecha: await celda("Fecha"),
    hora: await celda("Hora"),
    servicio: await celda("Servicio"),
    barbero: await celda("Barbero"),
    aviso: (await aviso.count()) ? ((await aviso.getAttribute("aria-label")) ?? "") : "",
    acciones: (await fila.locator('td[data-label="Acciones"] button, td[data-label="Acciones"] a').allInnerTexts()).map((t) => t.trim()).filter((t) => t && t !== "⋯"),
  };
}

/** Los cobros de la cita en «Pagos» (la recepción los ve ahí): método y monto de cada fila del cliente. */
async function pagosEnWeb(page: Page, cliente: string) {
  await page.goto("/payments");
  await page.waitForLoadState("networkidle").catch(() => {});
  // La tabla aparece cuando termina la carga (mientras tanto hay un esqueleto «Cargando pagos…»).
  await expect(page.locator("section.ui-card table tbody")).toBeVisible({ timeout: 60_000 });
  const filas = page.locator("tbody tr").filter({ hasText: cliente });
  const n = await filas.count();
  const pagos: string[] = [];
  for (let i = 0; i < n; i++) pagos.push((await filas.nth(i).innerText()).replace(/\s+/g, " ").trim());
  return { pagos, filas };
}

/** Pulsa una acción de la fila y anota la respuesta de la API (PATCH del estado). */
async function accionWeb(page: Page, fila: Locator, boton: string, codigo: string, n: string) {
  const respuesta = page.waitForResponse((r) => r.url().includes(`/appointments/${codigo}/status`) && r.request().method() === "PATCH", { timeout: 60_000 });
  await fila.getByRole("button", { name: boton, exact: true }).click();
  const r = await respuesta;
  const cuerpo = (await r.json().catch(() => ({}))) as { message?: string };
  ACCIONES.push({ paso: n, accion: `«${boton}» en la web`, metodo: "PATCH", ruta: `/api/v1/appointments/${codigo}/status`, estado: r.status(), mensaje: cuerpo.message ?? "" });
  await page.waitForLoadState("networkidle").catch(() => {});
  const error = page.getByRole("alert").filter({ hasText: /\S/ });
  const textoError = (await error.count()) ? (await error.first().innerText()).trim() : "";
  expect(r.status(), `«${boton}» debe responder 200${cuerpo.message ? ` (${cuerpo.message})` : ""}`).toBe(200);
  expect(textoError, "la web no debe mostrar un error").toBe("");
}

// ---------------------------------------------------------------- Revisión de un estado en los tres lados ----------------------------------------------------------------

interface Contexto { apk: Apk; web: Page; browser: Browser; testInfo: TestInfo; codigo: string; cliente: string; barbero: string }

async function revisarEstado(ctx: Contexto, n: string, estado: string, pago: "sin pago" | "pagada", etiqueta = estado): Promise<string> {
  const { apk, web, browser, testInfo, codigo, cliente } = ctx;
  // Base: la verdad de la que deben salir los dos canales.
  const base = leerBase(codigo);
  expect(base.existe, "la cita debe existir en la base").toBe(true);
  ctx.barbero = base.barbero;

  // Web (recepción).
  const fila = await filaWeb(web, cliente);
  const w = await vistaWeb(fila);
  await capturaWeb(web, testInfo, `${n}-web-${estado}.png`);
  await capturaWeb(web, testInfo, `${n}-web-${estado}-fila.png`, fila);
  const pagosWeb = await pagosEnWeb(web, cliente);
  if (pagosWeb.pagos.length) await capturaWeb(web, testInfo, `${n}-web-pagos.png`, pagosWeb.filas.first());

  // App (cliente). Completada, la cita pasa a «Historial» con el botón «Ver ticket»: el ticket «Servicio terminado»
  // muestra el cobro (método y monto) y el total pagado.
  let ticket: { cobro: string; monto: string; total: string } | undefined;
  let a: VistaApp;
  if (estado === "completada") {
    await apk.tocar("Mis citas", 60);
    if (await apk.hay("Actualizar")) await apk.tocar("Actualizar", 10);
    await apk.tocar("Historial", 30);
    await apk.esperar(SERVICIO, 30);
    a = vistaApp(await textosApp(apk), base.barbero);
    await capturaApp(apk, browser, testInfo, `${n}-app-${estado}.png`);
    if (await apk.hay("Ver ticket")) {
      await apk.tocar("Ver ticket", 10);
      await apk.esperar("Servicio terminado", 30);
      const nodos = await apk.nodos();
      // Cada renglón del ticket es una etiqueta a la izquierda y su valor a la derecha, a la misma altura.
      const valor = (etiqueta: RegExp) => {
        const e = nodos.find((x) => etiqueta.test(x.texto));
        const v = e && nodos.find((x) => x !== e && x.texto && Math.abs(x.y - e.y) < 25 && x.izquierda >= e.derecha);
        return { etiqueta: e?.texto ?? "", valor: v?.texto ?? "" };
      };
      const cobro = valor(/^Cobro \(/);
      ticket = { cobro: cobro.etiqueta, monto: cobro.valor, total: valor(/^Total pagado$/).valor };
      await capturaApp(apk, browser, testInfo, `${n}-app-ticket-servicio-terminado.png`);
      await apk.tocar("Listo", 10);
    }
  } else {
    const ayuda = estado === "confirmada" ? (pago === "pagada" ? /pago resuelto/ : /Resuelve el pago/) : undefined;
    a = await verEnApp(apk, estado, base.barbero, ayuda);
    await capturaApp(apk, browser, testInfo, `${n}-app-${estado}.png`);
  }

  // Comparaciones.
  const e = etiqueta;
  comparar(e, "Estado", `${a.estado || "—"} (${ESTADO_APP[a.estado] ?? "?"})`, `${w.estado} (${ESTADO_WEB[w.estado] ?? "?"})`, base.estado, ESTADO_APP[a.estado] === base.estado && ESTADO_WEB[w.estado] === base.estado && base.estado === estado);
  comparar(e, "Fecha", a.fecha || "—", w.fecha, base.fecha, a.fecha === fechaApp(base.fecha) && w.fecha === fechaWeb(base.fecha));
  if (estado !== "completada") comparar(e, "Hora", a.hora || "—", w.hora, base.hora_inicio, a.hora === horaApp(base.hora_inicio) && w.hora === base.hora_inicio);
  else comparar(e, "Hora", "(el historial no muestra la hora)", w.hora, base.hora_inicio, w.hora === base.hora_inicio);
  comparar(e, "Servicio", a.servicio || "—", w.servicio, base.servicio, a.servicio === base.servicio && w.servicio === base.servicio);
  comparar(e, "Barbero", a.barbero || "—", w.barbero, base.barbero, a.barbero === base.barbero && w.barbero === base.barbero);

  // Pago: la base manda; la web lo muestra en «Pagos» y en el aviso de «Iniciar»; la app, en el texto de ayuda o el ticket.
  const pagosBase = base.pagos.filter((p) => p.estado === "verificado" && !p.deposito);
  const baseTxt = pagosBase.length ? pagosBase.map((p) => `${p.metodo} ${dinero(p.monto)} (${p.estado})${base.precio_cobrado !== null ? `, precio cobrado ${dinero(base.precio_cobrado)}` : ""}`).join("; ") : "sin pagos";
  // La tabla de «Pagos» escribe el método en mayúsculas («EFECTIVO»).
  const webTxt = pagosWeb.pagos.length ? pagosWeb.pagos.map((p) => p.match(/(Efectivo|Tarjeta|Transferencia)[^$]*\$[\d,.]+/i)?.[0] ?? p).join("; ") : "sin cobros en «Pagos»";
  let appTxt = "(esta pantalla no muestra el pago)";
  let appOk = true;
  if (estado === "confirmada") {
    appTxt = a.ayuda || "—";
    appOk = pago === "pagada" ? /pago resuelto/.test(a.ayuda) : /Resuelve el pago/.test(a.ayuda);
  } else if (estado === "completada") {
    appTxt = ticket ? `ticket «Servicio terminado»: ${ticket.cobro} ${ticket.monto} · Total pagado ${ticket.total}` : "(sin «Ver ticket»)";
    appOk = Boolean(ticket) && /efectivo/i.test(ticket!.cobro) && pagosBase.length > 0
      && soloNumero(ticket!.monto) === pagosBase[0]!.monto && soloNumero(ticket!.total) === pagosBase[0]!.monto + pagosBase[0]!.propina;
  } else if (a.precio) {
    appTxt = `precio ${a.precio}`;
  }
  const webOk = pago === "pagada"
    ? pagosWeb.pagos.length === 1 && /Efectivo/i.test(pagosWeb.pagos[0]!) && pagosBase.length === 1 && pagosWeb.pagos[0]!.includes(dinero(pagosBase[0]!.monto))
    // Sin pago: «Pagos» no tiene cobros de la cita. El aviso ⓘ de «Iniciar» se anota, pero la web muestra solo el primer
    // motivo (si aún es pronto, dice la hora y no que falta cobrar), así que no decide.
    : pagosWeb.pagos.length === 0;
  const baseOk = pago === "pagada" ? pagosBase.length === 1 && pagosBase[0]!.metodo === "efectivo" : base.pagos.length === 0;
  comparar(e, "Pago", appTxt, `${webTxt}${w.aviso ? ` · aviso: «${w.aviso.replace(/^No se puede iniciar: /, "")}»` : ""}`, baseTxt, appOk && webOk && baseOk);

  const propias = COMPARACIONES.filter((c) => c.estado === e);
  const malas = propias.filter((c) => !c.coincide);
  // Una diferencia se anota y la cita sigue su recorrido (la acción 1 no depende de la 2).
  if (malas.length) throw new Error(`DIFERENCIA en «${e}»: ${malas.map((c) => `${c.campo}: app «${c.app}» · web «${c.web}» · base «${c.base}»`).join(" / ")}`);
  return `App «${a.estado}» · web «${w.estado}» · base «${base.estado}»; ${propias.length} datos coinciden${pago === "pagada" ? ` (pago: ${baseTxt})` : ""}`;
}

// ---------------------------------------------------------------- Prueba ----------------------------------------------------------------

test("T057: el estado de la cita es el mismo en la app, la web y la base en cada paso (RF-24 y RNF-21)", async ({ page, request, browser, baseURL }, testInfo) => {
  test.setTimeout(90 * 60_000);
  test.skip(!LOCAL, "T057 corre en local (HUMO_ENTORNO=local): en staging no hay cuenta de personal ni acceso a la base.");
  test.skip(!PERMITIR, "Escribe en la base (cliente, cita y cobro sintéticos): se corre solo con HUMO_PERMITIR_RESERVA=1.");
  const datos: Record<string, unknown> = { entorno: "local", web: baseURL, api: API_URL, inicio: ahoraLocal() };
  const sello = Date.now().toString(36);
  const cliente = { nombre: `Cliente QA T057 ${sello}`, email: `qa.t057.${sello}@urbanblade.test`, password: `Qa${randomBytes(5).toString("hex")}T057` };
  let apk: Apk | undefined;
  let tokenCliente = "";
  let codigo = "";
  let fecha = "";
  let hora = "";
  let barberoElegido = "";
  const ctx = {} as Contexto;

  try {
    await paso("0", async () => {
      const api = await request.get(`${API_URL}/api/v1/services`, { headers: JSON_HEADERS });
      expect(api.status(), "la API local debe responder").toBe(200);
      const inicio = await request.get(baseURL!);
      expect(inicio.status(), "la web local debe responder").toBe(200);
      const prueba = tinker("limpiar-t057.php", {});
      expect(prueba, "la base debe responder al simulacro de limpieza").toMatch(/Simulacro/);
      expect(RECEPCION.email && RECEPCION.password, "la cuenta de recepción (HUMO_STAFF_EMAIL y HUMO_STAFF_PASSWORD)").toBeTruthy();
      apk = Apk.elegirEmulador();
      apk.mantenerDespierto();
      apk.adb(["shell", "settings", "put", "secure", "stylus_handwriting_enabled", "0"]);
      // El emulador arranca en UTC y la app calcula «hoy» y las horas que ya pasaron con el reloj del teléfono: se pone en
      // la zona de la barbería, como un teléfono en México.
      apk.adb(["shell", "cmd", "alarm", "set-timezone", ZONA]);
      datos.relojEmulador = apk.adb(["shell", "date"]).trim();
      expect(String(datos.relojEmulador), "el emulador debe quedar en la hora de México").toMatch(/CST|CDT|-06/);
      datos.apk = `${APK_RUTA.split(/[\\/]/).pop()} (SHA-256 ${apk.instalar(APK_RUTA)})`;
      apk.adb(["reverse", "tcp:8000", "tcp:8000"]);
      datos.emulador = `${apk.nombreDelEmulador()} (${apk.serie})`;
      datos.versiones = {
        api: execFileSync("git", ["-C", "../barber", "log", "-1", "--format=%h %cs"], { encoding: "utf8" }).trim(),
        web: execFileSync("git", ["log", "-1", "--format=%h %cs"], { encoding: "utf8" }).trim(),
      };

      return `API ${api.status()} · web ${inicio.status()} · base lista · app ${String(datos.apk)} en ${String(datos.emulador)}`;
    });

    await paso("P", async () => {
      // Cliente sintético: registro y perfil completo con datos ficticios (como «Completa tu perfil»).
      const reg = await request.post(`${API_URL}/api/v1/auth/register`, { headers: JSON_HEADERS, data: { name: cliente.nombre, email: cliente.email, password: cliente.password, password_confirmation: cliente.password, device_name: "QA T057" } });
      expect(reg.status(), "el registro del cliente sintético debe responder 201").toBe(201);
      tokenCliente = ((await reg.json()) as { token: string }).token;
      const perfil = await request.put(`${API_URL}/api/v1/profile`, { headers: { ...JSON_HEADERS, Authorization: `Bearer ${tokenCliente}` }, data: { telefono: "5512345057", fecha_nacimiento: "1995-04-12", sexo: "prefiero_no_decir" } });
      expect(perfil.status(), "completar el perfil del cliente debe responder 200").toBe(200);

      // La cita es de HOY: el servicio solo puede iniciarse el día de la cita. Se elige la primera hora libre con al menos
      // 10 minutos de margen para reservar en la app.
      const servicios = (await request.get(`${API_URL}/api/v1/services`, { headers: JSON_HEADERS }).then((r) => r.json())) as { data: { id: string; nombre: string }[] };
      const servicio = servicios.data.find((s) => s.nombre === SERVICIO);
      const barberos = (await request.get(`${API_URL}/api/v1/barbers`, { headers: JSON_HEADERS }).then((r) => r.json())) as { data: { id: string; user?: { name?: string } }[] };
      expect(servicio && barberos.data[0]?.user?.name, `debe existir «${SERVICIO}» y un barbero`).toBeTruthy();
      barberoElegido = barberos.data[0]!.user!.name!;
      const [hoy, ahora] = ahoraLocal().split(" ") as [string, string];
      fecha = hoy;
      const s = await request.get(`${API_URL}/api/v1/availability/slots?barber_id=${barberos.data[0]!.id}&service_id=${servicio!.id}&date=${hoy}`, { headers: JSON_HEADERS });
      const slots = ((await s.json()) as { slots?: { time: string; label: string }[] }).slots ?? [];
      const [h, m] = ahora.split(":").map(Number) as [number, number];
      const minimo = h * 60 + m + 10;
      const libre = slots.find((x) => { const [sh, sm] = x.time.split(":").map(Number) as [number, number]; return sh * 60 + sm >= minimo; });
      expect(libre, `hoy (${hoy}) debe quedar un horario libre después de las ${ahora} + 10 min`).toBeTruthy();
      hora = libre!.label;
      datos.horario = `${hoy} ${libre!.time} (${libre!.label}) con ${barberoElegido}`;

      // Precondición 1: el cliente en la app.
      await apk!.abrirLimpia("Iniciar sesión");
      await apk!.tocar("Iniciar sesión");
      await apk!.esperar("Entrar a UrbanBlade");
      await apk!.escribir(0, cliente.email, "el correo del cliente");
      await apk!.escribir(1, cliente.password, "la contraseña del cliente", { oculto: true });
      await apk!.tocar("Entrar a UrbanBlade");
      await apk!.esperar("Mis citas", 90);
      await capturaApp(apk!, browser, testInfo, "P-app-cliente-en-sesion.png");

      // Precondición 2: la recepción en la web.
      await page.goto("/login");
      await page.waitForLoadState("networkidle").catch(() => {});
      await escribirSinRegistro(page, "#email", RECEPCION.email);
      await escribirSinRegistro(page, "#password", RECEPCION.password);
      const login = page.waitForResponse((r) => r.url().includes("/auth/login") && r.request().method() === "POST", { timeout: 60_000 });
      await page.getByRole("button", { name: "Ingresar" }).click();
      expect((await login).status(), "la recepción debe iniciar sesión en la web").toBe(200);
      await page.waitForURL(/\/dashboard/, { timeout: 60_000 });
      await page.goto("/appointments");
      await page.waitForLoadState("networkidle").catch(() => {});
      await expect(page.getByRole("heading", { name: /Citas & Reservas/ })).toBeVisible({ timeout: 60_000 });
      await capturaWeb(page, testInfo, "P-web-recepcion-en-sesion.png");

      return `Cliente sintético «${cliente.nombre}» en la app; recepción en la web («Citas & Reservas»). Cita elegida: ${String(datos.horario)}, ${SERVICIO}`;
    });

    Object.assign(ctx, { apk: apk!, web: page, browser, testInfo, cliente: cliente.nombre, barbero: "" });

    await paso("1", async () => {
      await reservarEnApp(apk!, fecha, hora, barberoElegido);
      await capturaApp(apk!, browser, testInfo, "1-app-revisa-y-reserva.png");
      await apk!.tocar("Reservar cita", 30);
      const exito = await apk!.esperar(/reservada|Reservaste|Cita confirmada|¡Listo/i, 60);
      await capturaApp(apk!, browser, testInfo, "1-app-cita-reservada.png");
      const citas = (await request.get(`${API_URL}/api/v1/appointments?per_page=50`, { headers: { ...JSON_HEADERS, Authorization: `Bearer ${tokenCliente}` } }).then((r) => r.json())) as { data: { code: string; estado: string }[] };
      expect(citas.data.length, "el cliente sintético debe tener exactamente una cita").toBe(1);
      codigo = citas.data[0]!.code;
      ctx.codigo = codigo;
      ACCIONES.push({ paso: "1", accion: "«Reservar cita» en la app", metodo: "POST", ruta: "/api/v1/appointments", estado: 201, mensaje: exito.texto || exito.descripcion });
      // Se vuelve al inicio de la app para ver la cita en «Mis citas».
      apk!.adb(["shell", "input", "keyevent", "4"]);
      await pausa(1500);

      return `${await revisarEstado(ctx, "1", "pendiente", "sin pago")} · cita ${codigo}`;
    });

    await paso("2", async () => {
      const fila = await filaWeb(page, cliente.nombre);
      await accionWeb(page, fila, "Confirmar", codigo, "2");
      return revisarEstado(ctx, "2", "confirmada", "sin pago");
    });

    await paso("3", async () => {
      const fila = await filaWeb(page, cliente.nombre);
      await fila.getByRole("link", { name: "Cobrar" }).click();
      const modal = page.getByRole("dialog").filter({ hasText: "Registro de Cobro" });
      await expect(modal).toBeVisible({ timeout: 60_000 });
      await expect(modal.getByText("Cargando citas por cobrar…")).toHaveCount(0, { timeout: 60_000 });
      await expect(modal.locator("select").first().locator("option:checked")).toContainText(cliente.nombre);
      await modal.getByText("Efectivo", { exact: true }).first().click();
      await capturaWeb(page, testInfo, "3-web-registro-de-cobro.png", modal);
      const respuesta = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/v1/payments" && r.request().method() === "POST", { timeout: 60_000 });
      await modal.getByRole("button", { name: "Confirmar y Cerrar Servicio" }).click();
      const r = await respuesta;
      const cuerpo = (await r.json().catch(() => ({}))) as { message?: string };
      ACCIONES.push({ paso: "3", accion: "«Confirmar y Cerrar Servicio» (efectivo) en la web", metodo: "POST", ruta: "/api/v1/payments", estado: r.status(), mensaje: cuerpo.message ?? "" });
      expect(r.status(), `el cobro debe responder 201${cuerpo.message ? ` (${cuerpo.message})` : ""}`).toBe(201);
      await expect(modal).toHaveCount(0, { timeout: 30_000 });

      return revisarEstado(ctx, "3", "confirmada", "pagada", "pago (confirmada)");
    });

    await paso("4", async () => {
      // «Iniciar» se habilita desde 15 minutos antes de la hora de la cita: si aún es pronto, se espera.
      const base = leerBase(codigo);
      const [h, m] = base.hora_inicio.split(":").map(Number) as [number, number];
      for (;;) {
        const [hh, mm] = ahoraLocal().split(" ")[1]!.split(":").map(Number) as [number, number];
        const faltan = h * 60 + m - MARGEN_INICIO_MIN - (hh * 60 + mm);
        if (faltan <= 0) break;
        datos.esperaParaIniciar = `${faltan} min (la cita es a las ${base.hora_inicio})`;
        await pausa(Math.min(faltan, 2) * 60_000);
      }
      const fila = await filaWeb(page, cliente.nombre);
      await accionWeb(page, fila, "Iniciar", codigo, "4");
      return revisarEstado(ctx, "4", "en_proceso", "pagada");
    });

    await paso("5", async () => {
      const fila = await filaWeb(page, cliente.nombre);
      await accionWeb(page, fila, "Completar", codigo, "5");
      const base = leerBase(codigo);
      datos.lealtad = base.lealtad;
      return `${await revisarEstado(ctx, "5", "completada", "pagada")} · puntos de lealtad: ${base.lealtad.puntos}`;
    });
  } finally {
    await paso("R", async () => {
      if (tokenCliente) await request.post(`${API_URL}/api/v1/auth/logout`, { headers: { ...JSON_HEADERS, Authorization: `Bearer ${tokenCliente}` } }).catch(() => {});
      if (!LIMPIAR) return "HUMO_T057_LIMPIAR=0: los datos se dejaron para revisarlos (bórralos con limpiar-t057.php y T057_BORRAR=1)";
      const salida = tinker("limpiar-t057.php", { T057_BORRAR: "1" });
      // tinker antepone «> » a la primera línea que imprime (la de los comprobantes PDF).
      datos.limpieza = salida.split("\n").map((l) => l.replace(/^> /, "")).filter((l) => /^\w[\w_]* +\d|Limpieza/.test(l)).map((l) => l.trim());
      const despues = tinker("limpiar-t057.php", {});
      expect(despues.match(/^(\w+) +(\d+)$/gm)?.every((l) => / 0$/.test(l)), "después de limpiar no debe quedar nada").toBe(true);
      return (datos.limpieza as string[]).join(" · ");
    }).catch(() => {});

    // ------------------------------------------------ Acta ------------------------------------------------
    datos.fin = ahoraLocal();
    datos.cita = codigo ? { codigo, fecha, hora, servicio: SERVICIO, barbero: ctx.barbero, cliente: cliente.nombre } : null;
    const accion1 = ["1", "2", "3", "4", "5"].every((n) => PASOS.find((p) => p.n === n)!.resultado !== "no se ejecutó")
      && ACCIONES.length >= 5 && ACCIONES.every((a) => a.estado === 200 || a.estado === 201);
    const accion2 = COMPARACIONES.length > 0 && COMPARACIONES.every((c) => c.coincide) && ["pendiente", "confirmada", "pago (confirmada)", "en_proceso", "completada"].every((e) => COMPARACIONES.some((c) => c.estado === e));
    const veredicto = accion1 && accion2
      ? "SIN FALLAS: la cita recorrió todos los estados sin errores y en cada paso el estado y los datos coinciden en la app, la web y la base."
      : `CON FALLAS: acción 1 ${accion1 ? "sin fallas" : "con fallas"}; acción 2 ${accion2 ? "sin fallas" : "con diferencias o incompleta"}.`;
    const md = [
      `# Acta T057 (HT-20) — estado de la cita en app, web y base — ${String(datos.inicio)} a ${String(datos.fin)}`,
      "",
      `- Entorno: local completo · web ${String(baseURL)} · API ${API_URL} · base MongoDB leída con leer-t057.php`,
      `- Versiones: API ${String((datos.versiones as { api?: string } | undefined)?.api ?? "—")} · web ${String((datos.versiones as { web?: string } | undefined)?.web ?? "—")} · app ${String(datos.apk ?? "—")}`,
      `- Emulador: ${String(datos.emulador ?? "—")}`,
      `- Cita sintética: ${codigo || "—"} · ${String(datos.horario ?? "—")} · ${SERVICIO} · ${ctx.barbero || "—"} · ${cliente.nombre}`,
      "",
      "| # | Paso | Esperado | Resultado | Detalle |",
      "|---|---|---|---|---|",
      ...PASOS.map((p) => `| ${p.n} | ${p.titulo} | ${p.esperado} | ${p.resultado} | ${p.detalle.replace(/\|/g, "/")} |`),
      "",
      "## Acción 1: cambios de estado pedidos y respuesta de la API",
      "",
      "| Paso | Acción | Petición | Respuesta |",
      "|---|---|---|---|",
      ...ACCIONES.map((a) => `| ${a.paso} | ${a.accion} | ${a.metodo} ${a.ruta} | ${a.estado}${a.mensaje ? ` · ${a.mensaje.replace(/\|/g, "/")}` : ""} |`),
      "",
      "## Acción 2: el mismo dato en la app, la web y la base",
      "",
      "| Estado | Dato | App (cliente) | Web (recepción) | Base | ¿Coincide? |",
      "|---|---|---|---|---|---|",
      ...COMPARACIONES.map((c) => `| ${c.estado} | ${c.campo} | ${c.app.replace(/\|/g, "/")} | ${c.web.replace(/\|/g, "/")} | ${c.base.replace(/\|/g, "/")} | ${c.coincide ? "sí" : "**NO**"} |`),
      "",
      `**Veredicto:** ${veredicto}`,
    ].join("\n");
    writeFileSync(testInfo.outputPath("acta-T057.md"), md);
    writeFileSync(testInfo.outputPath("datos-T057.json"), JSON.stringify({ datos, pasos: PASOS, acciones: ACCIONES, comparaciones: COMPARACIONES, veredicto }, null, 2));
    await testInfo.attach("acta-T057.md", { path: testInfo.outputPath("acta-T057.md"), contentType: "text/markdown" });
    console.log(`\n${md}\n`);
    if (apk) await apk.tocar("Inicio", 5).catch(() => {});
  }
  // Las diferencias no detuvieron la corrida, pero la prueba no pasa si hubo alguna (el detalle está en el acta).
  expect(diferencias, "pasos con diferencias entre la app, la web y la base").toBe(0);
});
