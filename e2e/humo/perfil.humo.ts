import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { expect, test, type APIRequestContext, type Browser, type Page, type TestInfo } from "@playwright/test";

import { Apk, type Nodo } from "./apk";

/*
 * T076 (HT-43): «Editar el perfil y verlo igual en la web y en la app». Prueba de integración de sistemas del módulo
 * «Perfil», con enfoque de caja negra, para RF-14 (Consulta y edición del perfil) y RF-24 (Información compartida
 * entre la app y la web).
 *
 *   1. Editar nombre y teléfono en la app: el cambio se guarda en la app.
 *   2. Consultarlo en la web: la web muestra el mismo nombre y teléfono.
 *   3. Intentar guardar un correo inválido: se rechaza (en la app, en la web y, como complemento, en la API).
 *
 * La cuenta es la del cliente de humo (HUMO_EMAIL / HUMO_PASSWORD de ~/.urbanblade-humo.env). Al terminar, la prueba
 * le regresa su nombre y su teléfono originales. Los correos y la contraseña no quedan en las capturas ni en el reporte.
 */

const API_URL = process.env.HUMO_API_URL ?? "https://api.urbanblade.com.mx";
const APK_RUTA = resolve(process.env.HUMO_APK ?? "../documentacion/HT-46/T075/apk/UrbanBlade-staging-main-095f168.apk");
const EMAIL = process.env.HUMO_EMAIL ?? "";
const CLAVE = process.env.HUMO_PASSWORD ?? "";
// Datos sintéticos. El nombre solo usa letras sin acento y espacios: adb no escribe acentos.
const NUEVO_NOMBRE = "Mateo Perfil T076";
const NUEVO_TELEFONO = "5598765432";
// El mismo correo inválido del caso de registro: le falta el dominio («.com», «.mx»…).
const CORREO_INVALIDO = "cliente@correo";
const AVISO_GUARDADO_APP = /actualizad/i;
const ERROR_CORREO_APP = "Revisa el correo.";
const ERROR_CORREO_WEB = /Ingresa un correo válido/;
const CORREO = /[\w.+-]+@[\w-]+\.[\w.-]+/;

// «defecto»: una comprobación complementaria (fuera de lo que pide el caso) que encontró un defecto; no hace fallar el caso.
type Resultado = "pasó" | "falló" | "no se ejecutó" | "defecto";
interface Paso { n: string; donde: string; titulo: string; esperado: string; resultado: Resultado; detalle: string }
const PASOS: Paso[] = [];
function nuevoPaso(n: string, donde: string, titulo: string, esperado: string) {
  PASOS.push({ n, donde, titulo, esperado, resultado: "no se ejecutó", detalle: "" });
}

nuevoPaso("0", "—", "Entorno: web, API y app", "Responden; la app queda instalada");
nuevoPaso("P", "API", "Precondición: sesión de cliente", "La cuenta inicia sesión como cliente; se anotan su nombre y teléfono");
nuevoPaso("1", "APK", "Editar nombre y teléfono en la app", "El cambio se guarda en la app");
nuevoPaso("2", "Web", "Consultar el perfil en la web", "La web muestra el mismo nombre y teléfono");
nuevoPaso("3-app", "APK", "Intentar guardar un correo inválido en la app", "El correo inválido se rechaza");
nuevoPaso("3-web", "Web", "Intentar guardar un correo inválido en la web", "El correo inválido se rechaza");
nuevoPaso("3-api", "API", "Complementaria: enviar el correo inválido directo a la API", "La API lo rechaza (422)");
nuevoPaso("R", "API", "Regresar la cuenta a su nombre y teléfono originales", "La cuenta queda como estaba");

/** Corre un paso. Si falla, lo marca en rojo en el reporte y sigue con el siguiente; al final la prueba falla. */
async function paso(n: string, fn: () => Promise<string>) {
  const p = PASOS.find((x) => x.n === n)!;
  try {
    await test.step(`${n} · ${p.titulo}`, async () => {
      try {
        p.detalle = await fn();
        if (p.resultado !== "defecto") p.resultado = "pasó";
      } catch (error) {
        p.resultado = "falló";
        const sinColores = (error as Error).message.split(String.fromCharCode(27)).map((t, i) => (i ? t.replace(/^\[[0-9;]*m/, "") : t)).join("");
        p.detalle = sinColores.split("\n")[0]!.replace(/^Error:\s*/, "").trim();
        throw error;
      }
    });
  } catch {
    // Ya quedó anotado: se sigue con el siguiente paso.
  }
}

const pausa = (ms: number) => new Promise((r) => setTimeout(r, ms));
const JSON_HEADERS = { Accept: "application/json" };

interface Perfil { name: string; email: string; telefono: string }

async function leerPerfil(request: APIRequestContext, token: string): Promise<Perfil> {
  const r = await request.get(`${API_URL}/api/v1/profile`, { headers: { ...JSON_HEADERS, Authorization: `Bearer ${token}` } });
  expect(r.status(), "GET /profile debe responder 200").toBe(200);
  const u = ((await r.json()) as { user: { name: string; email: string; client?: { telefono?: string | null } } }).user;

  return { name: u.name, email: u.email, telefono: u.client?.telefono ?? "" };
}

async function guardarPerfilApi(request: APIRequestContext, token: string, datos: Record<string, string | null>) {
  return request.put(`${API_URL}/api/v1/profile`, { headers: { ...JSON_HEADERS, Authorization: `Bearer ${token}` }, data: datos });
}

/** Captura de la web. Se tapan el correo real y la contraseña; con `campos: true` se ven los campos (para mostrar el correo inválido). */
async function capturaWeb(page: Page, testInfo: TestInfo, archivo: string, { campos = false } = {}) {
  const ruta = testInfo.outputPath(archivo);
  const tapar = [page.locator(campos ? 'input[type="password"]' : 'input[type="email"], input[type="password"], input[autocomplete="username"]'), page.getByText(CORREO)];
  await page.screenshot({ path: ruta, fullPage: true, mask: tapar });
  await testInfo.attach(archivo.replace(/\.png$/, ""), { path: ruta, contentType: "image/png" });
}

/** Tapa zonas de una captura del emulador (el correo) dibujando encima, sin depender de otra librería. */
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
  // Se tapa el correo de la cuenta y cualquier otro correo a la vista (por ejemplo, el de contacto del Aviso de
  // Privacidad, al pie de «Cuenta»). «cliente@correo» no tiene dominio, así que sigue a la vista (es el dato de prueba).
  const zonas = nodos
    .filter((n) => [n.texto, n.descripcion].some((t) => t.includes(EMAIL) || CORREO.test(t)))
    .map((n) => ({ x1: n.izquierda, y1: n.arriba, x2: n.derecha, y2: n.abajo }));
  await taparEnPng(browser, ruta, zonas);
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

async function entrarWeb(page: Page) {
  await page.goto("/login");
  await page.waitForLoadState("networkidle").catch(() => {});
  await escribirSinRegistro(page, "#email", EMAIL);
  await escribirSinRegistro(page, "#password", CLAVE);
  const respuesta = page.waitForResponse((r) => r.url().includes("/auth/login") && r.request().method() === "POST", { timeout: 60_000 });
  await page.getByRole("button", { name: "Ingresar" }).click();
  expect((await respuesta).status(), "POST /auth/login debe responder 200").toBe(200);
  await page.waitForURL(/\/dashboard/, { timeout: 60_000 });
}

async function abrirPerfilWeb(page: Page) {
  await page.goto("/profile");
  await expect(page.locator("#profile-name")).toBeVisible({ timeout: 60_000 });
  // El formulario se llena con GET /profile: se espera a que traiga el correo.
  await expect(page.locator("#profile-email")).not.toHaveValue("", { timeout: 30_000 });
  await page.waitForLoadState("networkidle").catch(() => {});
}

// ---------- App ----------

const camposApp = (nodos: Nodo[]) => nodos.filter((n) => n.clase === "android.widget.EditText").sort((a, b) => a.arriba - b.arriba);

function envuelve(fuera: Nodo, dentro: Nodo) {
  return fuera.izquierda <= dentro.izquierda && fuera.derecha >= dentro.derecha && fuera.arriba <= dentro.arriba && fuera.abajo >= dentro.abajo;
}

/** Un botón de Compose está deshabilitado si él o el contenedor que lo envuelve dice enabled=false. */
function botonHabilitado(nodos: Nodo[], boton: string) {
  const texto = nodos.find((n) => n.texto === boton || n.descripcion === boton);
  if (!texto) return false;

  return !nodos.some((n) => !n.habilitado && envuelve(n, texto));
}

/** Desliza hasta que aparezca lo que se busca (o se rinde tras varios intentos). */
async function deslizarHasta(apk: Apk, que: string, encontrado: (nodos: Nodo[]) => boolean, intentos = 6) {
  for (let i = 0; i <= intentos; i++) {
    if (encontrado(await apk.nodos())) return;
    apk.deslizar();
    await pausa(1200);
  }
  throw new Error(`La app no mostró ${que} al deslizar.`);
}

/** Los campos de «Información personal»: el correo es el que tiene el correo de la cuenta; nombre arriba, teléfono abajo. */
async function camposDelFormulario(apk: Apk, correoActual: string) {
  const campos = camposApp(await apk.nodos());
  const i = campos.findIndex((c) => c.texto === correoActual);
  if (i < 0) throw new Error("La app no muestra el campo del correo en «Información personal».");

  return { nombre: campos[i - 1], correo: campos[i]!, telefono: campos[i + 1] };
}

/** Reemplaza el texto de un campo (los espacios se escriben como %s) y comprueba lo que quedó. */
async function reemplazar(apk: Apk, ubicar: () => Promise<Nodo | undefined>, valor: string, que: string) {
  for (let intento = 0; intento < 3; intento++) {
    let campo = await ubicar();
    if (!campo) throw new Error(`La app no muestra el campo de ${que}.`);
    // Si quedó pegado arriba (bajo la barra de estado) o abajo (bajo la barra de navegación), se acomoda a media pantalla.
    if (campo.arriba < 250 || campo.abajo > 1900) {
      const bajar = campo.arriba < 250;
      apk.adb(["shell", "input", "swipe", "540", bajar ? "900" : "1500", "540", bajar ? "1400" : "1000", "400"]);
      await pausa(1200);
      campo = await ubicar();
      if (!campo) throw new Error(`La app no muestra el campo de ${que}.`);
    }
    apk.adb(["shell", "input", "tap", String(campo.x), String(campo.y)]);
    await pausa(1200);
    apk.adb(["shell", "input", "keyevent", "123"]);
    apk.adb(["shell", "input", "keyevent", ...Array<string>(Math.max(campo.texto.length, valor.length) + 5).fill("67")]);
    apk.adb(["shell", "input", "text", valor.replace(/ /g, "%s")]);
    await pausa(800);
    apk.ocultarTeclado();
    await pausa(800);
    if (camposApp(await apk.nodos()).some((c) => c.texto === valor)) return;
  }
  throw new Error(`La app no dejó escribir bien ${que} después de 3 intentos.`);
}

async function entrarApp(apk: Apk) {
  await apk.abrirLimpia("Iniciar sesión");
  await apk.tocar("Iniciar sesión");
  await apk.esperar("Entrar a UrbanBlade");
  await apk.escribir(0, EMAIL, "el correo de la cuenta");
  await apk.escribir(1, CLAVE, "la contraseña", { oculto: true });
  await apk.tocar("Entrar a UrbanBlade");
  await apk.esperar("Mis citas", 90);
  await apk.esperar("Inicio", 30);
}

/** Abre «Cuenta» y deja a la vista «Información personal» con el campo del correo. */
async function abrirDatosApp(apk: Apk, correoActual: string) {
  await apk.tocar("Cuenta");
  // «Cuenta» recuerda hasta dónde se deslizó: puede abrir arriba (encabezado) o ya en el formulario.
  await apk.esperar(/Información personal|Tu actividad|Guardar datos|Cerrar sesión/, 60);
  await pausa(1500);
  await deslizarHasta(apk, "el formulario «Información personal»", (nodos) => camposApp(nodos).some((c) => c.texto === correoActual));
}

test("T076: editar el perfil y verlo igual en la web y en la app (RF-14 y RF-24)", async ({ request, browser, baseURL }, testInfo) => {
  test.setTimeout(30 * 60_000);
  expect(EMAIL && CLAVE, "la cuenta del cliente (HUMO_EMAIL y HUMO_PASSWORD)").toBeTruthy();
  const datos: Record<string, unknown> = {};
  let apk: Apk | undefined;
  let token = "";
  let original: Perfil | undefined;

  try {
    await paso("0", async () => {
      const web = await request.get(`${baseURL}/login`);
      expect(web.status(), "la web debe responder").toBe(200);
      const api = await request.get(`${API_URL}/api/v1/services`, { headers: JSON_HEADERS });
      expect(api.status(), "la API debe responder").toBe(200);
      apk = Apk.elegirEmulador();
      apk.mantenerDespierto();
      // Entorno: el teclado del emulador (Gboard) abre el tutorial «Try out your stylus» al tocar un campo y se queda
      // con lo que se escribe. Se apaga la escritura con lápiz del emulador; no es parte de la app.
      apk.adb(["shell", "settings", "put", "secure", "stylus_handwriting_enabled", "0"]);
      Object.assign(datos, {
        entorno: "staging",
        web: baseURL,
        api: API_URL,
        apk: `${APK_RUTA.split(/[\\/]/).pop()} (SHA-256 ${apk.instalar(APK_RUTA)})`,
        emulador: `${apk.nombreDelEmulador()} (${apk.serie})`,
        datosNuevos: `nombre «${NUEVO_NOMBRE}», teléfono ${NUEVO_TELEFONO}`,
        correoInvalido: CORREO_INVALIDO,
      });

      return `${new Date().toISOString()} · web ${web.status()} · API ${api.status()} · app ${String(datos.apk)}`;
    });

    await paso("P", async () => {
      const r = await request.post(`${API_URL}/api/v1/auth/login`, { headers: JSON_HEADERS, data: { email: EMAIL, password: CLAVE, device_name: "QA T076 perfil" } });
      expect(r.status(), "la cuenta debe iniciar sesión").toBe(200);
      const cuerpo = (await r.json()) as { token: string; user: { roles: string[] } };
      expect(cuerpo.user.roles, "la cuenta debe ser de cliente").toContain("cliente");
      token = cuerpo.token;
      original = await leerPerfil(request, token);
      expect(original.email, "el perfil debe ser el de la cuenta").toBe(EMAIL);
      expect(original.name, "los datos nuevos deben ser distintos de los actuales").not.toBe(NUEVO_NOMBRE);
      datos.original = { nombre: original.name, telefono: original.telefono || "(vacío)" };

      return `Sesión de cliente (POST /auth/login 200). Antes: nombre «${original.name}», teléfono ${original.telefono || "(vacío)"}`;
    });

    // ---- Acción 1: editar nombre y teléfono en la app ----
    await paso("1", async () => {
      expect(apk && original, "sin app o sin la precondición no se puede editar").toBeTruthy();
      await entrarApp(apk!);
      await capturaApp(apk!, browser, testInfo, "1-a-app-inicio-antes.png");
      await abrirDatosApp(apk!, EMAIL);
      await capturaApp(apk!, browser, testInfo, "1-b-app-informacion-personal-antes.png");

      await reemplazar(apk!, async () => (await camposDelFormulario(apk!, EMAIL)).nombre, NUEVO_NOMBRE, "el nombre");
      await reemplazar(apk!, async () => (await camposDelFormulario(apk!, EMAIL)).telefono, NUEVO_TELEFONO, "el teléfono");
      await capturaApp(apk!, browser, testInfo, "1-c-app-datos-editados.png");

      await deslizarHasta(apk!, "el botón «Guardar datos»", (nodos) => nodos.some((n) => n.texto === "Guardar datos"));
      expect(botonHabilitado(await apk!.nodos(), "Guardar datos"), "«Guardar datos» debe activarse al cambiar algo").toBe(true);
      await apk!.tocar("Guardar datos");
      const aviso = await apk!.esperar(AVISO_GUARDADO_APP, 60);
      await pausa(1500);
      await capturaApp(apk!, browser, testInfo, "1-d-app-datos-guardados.png");

      // En la app: el formulario conserva lo nuevo y el inicio saluda con el nuevo nombre.
      const form = await camposDelFormulario(apk!, EMAIL).catch(async () => {
        await deslizarHasta(apk!, "el formulario", (nodos) => camposApp(nodos).some((c) => c.texto === EMAIL));
        return camposDelFormulario(apk!, EMAIL);
      });
      expect(form.nombre?.texto, "la app debe mostrar el nombre nuevo").toBe(NUEVO_NOMBRE);
      expect(form.telefono?.texto, "la app debe mostrar el teléfono nuevo").toBe(NUEVO_TELEFONO);
      await apk!.tocar("Inicio");
      const saludo = await apk!.esperar(new RegExp(NUEVO_NOMBRE.split(" ")[0]!), 30);
      await pausa(1500);
      await capturaApp(apk!, browser, testInfo, "1-e-app-inicio-con-el-nuevo-nombre.png");

      // Y quedó guardado en el servidor (la misma API que usa la web).
      const guardado = await leerPerfil(request, token);
      expect(guardado.name, "la API debe tener el nombre nuevo").toBe(NUEVO_NOMBRE);
      expect(guardado.telefono, "la API debe tener el teléfono nuevo").toBe(NUEVO_TELEFONO);
      datos.accion1 = { avisoApp: aviso.texto || aviso.descripcion, saludoInicio: saludo.texto || saludo.descripcion, api: guardado.name };

      return `La app muestra «${aviso.texto || aviso.descripcion}»; el formulario queda con «${NUEVO_NOMBRE}» y ${NUEVO_TELEFONO}; el inicio saluda «${saludo.texto || saludo.descripcion}»; GET /profile devuelve lo nuevo`;
    });

    // ---- Acción 2: consultarlo en la web ----
    await paso("2", async () => {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      try {
        await entrarWeb(page);
        await page.waitForLoadState("networkidle").catch(() => {});
        const primerNombre = NUEVO_NOMBRE.split(" ")[0]!;
        await expect(page.getByText(primerNombre).first(), "el panel debe saludar con el nombre nuevo").toBeVisible({ timeout: 60_000 });
        await capturaWeb(page, testInfo, "2-a-web-panel-con-el-nuevo-nombre.png");
        await abrirPerfilWeb(page);
        const nombre = await page.locator("#profile-name").inputValue();
        const telefono = await page.locator("#profile-phone").inputValue();
        await capturaWeb(page, testInfo, "2-b-web-mi-perfil-mismos-datos.png");
        expect(nombre, "la web debe mostrar el mismo nombre").toBe(NUEVO_NOMBRE);
        expect(telefono, "la web debe mostrar el mismo teléfono").toBe(NUEVO_TELEFONO);
        await expect(page.locator("h1", { hasText: NUEVO_NOMBRE }), "el encabezado del perfil debe mostrar el nombre nuevo").toBeVisible();
        datos.accion2 = { nombreWeb: nombre, telefonoWeb: telefono };

        return `La web saluda con «${primerNombre}» y «Mi perfil» muestra nombre «${nombre}» y teléfono ${telefono}, igual que la app`;
      } finally {
        await ctx.close();
      }
    });

    // ---- Acción 3: correo inválido ----
    await paso("3-app", async () => {
      expect(apk, "sin app").toBeTruthy();
      await abrirDatosApp(apk!, EMAIL);
      await reemplazar(apk!, async () => (await camposDelFormulario(apk!, EMAIL)).correo, CORREO_INVALIDO, "el correo");
      const error = await apk!.esperar(ERROR_CORREO_APP, 15);
      await deslizarHasta(apk!, "el botón «Guardar datos»", (nodos) => nodos.some((n) => n.texto === "Guardar datos"));
      const habilitado = botonHabilitado(await apk!.nodos(), "Guardar datos");
      await capturaApp(apk!, browser, testInfo, "3-a-app-correo-invalido-rechazado.png");
      expect(habilitado, "con el correo inválido, «Guardar datos» debe quedar desactivado").toBe(false);
      const despues = await leerPerfil(request, token);
      expect(despues.email, "el correo de la cuenta no debe cambiar").toBe(EMAIL);
      // Se sale sin guardar.
      await apk!.tocar("Inicio");

      return `La app marca «${error.texto || error.descripcion}» bajo el correo y deja «Guardar datos» desactivado; no se envía nada y el correo de la cuenta no cambia`;
    });

    await paso("3-web", async () => {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      try {
        await entrarWeb(page);
        await abrirPerfilWeb(page);
        let enviados = 0;
        page.on("request", (r) => {
          if (r.method() === "PUT" && /\/profile$/.test(new URL(r.url()).pathname)) enviados++;
        });
        await escribirSinRegistro(page, "#profile-email", CORREO_INVALIDO);
        await page.getByRole("button", { name: "Guardar cambios" }).click();
        const error = page.locator("#profile-email-error");
        await expect(error, "la web debe marcar el correo").toHaveText(ERROR_CORREO_WEB, { timeout: 15_000 });
        await page.waitForTimeout(1500);
        await capturaWeb(page, testInfo, "3-b-web-correo-invalido-rechazado.png", { campos: true });
        expect(enviados, "la web no debe enviar el perfil con el correo inválido").toBe(0);
        const despues = await leerPerfil(request, token);
        expect(despues.email, "el correo de la cuenta no debe cambiar").toBe(EMAIL);

        return `La web marca «${(await error.innerText()).trim()}» bajo el correo y no envía PUT /profile; el correo de la cuenta no cambia`;
      } finally {
        await ctx.close();
      }
    });

    await paso("3-api", async () => {
      const r = await guardarPerfilApi(request, token, { email: CORREO_INVALIDO });
      const cuerpo = (await r.json().catch(() => ({}))) as { message?: string; errors?: Record<string, string[]> };
      datos.accion3Api = { estado: r.status(), mensaje: cuerpo.message, errores: cuerpo.errors };
      if (r.status() < 300) {
        // Lo aceptó: se regresa el correo de inmediato para no dejar la cuenta con un correo inválido.
        const regreso = await guardarPerfilApi(request, token, { email: EMAIL });
        expect(regreso.status(), "el correo de la cuenta debe poder regresarse").toBe(200);
        expect((await leerPerfil(request, token)).email, "la cuenta debe recuperar su correo").toBe(EMAIL);
        datos.accion3Api = { ...(datos.accion3Api as object), correoRegresado: regreso.status() };
        PASOS.find((p) => p.n === "3-api")!.resultado = "defecto";

        return `La API ACEPTA «${CORREO_INVALIDO}» (PUT /profile ${r.status()} «${cuerpo.message ?? ""}»): solo la app y la web lo validan. El correo se regresó al instante (PUT /profile ${regreso.status()})`;
      }
      expect(r.status(), `PUT /profile con «${CORREO_INVALIDO}» debe rechazarse (422)`).toBe(422);
      expect(Object.keys(cuerpo.errors ?? {}), "el error debe ser del correo").toContain("email");

      return `PUT /profile 422: ${cuerpo.errors?.email?.[0] ?? cuerpo.message ?? ""}`;
    });
  } finally {
    await paso("R", async () => {
      expect(token && original, "sin sesión o sin los datos originales no hay qué regresar").toBeTruthy();
      const r = await guardarPerfilApi(request, token, { name: original!.name, email: original!.email, telefono: original!.telefono || null });
      expect(r.status(), "PUT /profile debe responder 200").toBe(200);
      const ahora = await leerPerfil(request, token);
      expect(ahora, "la cuenta debe quedar como estaba").toEqual(original);
      await request.post(`${API_URL}/api/v1/auth/logout`, { headers: { ...JSON_HEADERS, Authorization: `Bearer ${token}` } }).catch(() => {});

      return `La cuenta vuelve a «${original!.name}» y ${original!.telefono || "(sin teléfono)"}`;
    });

    const fallidos = PASOS.filter((p) => p.resultado === "falló" && p.n !== "R");
    const defectos = PASOS.filter((p) => p.resultado === "defecto").map((p) => p.n);
    const veredicto = fallidos.length
      ? `FALLIDA: falló ${fallidos.map((p) => p.n).join(", ")}.`
      : PASOS.some((p) => p.resultado === "no se ejecutó")
        ? "NO EJECUTADA COMPLETA: hay pasos sin correr."
        : `APROBADA: el cambio hecho en la app se ve igual en la web y el correo inválido se rechaza en la app y en la web.${defectos.length ? ` Con defecto en la comprobación complementaria ${defectos.join(", ")}.` : ""}`;
    const md = [
      `# Acta T076 (HT-43) — Editar el perfil y verlo igual en la web y en la app — ${new Date().toISOString()}`,
      "",
      ...Object.entries(datos).filter(([, v]) => typeof v === "string").map(([k, v]) => `- ${k}: ${String(v)}`),
      "",
      "| # | Dónde | Paso | Resultado esperado | Resultado | Detalle |",
      "|---|---|---|---|---|---|",
      ...PASOS.map((p) => `| ${p.n} | ${p.donde} | ${p.titulo} | ${p.esperado} | ${p.resultado} | ${p.detalle.replace(/\|/g, "/")} |`),
      "",
      `**Veredicto (staging):** ${veredicto}`,
    ].join("\n");
    writeFileSync(testInfo.outputPath("acta-T076-perfil.md"), md);
    writeFileSync(testInfo.outputPath("datos-T076-perfil.json"), JSON.stringify({ ...datos, pasos: PASOS, veredicto }, null, 2));
    await testInfo.attach("acta-T076-perfil.md", { path: testInfo.outputPath("acta-T076-perfil.md"), contentType: "text/markdown" });
    console.log(`\n${md}\n`);
  }

  expect(PASOS.filter((p) => p.resultado === "falló").map((p) => `${p.n}: ${p.detalle}`), "pasos que fallaron").toEqual([]);
});
