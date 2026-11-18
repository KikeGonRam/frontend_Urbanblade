import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { chromium, devices, expect, firefox, test, type Browser, type BrowserContextOptions, type LaunchOptions, type Page } from "@playwright/test";

/*
 * T100 (HT-31): «Plataforma web en Chrome, Edge y Firefox». Prueba de integración de sistemas del módulo
 * «Compatibilidad web», con enfoque de caja negra, para RNF-13 (Compatibilidad de navegadores).
 *
 * Acción: ejecutar en cada navegador los flujos de agenda, citas y reportes. Resultado esperado: funcionan igual en
 * los tres; cada diferencia se registra con captura.
 *
 * Cada navegador corre los mismos flujos y deja una «huella» de lo que vio (cuántos días y horarios, filas, citas,
 * indicadores, archivos descargados…), sus capturas y los errores de la consola. Al final, «comparar» pone las
 * huellas lado a lado, mide cuánto difiere cada captura de la de Chrome y arma una comparativa por flujo.
 *
 *   staging (HUMO_ENTORNO sin definir): cuenta de cliente → acceso, agenda para reservar (sin confirmar) y sus citas.
 *   local (HUMO_ENTORNO=local): cuentas sintéticas de personal → citas y calendario (recepción), agenda del barbero
 *   y reportes con descarga (administrador). La web y la API locales se sirven desde un mismo origen, sin CORS.
 *
 * Navegadores: Chrome y Edge instalados (channel), Firefox de Playwright y Brave como extra. HUMO_NAVEGADORES
 * elige cuáles (por ejemplo «chrome,firefox»). Los resultados quedan en ~/.urbanblade-humo-compat/<entorno>.
 */

const LOCAL = process.env.HUMO_ENTORNO === "local";
const ENTORNO = LOCAL ? "local" : "staging";
const BRAVE = process.env.HUMO_BRAVE ?? "C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe";
const DIR = process.env.HUMO_COMPAT_DIR ?? join(homedir(), ".urbanblade-humo-compat", ENTORNO);
const CORREO = /[\w.+-]+@[\w-]+\.[\w.-]+/;
const env = process.env;

// Cada navegador se abre desde la prueba (Playwright no deja cambiar de navegador con test.use dentro de un archivo).
interface Navegador { id: string; nombre: string; requerido: boolean; motor: "chromium" | "firefox"; lanzar: LaunchOptions; dispositivo: keyof typeof devices }
const TODOS: Navegador[] = [
  { id: "chrome", nombre: "Chrome", requerido: true, motor: "chromium", lanzar: { channel: "chrome" }, dispositivo: "Desktop Chrome" },
  { id: "edge", nombre: "Edge", requerido: true, motor: "chromium", lanzar: { channel: "msedge" }, dispositivo: "Desktop Edge" },
  { id: "firefox", nombre: "Firefox", requerido: true, motor: "firefox", lanzar: {}, dispositivo: "Desktop Firefox" },
  { id: "brave", nombre: "Brave (extra)", requerido: false, motor: "chromium", lanzar: { executablePath: BRAVE }, dispositivo: "Desktop Chrome" },
];
const ELEGIDOS = (env.HUMO_NAVEGADORES ?? TODOS.map((n) => n.id).join(",")).split(",").map((s) => s.trim());
const NAVEGADORES = TODOS.filter((n) => ELEGIDOS.includes(n.id));

interface Cuenta { rol: string; email?: string; password?: string }
const CUENTAS: Record<string, Cuenta> = {
  cliente: { rol: "cliente", email: env.HUMO_EMAIL, password: env.HUMO_PASSWORD },
  recepcion: { rol: "recepcionista", email: env.HUMO_RECEPCION_EMAIL ?? env.HUMO_STAFF_EMAIL, password: env.HUMO_RECEPCION_PASSWORD ?? env.HUMO_STAFF_PASSWORD },
  barbero: { rol: "barbero", email: env.HUMO_BARBERO_EMAIL, password: env.HUMO_BARBERO_PASSWORD },
  admin: { rol: "administrador", email: env.HUMO_ADMIN_EMAIL, password: env.HUMO_ADMIN_PASSWORD },
};

type Huella = Record<string, unknown>;
interface Flujo { id: string; nombre: string; cuenta: keyof typeof CUENTAS; correr: (page: Page, cap: Capturador) => Promise<Huella> }
type Capturador = (nombre: string, opciones?: { campos?: boolean }) => Promise<void>;
interface ResultadoFlujo { id: string; nombre: string; estado: "pasó" | "falló" | "bloqueado"; detalle: string; huella: Huella; capturas: string[]; erroresConsola: string[]; segundos: number }
interface ResultadoNavegador { navegador: string; nombre: string; version: string; userAgent: string; inicio: string; flujos: ResultadoFlujo[] }

const limpiar = (t: string) => t.replace(/\s+/g, " ").trim();

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

async function entrar(page: Page, cuenta: Cuenta) {
  await page.goto("/login");
  await page.waitForLoadState("networkidle").catch(() => {});
  await escribirSinRegistro(page, "#email", cuenta.email!);
  await escribirSinRegistro(page, "#password", cuenta.password!);
  const respuesta = page.waitForResponse((r) => r.url().includes("/auth/login") && r.request().method() === "POST", { timeout: 60_000 });
  await page.getByRole("button", { name: "Ingresar" }).click();
  expect((await respuesta).status(), "POST /auth/login debe responder 200").toBe(200);
  await page.waitForURL(/\/dashboard/, { timeout: 60_000 });
}

/**
 * El identificador (userAgent) que manda cada navegador de verdad, con su versión. Hace falta darlo: el ejecutor de
 * Playwright pone a toda ventana nueva el de su configuración general (el de Chrome), también a Firefox.
 */
function identificador(nav: Navegador, version: string) {
  const mayor = version.split(".")[0];
  const chromium = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${mayor}.0.0.0 Safari/537.36`;
  if (nav.motor === "firefox") return `Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:${mayor}.0) Gecko/20100101 Firefox/${mayor}.0`;
  return nav.id === "edge" ? `${chromium} Edg/${mayor}.0.0.0` : chromium;
}

function mensaje(error: unknown) {
  return limpiar((error as Error).message.split(String.fromCharCode(27)).map((t, i) => (i ? t.replace(/^\[[0-9;]*m/, "") : t)).join("")).slice(0, 300);
}

// La API acepta 5 accesos por minuto por cuenta e IP: la prueba deja como máximo 4 por cuenta en cualquier minuto.
const accesos = new Map<string, number[]>();
async function respetarLimiteDeAcceso(email: string) {
  const lista = accesos.get(email) ?? [];
  for (;;) {
    const ahora = Date.now();
    while (lista.length && ahora - lista[0]! > 61_000) lista.shift();
    if (lista.length < 4) break;
    await new Promise((r) => setTimeout(r, 61_000 - (ahora - lista[0]!) + 500));
  }
  lista.push(Date.now());
  accesos.set(email, lista);
}

async function esperarCarga(page: Page) {
  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
  await page.waitForTimeout(800);
}

// ---------------------------------------------------------------- Flujos ----------------------------------------------------------------

const FLUJOS_STAGING: Flujo[] = [
  {
    id: "acceso",
    nombre: "Acceso del cliente",
    cuenta: "cliente",
    correr: async (page, cap) => {
      await expect(page.locator('[aria-label="Tu nivel"]').first(), "el panel del cliente debe mostrar «Tu nivel»").toBeVisible({ timeout: 60_000 });
      await esperarCarga(page);
      await cap("panel");
      return { panelCliente: true, saludo: limpiar((await page.locator("h1").first().innerText()).split(",")[0] ?? "") };
    },
  },
  {
    id: "agenda",
    nombre: "Agenda: elegir servicio, barbero, día y horario (sin confirmar)",
    cuenta: "cliente",
    correr: async (page, cap) => {
      await page.goto("/reservar");
      await esperarCarga(page);
      // Paso 1: servicio.
      const servicios = page.locator('section[aria-labelledby="paso-servicio"] button');
      await expect(servicios.first(), "debe listar los servicios").toBeVisible({ timeout: 60_000 });
      const totalServicios = await servicios.count();
      const servicio = limpiar(await servicios.first().locator("span.block").first().innerText());
      await cap("servicios");
      await servicios.first().click();
      // Paso 2: barbero (el botón sin etiqueta; el de la estrella es para marcar favorito).
      const barberos = page.locator('section[aria-labelledby="paso-barbero"] button:not([aria-label])');
      await expect(barberos.first(), "debe listar los barberos").toBeVisible({ timeout: 60_000 });
      const totalBarberos = await barberos.count();
      const barbero = limpiar((await barberos.first().innerText()).split("\n")[0] ?? "");
      await barberos.first().click();
      await esperarCarga(page);
      // Paso 3: día y horario.
      const dias = page.getByRole("group", { name: "Elegir día" }).getByRole("button");
      await expect(dias.first(), "debe mostrar los días para elegir").toBeVisible({ timeout: 60_000 });
      const totalDias = await dias.count();
      const horas = page.getByRole("button", { name: /^\d{1,2}:\d{2}$/ });
      let diaElegido = "";
      let totalHoras = 0;
      for (let i = 0; i < totalDias && !totalHoras; i++) {
        await dias.nth(i).click();
        await expect(page.getByText(/disponibles? para|ya no tiene horarios libres|Sin horarios libres ese día|No se pudieron cargar los horarios/).first()).toBeVisible({ timeout: 30_000 });
        totalHoras = await horas.count();
        if (totalHoras) diaElegido = limpiar(await dias.nth(i).innerText());
      }
      expect(totalHoras, "algún día debe tener horarios libres").toBeGreaterThan(0);
      const primeraHora = limpiar(await horas.first().innerText());
      await horas.first().click();
      await expect(page.getByRole("button", { name: "Confirmar cita" }), "con día y hora elegidos, debe aparecer «Confirmar cita»").toBeVisible({ timeout: 30_000 });
      await esperarCarga(page);
      await cap("horario-elegido");
      // No se confirma: reservar crearía una cita real.
      return { totalServicios, servicio, totalBarberos, barbero, totalDias, diaElegido, totalHoras, primeraHora, confirmarVisible: true };
    },
  },
  {
    id: "citas",
    nombre: "Citas: «Mis citas» del cliente",
    cuenta: "cliente",
    correr: async (page, cap) => {
      await page.goto("/my/appointments");
      await expect(page.locator("h1").first()).toBeVisible({ timeout: 60_000 });
      await expect(page.getByText("Cargando tus citas…")).toHaveCount(0, { timeout: 60_000 });
      await esperarCarga(page);
      const resumen = page.locator('[aria-label="Resumen de tus citas"]');
      const textoResumen = (await resumen.count()) ? limpiar(await resumen.innerText()) : "(sin resumen: no hay citas)";
      await cap("mis-citas");
      return { titulo: limpiar(await page.locator("h1").first().innerText()), resumen: textoResumen, proxima: (await page.getByText("Tu próxima cita").count()) > 0 };
    },
  },
];

const FLUJOS_LOCAL: Flujo[] = [
  {
    id: "citas",
    nombre: "Citas: lista, filtro por estado y detalle (recepción)",
    cuenta: "recepcion",
    correr: async (page, cap) => {
      await page.goto("/appointments");
      const filas = page.locator("tbody tr");
      // Mientras la lista carga, la página muestra un esqueleto «Cargando citas…» (la API local tarda).
      const cargando = page.locator('[aria-busy="true"][aria-label="Cargando citas…"]');
      await expect(filas.first(), "la lista de citas debe mostrar filas").toBeVisible({ timeout: 60_000 });
      await expect(cargando).toHaveCount(0, { timeout: 60_000 });
      await esperarCarga(page);
      const total = await filas.count();
      await cap("lista");
      const estado = page.locator('select[aria-label="Filtrar por estado"]');
      const opciones = await estado.locator("option").evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value).filter(Boolean));
      const elegido = opciones.includes("completada") ? "completada" : (opciones[0] ?? "");
      const respuesta = page.waitForResponse((r) => new URL(r.url()).pathname.endsWith("/appointments") && r.url().includes(elegido), { timeout: 60_000 }).catch(() => null);
      await estado.selectOption(elegido);
      await respuesta;
      await expect(cargando, "la lista filtrada debe terminar de cargar").toHaveCount(0, { timeout: 60_000 });
      await esperarCarga(page);
      const filtradas = await filas.count();
      // Todas las filas que quedan deben ser del estado elegido.
      const estados = (await page.locator("tbody tr").allInnerTexts()).filter((f) => !new RegExp(elegido, "i").test(f)).length;
      await cap("filtro-estado");
      const detalle = page.getByRole("button", { name: /Ver detalle de la cita de/ }).first();
      let tituloDetalle = "(sin botón de detalle)";
      if (await detalle.count()) {
        await detalle.click();
        const dialogo = page.getByRole("dialog").first();
        await expect(dialogo, "el detalle de la cita debe abrir").toBeVisible({ timeout: 30_000 });
        await page.waitForTimeout(600);
        tituloDetalle = limpiar((await dialogo.locator("h2, h3").first().innerText().catch(() => "")) || "(diálogo sin título)");
        await cap("detalle");
        await page.keyboard.press("Escape");
      }
      return { filas: total, filtro: elegido, filasFiltradas: filtradas, filasDeOtroEstado: estados, detalle: tituloDetalle };
    },
  },
  {
    id: "agenda",
    nombre: "Agenda: calendario de citas en día, semana y mes (recepción)",
    cuenta: "recepcion",
    correr: async (page, cap) => {
      await page.goto("/appointments/calendar");
      const fc = page.locator(".fc").first();
      await expect(fc, "el calendario (FullCalendar) debe dibujarse").toBeVisible({ timeout: 60_000 });
      await esperarCarga(page);
      const vistaInicial = (await page.locator(".fc-view").first().getAttribute("class"))?.match(/fc-(\w+)-view/)?.[1] ?? "";
      await cap("dia");
      const huella: Huella = { vistaInicial, titulos: {}, eventos: {} };
      for (const [vista, boton] of [["semana", ".fc-timeGridWeek-button"], ["mes", ".fc-dayGridMonth-button"]] as const) {
        // Al cambiar de vista, el calendario pide las citas de ese rango: se espera esa respuesta y a que el número de
        // citas en pantalla deje de cambiar (la API local tarda alrededor de un segundo por consulta).
        const datos = page.waitForResponse((r) => r.url().includes("/appointments/calendar-data"), { timeout: 30_000 }).catch(() => null);
        await page.locator(boton).click();
        await datos;
        await esperarCarga(page);
        await expect.poll(async () => {
          const antes = await page.locator(".fc-event").count();
          await page.waitForTimeout(700);
          return antes === (await page.locator(".fc-event").count());
        }, { timeout: 15_000 }).toBe(true);
        (huella.titulos as Record<string, string>)[vista] = limpiar(await page.locator(".fc-toolbar-title").innerText());
        (huella.eventos as Record<string, number>)[vista] = await page.locator(".fc-event").count();
        await cap(vista);
      }
      return huella;
    },
  },
  {
    id: "agenda-barbero",
    nombre: "Agenda del barbero: «Mi Agenda» por semana",
    cuenta: "barbero",
    correr: async (page, cap) => {
      await page.goto("/barber/agenda");
      await expect(page.getByRole("heading", { name: /Mi Agenda/ }), "debe abrir «Mi Agenda»").toBeVisible({ timeout: 60_000 });
      await esperarCarga(page);
      await page.locator("#agenda-periodo").selectOption("week");
      await esperarCarga(page);
      const citas = await page.locator("article").count();
      await cap("semana");
      return { periodo: "week", citas };
    },
  },
  {
    id: "reportes",
    nombre: "Reportes: indicadores, gráficas, periodo y descarga (administrador)",
    cuenta: "admin",
    correr: async (page, cap) => {
      await page.goto("/reports");
      const kpis = page.locator('[aria-label="Indicadores del periodo"]');
      await expect(kpis, "deben verse los indicadores del periodo").toBeVisible({ timeout: 60_000 });
      // Mientras calcula, la página dice «Calculando métricas…» (la API local tarda).
      const calculando = page.getByText("Calculando métricas…");
      await expect(calculando).toHaveCount(0, { timeout: 60_000 });
      await esperarCarga(page);
      const leerKpis = async () => (await kpis.locator(":scope > *").allInnerTexts()).map(limpiar);
      // Una gráfica «dibujada» tiene píxeles que no son transparentes.
      const graficas = async () =>
        page.locator("canvas").evaluateAll((cs) =>
          cs.map((c) => {
            const lienzo = c as HTMLCanvasElement;
            const ctx = lienzo.getContext("2d");
            if (!ctx || !lienzo.width || !lienzo.height) return false;
            const datos = ctx.getImageData(0, 0, lienzo.width, lienzo.height).data;
            for (let i = 3; i < datos.length; i += 4 * 97) if (datos[i]! > 0) return true;
            return false;
          }),
        );
      const periodos = page.getByRole("tablist", { name: "Periodo del reporte" });
      const periodoInicial = limpiar(await periodos.getByRole("tab", { selected: true }).innerText());
      const kpisInicial = await leerKpis();
      const dibujadas = await graficas();
      await cap("indicadores");
      await periodos.getByRole("tab", { name: "Este año" }).click();
      // El aviso aparece un instante después del clic: primero se espera a que salga y luego a que se vaya.
      await calculando.waitFor({ state: "visible", timeout: 5_000 }).catch(() => {});
      await expect(calculando, "las métricas del año deben terminar de calcularse").toHaveCount(0, { timeout: 60_000 });
      await esperarCarga(page);
      const kpisAnio = await leerKpis();
      const dibujadasAnio = await graficas();
      await cap("periodo-anio");
      // Descarga del reporte de citas en Excel y en PDF.
      const descargas: Record<string, { archivo: string; bytes: boolean }> = {};
      const tarjeta = page.locator("div.rounded-xl").filter({ has: page.getByText("Citas", { exact: true }) }).filter({ has: page.getByRole("button", { name: "Excel" }) }).first();
      for (const formato of ["Excel", "PDF"]) {
        const espera = page.waitForEvent("download", { timeout: 90_000 });
        await tarjeta.getByRole("button", { name: formato }).click();
        const descarga = await espera;
        const ruta = await descarga.path();
        descargas[formato] = { archivo: descarga.suggestedFilename(), bytes: Boolean(ruta && readFileSync(ruta).length > 0) };
      }
      await page.getByText("Exportar reporte detallado").scrollIntoViewIfNeeded();
      await cap("exportar");
      return { periodoInicial, kpisInicial, graficas: dibujadas.length, graficasDibujadas: dibujadas.filter(Boolean).length, kpisAnio, graficasDibujadasAnio: dibujadasAnio.filter(Boolean).length, descargas };
    },
  },
];

const FLUJOS = LOCAL ? FLUJOS_LOCAL : FLUJOS_STAGING;

// ---------------------------------------------------------------- Corrida por navegador ----------------------------------------------------------------

for (const nav of NAVEGADORES) {
  test.describe(nav.nombre, () => {
    test(`T100 (${ENTORNO}): agenda, citas y reportes en ${nav.nombre}`, async ({ baseURL }, testInfo) => {
      test.setTimeout(20 * 60_000);
      const browser = await (nav.motor === "firefox" ? firefox : chromium).launch(nav.lanzar);
      try {
        mkdirSync(join(DIR, nav.id), { recursive: true });
        const resultado: ResultadoNavegador = { navegador: nav.id, nombre: nav.nombre, version: browser.version(), userAgent: "", inicio: new Date().toISOString(), flujos: [] };

        // Una sesión por cuenta y navegador: la API acepta 5 accesos por minuto por cuenta (más daría 429).
        const cuentas = [...new Set(FLUJOS.map((f) => f.cuenta))];
        for (const clave of cuentas) {
          const cuenta = CUENTAS[clave]!;
          const flujos = FLUJOS.filter((f) => f.cuenta === clave);
          const resultados = flujos.map((f) => ({ id: f.id, nombre: f.nombre, estado: "falló", detalle: "", huella: {}, capturas: [], erroresConsola: [], segundos: 0 }) as ResultadoFlujo);
          resultado.flujos.push(...resultados);
          if (!cuenta.email || !cuenta.password) {
            for (const r of resultados) Object.assign(r, { estado: "bloqueado", detalle: `No hay cuenta de ${cuenta.rol} en este entorno` });
            continue;
          }
          // Misma ventana en todos (1280×720, español de México); cada navegador con su propio identificador (userAgent).
          const dispositivo = devices[nav.dispositivo]!;
          const ctx = await browser.newContext({
            userAgent: identificador(nav, browser.version()),
            viewport: dispositivo.viewport,
            deviceScaleFactor: dispositivo.deviceScaleFactor,
            locale: "es-MX",
            timezoneId: "America/Mexico_City",
            baseURL,
            storageState: testInfo.project.use.storageState as BrowserContextOptions["storageState"],
          });
          const page = await ctx.newPage();
          let actual: ResultadoFlujo = resultados[0]!;
          page.on("console", (m) => {
            if (m.type() === "error") actual.erroresConsola.push(limpiar(m.text()).replace(CORREO, "[correo]").slice(0, 200));
          });
          page.on("pageerror", (e) => actual.erroresConsola.push(`pageerror: ${limpiar(e.message).replace(CORREO, "[correo]").slice(0, 200)}`));
          try {
            await respetarLimiteDeAcceso(cuenta.email);
            await entrar(page, cuenta);
            if (!resultado.userAgent) resultado.userAgent = await page.evaluate(() => navigator.userAgent);
          } catch (error) {
            for (const r of resultados) Object.assign(r, { estado: "falló", detalle: `No pudo iniciar sesión como ${cuenta.rol}: ${mensaje(error)}` });
            await ctx.close();
            continue;
          }
          for (const [i, flujo] of flujos.entries()) {
            const r = resultados[i]!;
            actual = r;
            const inicio = Date.now();
            const cap: Capturador = async (nombre, { campos = false } = {}) => {
              const archivo = `${flujo.id}-${nombre}.png`;
              const ruta = join(DIR, nav.id, archivo);
              const tapar = [page.locator(campos ? 'input[type="password"]' : 'input[type="email"], input[type="password"], input[autocomplete="username"]'), page.getByText(CORREO)];
              await page.screenshot({ path: ruta, fullPage: true, mask: tapar });
              await testInfo.attach(`${nav.id}-${archivo.replace(/\.png$/, "")}`, { path: ruta, contentType: "image/png" });
              r.capturas.push(archivo);
            };
            try {
              await test.step(`${nav.nombre} · ${flujo.nombre}`, async () => {
                r.huella = await flujo.correr(page, cap);
                r.estado = "pasó";
                r.detalle = JSON.stringify(r.huella);
              });
            } catch (error) {
              r.estado = "falló";
              r.detalle = mensaje(error);
              await cap("al-fallar").catch(() => {});
            } finally {
              r.segundos = Math.round((Date.now() - inicio) / 1000);
            }
          }
          await ctx.close();
        }

        writeFileSync(join(DIR, nav.id, "resultado.json"), JSON.stringify(resultado, null, 2));
      } finally {
        await browser.close();
      }
      const resultado = JSON.parse(readFileSync(join(DIR, nav.id, "resultado.json"), "utf8")) as ResultadoNavegador;
      await testInfo.attach(`${nav.id}-resultado.json`, { path: join(DIR, nav.id, "resultado.json"), contentType: "application/json" });
      const fallidos = resultado.flujos.filter((f) => f.estado === "falló");
      expect(fallidos.map((f) => `${f.id}: ${f.detalle}`), `flujos que fallaron en ${nav.nombre}`).toEqual([]);
    });
  });
}

// ---------------------------------------------------------------- Comparación ----------------------------------------------------------------

/** Porcentaje de píxeles distintos entre dos capturas (zona común) y diferencia de alto, medido en el navegador. */
async function diferenciaVisual(browser: Browser, a: string, b: string) {
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  const uri = (r: string) => `data:image/png;base64,${readFileSync(r).toString("base64")}`;
  const res = await p.evaluate(
    async ([ua, ub]) => {
      const cargar = (src: string) => new Promise<HTMLImageElement>((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = src; });
      const [ia, ib] = await Promise.all([cargar(ua!), cargar(ub!)]);
      const w = Math.min(ia.width, ib.width);
      const h = Math.min(ia.height, ib.height);
      const lienzo = (img: HTMLImageElement) => { const c = document.createElement("canvas"); c.width = w; c.height = h; const x = c.getContext("2d")!; x.drawImage(img, 0, 0); return x.getImageData(0, 0, w, h).data; };
      const da = lienzo(ia);
      const db = lienzo(ib);
      let distintos = 0;
      for (let i = 0; i < da.length; i += 4) {
        if (Math.abs(da[i]! - db[i]!) + Math.abs(da[i + 1]! - db[i + 1]!) + Math.abs(da[i + 2]! - db[i + 2]!) > 60) distintos++;
      }
      return { porcentaje: (100 * distintos) / (w * h), altoA: ia.height, altoB: ib.height };
    },
    [uri(a), uri(b)],
  );
  await ctx.close();
  return res;
}

async function comparativa(browser: Browser, ruta: string, titulo: string, columnas: { nombre: string; archivo?: string; nota: string }[]) {
  const ctx = await browser.newContext({ viewport: { width: 1800, height: 900 } });
  const p = await ctx.newPage();
  const celdas = columnas
    .map((c) => `<figure><div class="tag">${c.nombre}</div>${c.archivo && existsSync(c.archivo) ? `<img src="data:image/png;base64,${readFileSync(c.archivo).toString("base64")}">` : '<div class="falta">sin captura</div>'}<figcaption>${c.nota}</figcaption></figure>`)
    .join("");
  await p.setContent(`<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#f4f1ea;font:14px/1.4 "Segoe UI",system-ui,sans-serif;color:#1d1d1f}
    h1{font-size:19px;margin:18px 22px 10px}.g{display:grid;grid-template-columns:repeat(${columnas.length},1fr);gap:14px;padding:0 22px 22px;align-items:start}
    figure{margin:0;background:#fff;border-radius:12px;padding:10px;box-shadow:0 1px 4px #0002}img{width:100%;display:block;border-radius:6px}
    .tag{font-weight:700;margin-bottom:6px}figcaption{margin-top:6px;font-size:13px;color:#444}.falta{padding:40px;text-align:center;color:#999}</style>
    <h1>${titulo}</h1><div class="g">${celdas}</div>`);
  await p.screenshot({ path: ruta, fullPage: true });
  await ctx.close();
}

test("T100: comparar los navegadores", async ({ browser }, testInfo) => {
  test.setTimeout(10 * 60_000);
  const resultados = TODOS.map((n) => (existsSync(join(DIR, n.id, "resultado.json")) ? (JSON.parse(readFileSync(join(DIR, n.id, "resultado.json"), "utf8")) as ResultadoNavegador) : undefined));
  const base = resultados[0];
  const filas: string[] = [];
  const diferencias: string[] = [];
  const visuales: Record<string, Record<string, unknown>> = {};

  for (const flujo of FLUJOS) {
    const porNav = TODOS.map((n, i) => ({ n, r: resultados[i]?.flujos.find((f) => f.id === flujo.id) }));
    const huellaBase = JSON.stringify(porNav[0]?.r?.huella ?? null);
    for (const { n, r } of porNav) {
      if (!r) {
        filas.push(`| ${flujo.nombre} | ${n.nombre} | no se ejecutó | — | — | — |`);
        if (n.requerido) diferencias.push(`${flujo.id} · ${n.nombre}: no se ejecutó`);
        continue;
      }
      const igual = n.id === "chrome" ? "base" : JSON.stringify(r.huella) === huellaBase ? "igual" : "DIFERENTE";
      if (igual === "DIFERENTE" && r.estado === "pasó") diferencias.push(`${flujo.id} · ${n.nombre}: huella distinta a la de Chrome → ${JSON.stringify(r.huella)} (Chrome: ${huellaBase})`);
      if (r.estado !== "pasó") diferencias.push(`${flujo.id} · ${n.nombre}: ${r.estado} — ${r.detalle}`);
      filas.push(`| ${flujo.nombre} | ${n.nombre} | ${r.estado} | ${igual} | ${r.erroresConsola.length} | ${r.segundos} s |`);
    }

    // Capturas: cada una contra la de Chrome, y una comparativa lado a lado.
    for (const archivo of porNav[0]?.r?.capturas ?? []) {
      const columnas: { nombre: string; archivo?: string; nota: string }[] = [];
      for (const { n, r } of porNav) {
        const ruta = r?.capturas.includes(archivo) ? join(DIR, n.id, archivo) : undefined;
        let nota = r ? "" : "no se ejecutó";
        if (ruta && n.id !== "chrome") {
          const d = await diferenciaVisual(browser, join(DIR, "chrome", archivo), ruta);
          (visuales[archivo] ??= {})[n.id] = { porcentaje: Number(d.porcentaje.toFixed(2)), alto: d.altoB, altoChrome: d.altoA };
          nota = `${d.porcentaje.toFixed(2)} % de píxeles distintos a Chrome; alto ${d.altoB} px (Chrome ${d.altoA} px)`;
        } else if (ruta) {
          nota = "base de comparación";
        }
        columnas.push({ nombre: n.nombre, archivo: ruta, nota });
      }
      const destino = join(DIR, `comparativa-${archivo}`);
      await comparativa(browser, destino, `T100 · ${ENTORNO} · ${flujo.nombre} · ${archivo.replace(/\.png$/, "")}`, columnas);
      await testInfo.attach(`comparativa-${archivo.replace(/\.png$/, "")}`, { path: destino, contentType: "image/png" });
    }
  }

  const requeridos = TODOS.filter((n) => n.requerido);
  const faltan = requeridos.filter((n) => !resultados[TODOS.indexOf(n)]);
  const veredicto = faltan.length
    ? `BLOQUEADA/NO EJECUTADA para: ${faltan.map((n) => n.nombre).join(", ")}.`
    : diferencias.filter((d) => requeridos.some((n) => d.includes(`· ${n.nombre}:`))).length
      ? `CON DIFERENCIAS: ${diferencias.length} (ver la lista). Revisar si son defectos.`
      : "IGUAL EN LOS TRES: los flujos dan el mismo resultado en Chrome, Edge y Firefox (las diferencias visuales están en las comparativas).";
  const md = [
    `# Acta T100 (HT-31) — Compatibilidad web — ${ENTORNO} — ${new Date().toISOString()}`,
    "",
    "| Navegador | Versión | Identificador (userAgent) | Inicio |",
    "|---|---|---|---|",
    ...TODOS.map((n, i) => `| ${n.nombre} | ${resultados[i]?.version ?? "—"} | ${resultados[i]?.userAgent ?? "—"} | ${resultados[i]?.inicio ?? "—"} |`),
    "",
    "| Flujo | Navegador | Resultado | Huella vs Chrome | Errores de consola | Tiempo |",
    "|---|---|---|---|---|---|",
    ...filas,
    "",
    "## Diferencias",
    ...(diferencias.length ? diferencias.map((d) => `- ${d}`) : ["- Ninguna en las huellas."]),
    "",
    "## Diferencia visual contra Chrome (% de píxeles distintos)",
    "",
    "| Captura | Edge | Firefox | Brave |",
    "|---|---|---|---|",
    ...Object.entries(visuales).map(([a, v]) => `| ${a} | ${["edge", "firefox", "brave"].map((id) => (v[id] ? `${(v[id] as { porcentaje: number }).porcentaje} %` : "—")).join(" | ")} |`),
    "",
    "## Errores de consola por navegador",
    ...TODOS.flatMap((n, i) => [`- **${n.nombre}:** ${[...new Set(resultados[i]?.flujos.flatMap((f) => f.erroresConsola) ?? [])].join(" · ") || "ninguno"}`]),
    "",
    `**Veredicto (${ENTORNO}):** ${veredicto}`,
  ].join("\n");
  writeFileSync(join(DIR, `acta-T100-${ENTORNO}.md`), md);
  writeFileSync(join(DIR, `comparacion-T100-${ENTORNO}.json`), JSON.stringify({ resultados, diferencias, visuales, veredicto }, null, 2));
  await testInfo.attach(`acta-T100-${ENTORNO}.md`, { path: join(DIR, `acta-T100-${ENTORNO}.md`), contentType: "text/markdown" });
  console.log(`\n${md}\n`);
  expect(base, "primero debe correr Chrome (base de la comparación)").toBeTruthy();
});
