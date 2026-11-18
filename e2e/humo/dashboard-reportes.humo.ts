import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { inflateRawSync } from "node:zlib";

import { expect, test, type APIRequestContext, type Page, type TestInfo } from "@playwright/test";

/*
 * T126 (HT-44): «El dashboard y los reportes cuadran con los datos de prueba». Prueba de integración de sistemas del
 * módulo «Dashboard y reportes», con enfoque de caja negra, para RF-19 (Dashboard administrativo), RF-20 (Reporte de
 * citas), RF-21 (Reporte de ingresos) y RF-23 (Plataforma web administrativa).
 *
 * Precondición: un periodo con totales conocidos. Datos de prueba: 20 citas y $3,000 MXN en el periodo.
 *   El periodo es «Hoy». La fase «preparar» comprueba que hoy no hay citas ni pagos, y crea con la cuenta de recepción
 *   (como lo haría el personal) 20 citas de hoy de un servicio de $150 para un cliente sintético propio («Cliente QA
 *   T126»): cada una se confirma, se cobra en efectivo y se completa. Todo lleva la nota «QA T126».
 *
 *   1. Abrir el dashboard: muestra los totales del periodo («Citas de hoy» 20 e «Ingresos de hoy» $3,000).
 *   2. Generar los reportes de citas e ingresos del periodo: los totales coinciden y ningún pago aparece dos veces
 *      (pantalla de reportes en «Hoy», archivos Excel que genera la web, reportes de la API del día y lista de pagos).
 *
 * Solo en local (HUMO_ENTORNO=local): en staging no hay cuenta de administrador. La web local se abre por el proxy de
 * mismo origen (HUMO_BASE_URL=http://localhost:3004). HUMO_FASE=preparar | probar (o «preparar,probar»).
 * Los identificadores de lo creado quedan en ~/.urbanblade-humo-t126.json para poder borrarlo después.
 */

const LOCAL = process.env.HUMO_ENTORNO === "local";
const API_URL = process.env.HUMO_API_URL ?? "http://127.0.0.1:8000";
const FASES = (process.env.HUMO_FASE ?? "preparar,probar").split(",").map((f) => f.trim());
const ARCHIVO_ESTADO = join(homedir(), ".urbanblade-humo-t126.json");
const CITAS = 20;
const SERVICIO = "Diseño de Barba";
const PRECIO = 150;
const TOTAL = CITAS * PRECIO;
const NOTA = "QA T126";
const NOMBRE_CLIENTE = "Cliente QA T126";
const CORREO = /[\w.+-]+@[\w-]+\.[\w.-]+/;
const env = process.env;
const ADMIN = { email: env.HUMO_ADMIN_EMAIL ?? "", password: env.HUMO_ADMIN_PASSWORD ?? "" };
const RECEPCION = { email: env.HUMO_RECEPCION_EMAIL ?? env.HUMO_STAFF_EMAIL ?? "", password: env.HUMO_RECEPCION_PASSWORD ?? env.HUMO_STAFF_PASSWORD ?? "" };

interface Estado {
  fecha: string;
  clientes: { nombre: string; email: string; password: string; userId: string; clientId: string }[];
  // «code»: la API identifica cada cita en sus direcciones por su código público, no por su id.
  citas: { id: string; code?: string; cliente: string; barbero: string; hora: string; precio: number }[];
  pagos: { id: string; cita: string; monto: number }[];
  completadas: string[];
}

const hoy = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

function leerEstado(): Estado {
  if (!existsSync(ARCHIVO_ESTADO)) return { fecha: hoy(), clientes: [], citas: [], pagos: [], completadas: [] };
  const previo = JSON.parse(readFileSync(ARCHIVO_ESTADO, "utf8")) as Partial<Estado>;

  return { fecha: previo.fecha ?? hoy(), clientes: previo.clientes ?? [], citas: previo.citas ?? [], pagos: previo.pagos ?? [], completadas: previo.completadas ?? [] };
}
const estado = leerEstado();
const guardar = () => writeFileSync(ARCHIVO_ESTADO, JSON.stringify(estado, null, 2), { mode: 0o600 });

type Resultado = "pasó" | "falló" | "no se ejecutó" | "observación";
interface Paso { n: string; donde: string; titulo: string; esperado: string; resultado: Resultado; detalle: string }
const PASOS: Paso[] = [];
const nuevoPaso = (n: string, donde: string, titulo: string, esperado: string) => PASOS.push({ n, donde, titulo, esperado, resultado: "no se ejecutó", detalle: "" });
nuevoPaso("P0", "API", "Precondición: el periodo «Hoy» empieza sin citas ni pagos", "0 citas y $0 en dashboard y reportes");
nuevoPaso("P1", "API", `Precondición: ${CITAS} citas de hoy de «${SERVICIO}» ($${PRECIO}), confirmadas, cobradas y completadas`, `${CITAS} citas y $${TOTAL.toLocaleString("es-MX")} MXN en el periodo`);
nuevoPaso("1", "Web", "Abrir el dashboard del administrador", `«Citas de hoy» ${CITAS} e «Ingresos de hoy» $${TOTAL.toLocaleString("es-MX")}`);
nuevoPaso("2-pantalla", "Web", "Reportes en «Hoy»: indicadores de citas e ingresos", `Citas ${CITAS} e Ingresos $${TOTAL.toLocaleString("es-MX")}`);
nuevoPaso("2-excel", "Web", "Generar los reportes de citas e ingresos (Excel) y revisar el periodo", `Los archivos cuadran con el periodo: ${CITAS} citas y $${TOTAL.toLocaleString("es-MX")}, cada pago una vez`);
nuevoPaso("2-api", "API", "Reportes de citas e ingresos del día (API) y lista de pagos", `${CITAS} filas en cada reporte, $${TOTAL.toLocaleString("es-MX")}, cada pago una sola vez`);
nuevoPaso("2-doble", "API", "Complementaria: intentar cobrar otra vez una cita ya cobrada", "Se rechaza (un pago por cita)");
nuevoPaso("2-mes", "API", "Complementaria: dashboard contra reportes en el mes y la semana", "(Informativo) Se anota si los totales coinciden");

async function paso(n: string, fn: () => Promise<string>) {
  const p = PASOS.find((x) => x.n === n)!;
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
      }
    });
  } catch {
    // Ya quedó anotado: se sigue con el siguiente paso.
  }
}

const pausa = (ms: number) => new Promise((r) => setTimeout(r, ms));
const JSON_HEADERS = { Accept: "application/json" };
const dinero = (n: number) => `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
const numero = (t: string) => Number(t.replace(/[^\d.-]/g, ""));

// ---------------------------------------------------------------- API ----------------------------------------------------------------

async function entrarApi(request: APIRequestContext, cuenta: { email: string; password: string }) {
  const r = await request.post(`${API_URL}/api/v1/auth/login`, { headers: JSON_HEADERS, data: { ...cuenta, device_name: "QA T126" } });
  expect(r.status(), "la cuenta debe iniciar sesión en la API").toBe(200);
  return ((await r.json()) as { token: string }).token;
}

/** Llama a la API; si responde 429 (demasiadas peticiones), espera y reintenta. */
async function api(request: APIRequestContext, token: string, metodo: "get" | "post" | "patch" | "put", ruta: string, data?: unknown) {
  for (let intento = 0; ; intento++) {
    const r = await request[metodo](`${API_URL}/api/v1${ruta}`, { headers: { ...JSON_HEADERS, Authorization: `Bearer ${token}` }, data: data as Record<string, unknown> | undefined, timeout: 120_000 });
    if (r.status() !== 429 || intento >= 5) return { estado: r.status(), cuerpo: (await r.json().catch(() => ({}))) as Record<string, unknown> };
    await pausa(Number(r.headers()["retry-after"] ?? 30) * 1000 + 1000);
  }
}

interface FilaReporte { [k: string]: string | number | null }
async function reporteApi(request: APIRequestContext, token: string, tipo: "citas" | "ingresos", fecha: string) {
  const r = await api(request, token, "get", `/reports/${tipo}/json?start_date=${fecha}&end_date=${fecha}`);
  expect(r.estado, `GET /reports/${tipo}/json debe responder 200`).toBe(200);
  return (r.cuerpo.rows ?? []) as FilaReporte[];
}

async function kpisDashboard(request: APIRequestContext, token: string) {
  const r = await api(request, token, "get", "/dashboard");
  const datos = (r.cuerpo.data ?? r.cuerpo) as { kpis?: Record<string, number> };
  return datos.kpis ?? {};
}

// ---------------------------------------------------------------- Excel (.xlsx) ----------------------------------------------------------------

/** Lee un .xlsx (un ZIP) sin librerías: devuelve cada archivo interno ya descomprimido. */
function leerZip(buf: Buffer) {
  const archivos = new Map<string, Buffer>();
  const fin = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (fin < 0) throw new Error("El archivo descargado no es un .xlsx válido");
  const total = buf.readUInt16LE(fin + 10);
  let p = buf.readUInt32LE(fin + 16);
  for (let i = 0; i < total; i++) {
    const metodo = buf.readUInt16LE(p + 10);
    const comprimido = buf.readUInt32LE(p + 20);
    const largoNombre = buf.readUInt16LE(p + 28);
    const largoExtra = buf.readUInt16LE(p + 30);
    const largoComentario = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const nombre = buf.toString("utf8", p + 46, p + 46 + largoNombre);
    const inicio = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const datos = buf.subarray(inicio, inicio + comprimido);
    archivos.set(nombre, metodo === 8 ? inflateRawSync(datos) : Buffer.from(datos));
    p += 46 + largoNombre + largoExtra + largoComentario;
  }
  return archivos;
}

const desescapar = (t: string) => t.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");

/** Las hojas del libro como tablas de texto (fila → celdas por columna). */
function leerLibro(buf: Buffer) {
  const zip = leerZip(buf);
  const compartidas = [...(zip.get("xl/sharedStrings.xml")?.toString("utf8") ?? "").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
    desescapar([...m[1]!.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join("")),
  );
  const hojas: { archivo: string; filas: string[][] }[] = [];
  for (const [nombre, contenido] of zip) {
    if (!/^xl\/worksheets\/sheet\d+\.xml$/.test(nombre)) continue;
    const filas = [...contenido.toString("utf8").matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)].map((fila) => {
      const celdas: string[] = [];
      for (const c of fila[1]!.matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const col = [...c[1]!].reduce((a, l) => a * 26 + l.charCodeAt(0) - 64, 0) - 1;
        const tipo = /t="(\w+)"/.exec(c[2] ?? "")?.[1];
        const v = /<v>([\s\S]*?)<\/v>/.exec(c[3] ?? "")?.[1] ?? /<t[^>]*>([\s\S]*?)<\/t>/.exec(c[3] ?? "")?.[1] ?? "";
        // Una celda con fórmula se devuelve como «=FÓRMULA»: su valor guardado puede no estar calculado.
        const formula = /<f>([\s\S]*?)<\/f>/.exec(c[3] ?? "")?.[1];
        celdas[col] = formula ? `=${desescapar(formula)}` : tipo === "s" ? (compartidas[Number(v)] ?? "") : desescapar(v);
      }
      return Array.from(celdas, (x) => x ?? "");
    });
    hojas.push({ archivo: nombre, filas });
  }
  return hojas.sort((a, b) => a.archivo.localeCompare(b.archivo, undefined, { numeric: true }));
}

/** La tabla de detalle (la hoja cuya primera fila empieza con «Fecha») como objetos por encabezado, y su fila TOTAL. */
function detalle(hojas: ReturnType<typeof leerLibro>) {
  const hoja = hojas.find((h) => h.filas[0]?.[0] === "Fecha");
  if (!hoja) throw new Error("El Excel no trae la hoja de detalle");
  const [encabezados, ...filas] = hoja.filas;
  const objetos = filas.filter((f) => f.some(Boolean)).map((f) => Object.fromEntries(encabezados!.map((e, i) => [e, f[i] ?? ""])));

  return { filas: objetos.filter((f) => f.Fecha !== "TOTAL"), total: objetos.find((f) => f.Fecha === "TOTAL") };
}

// ---------------------------------------------------------------- Web ----------------------------------------------------------------

async function escribirSinRegistro(page: Page, selector: string, valor: string) {
  await page.locator(selector).evaluate((el, v) => {
    const campo = el as HTMLInputElement;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(campo, v);
    campo.dispatchEvent(new Event("input", { bubbles: true }));
  }, valor);
}

async function entrarWeb(page: Page, cuenta: { email: string; password: string }) {
  await page.goto("/login");
  await page.waitForLoadState("networkidle").catch(() => {});
  await escribirSinRegistro(page, "#email", cuenta.email);
  await escribirSinRegistro(page, "#password", cuenta.password);
  const respuesta = page.waitForResponse((r) => r.url().includes("/auth/login") && r.request().method() === "POST", { timeout: 60_000 });
  await page.getByRole("button", { name: "Ingresar" }).click();
  expect((await respuesta).status(), "POST /auth/login debe responder 200").toBe(200);
  await page.waitForURL(/\/dashboard/, { timeout: 60_000 });
}

async function captura(page: Page, testInfo: TestInfo, archivo: string, locator?: ReturnType<Page["locator"]>) {
  const ruta = testInfo.outputPath(archivo);
  const tapar = [page.locator('input[type="email"], input[type="password"]'), page.getByText(CORREO)];
  if (locator) await locator.screenshot({ path: ruta, mask: tapar });
  else await page.screenshot({ path: ruta, fullPage: true, mask: tapar });
  await testInfo.attach(archivo.replace(/\.png$/, ""), { path: ruta, contentType: "image/png" });
}

/** El valor que muestra una tarjeta de indicador (su etiqueta y el número grande que la acompaña). */
async function tarjeta(page: Page, etiqueta: string) {
  const t = page.locator("section, div").filter({ has: page.getByText(etiqueta, { exact: true }) }).filter({ hasText: /\d/ }).last();
  return (await t.innerText()).replace(/\s+/g, " ").trim();
}

// ---------------------------------------------------------------- Prueba ----------------------------------------------------------------

test("T126: el dashboard y los reportes cuadran con los datos de prueba (RF-19, RF-20, RF-21 y RF-23)", async ({ page, request, baseURL }, testInfo) => {
  test.setTimeout(45 * 60_000);
  test.skip(!LOCAL, "BLOQUEADA en staging: no hay cuenta de administrador. Se corre en local (HUMO_ENTORNO=local).");
  expect(ADMIN.email && RECEPCION.email, "faltan las cuentas de administrador y recepción locales").toBeTruthy();
  const datos: Record<string, unknown> = { entorno: "local", web: baseURL, api: API_URL, periodo: "Hoy", servicio: `${SERVICIO} ($${PRECIO})` };
  const admin = await entrarApi(request, ADMIN);
  const recepcion = await entrarApi(request, RECEPCION);
  const fecha = hoy();

  try {
    // ======================= Preparar =======================
    if (FASES.includes("preparar")) {
      // Si una corrida anterior de hoy quedó a medias, se continúa con lo ya creado; si es de otro día, hay que borrarlo.
      expect(estado.citas.length === 0 || estado.fecha === fecha, "hay datos de prueba de otro día en ~/.urbanblade-humo-t126.json: primero hay que borrarlos").toBe(true);
      estado.fecha = fecha;

      await paso("P0", async () => {
        const k = await kpisDashboard(request, admin);
        const citasApi = await reporteApi(request, admin, "citas", fecha);
        const ingresosApi = await reporteApi(request, admin, "ingresos", fecha);
        const rep = (await api(request, admin, "get", "/admin/reports/appointments?period=dia")).cuerpo.data as { totalAppointments: number };
        const rev = (await api(request, admin, "get", "/admin/reports/revenue?period=dia")).cuerpo.data as { totalRevenue: number };
        datos.antes = { dashboardCitasHoy: k.appointments_today, dashboardIngresosHoy: k.income_today, reporteCitas: rep.totalAppointments, reporteIngresos: rev.totalRevenue, filasCitas: citasApi.length, filasIngresos: ingresosApi.length };
        // Hoy solo puede haber lo que esta prueba ya creó (nada, en una corrida desde cero).
        const propias = estado.citas.length;
        const pagado = estado.pagos.reduce((a, x) => a + x.monto, 0);
        const completado = estado.citas.filter((c) => estado.completadas.includes(c.id)).reduce((a, c) => a + c.precio, 0);
        expect([k.appointments_today, k.income_today, rep.totalAppointments, rev.totalRevenue, citasApi.length, ingresosApi.length], "el periodo «Hoy» no debe tener datos ajenos a la prueba").toEqual([propias, pagado, propias, completado, propias, estado.pagos.length]);

        return propias
          ? `Hoy (${fecha}) solo tiene lo que esta prueba ya había creado (${propias} cita(s), ${dinero(pagado)}); se continúa`
          : `Hoy (${fecha}) empieza en 0 citas y $0 en el dashboard, en los reportes y en la API`;
      });

      await paso("P1", async () => {
        // El sistema permite una sola cita por cliente por día: cada cita es de un cliente sintético distinto
        // («Cliente QA T126 01…20»). Así tampoco se les suman visitas ni puntos a las cuentas de otras pruebas.
        while (estado.clientes.length < CITAS) {
          const numero = String(estado.clientes.length + 1).padStart(2, "0");
          const nombre = `${NOMBRE_CLIENTE} ${numero}`;
          const email = `qa.t126.${numero}.${Date.now().toString(36)}@urbanblade.test`;
          const password = `Qa${randomBytes(5).toString("hex")}T126`;
          let reg = await request.post(`${API_URL}/api/v1/auth/register`, { headers: JSON_HEADERS, data: { name: nombre, email, password, password_confirmation: password, device_name: "QA T126" } });
          // El registro acepta 6 por minuto: si responde 429, se espera y se reintenta.
          for (let i = 0; reg.status() === 429 && i < 5; i++) {
            await pausa(Number(reg.headers()["retry-after"] ?? 30) * 1000 + 1000);
            reg = await request.post(`${API_URL}/api/v1/auth/register`, { headers: JSON_HEADERS, data: { name: nombre, email, password, password_confirmation: password, device_name: "QA T126" } });
          }
          expect(reg.status(), `el registro de «${nombre}» debe responder 201`).toBe(201);
          const cuerpo = (await reg.json()) as { token: string; user: { id: string } };
          // Se guarda de inmediato, para poder borrarlo aunque algo falle después.
          const cliente = { nombre, email, password, userId: cuerpo.user.id, clientId: "" };
          estado.clientes.push(cliente);
          guardar();
          // El perfil de cliente se crea al completar sus datos (como en «Completa tu perfil»), con datos sintéticos.
          const completar = await api(request, cuerpo.token, "put", "/profile", { telefono: `55123451${numero}`, fecha_nacimiento: "1995-04-12", sexo: "prefiero_no_decir" });
          expect(completar.estado, `completar el perfil de «${nombre}» debe responder 200`).toBe(200);
          const perfil = (await api(request, cuerpo.token, "get", "/profile")).cuerpo as { user: { client_id?: string } };
          expect(perfil.user.client_id, `«${nombre}» debe tener su perfil de cliente`).toBeTruthy();
          cliente.clientId = perfil.user.client_id!;
          guardar();
          await request.post(`${API_URL}/api/v1/auth/logout`, { headers: { ...JSON_HEADERS, Authorization: `Bearer ${cuerpo.token}` } }).catch(() => {});
        }
        const servicios = (await request.get(`${API_URL}/api/v1/services`, { headers: JSON_HEADERS }).then((r) => r.json())) as { data?: { id: string; nombre: string; precio: number }[] } | { id: string; nombre: string; precio: number }[];
        const servicio = (Array.isArray(servicios) ? servicios : (servicios.data ?? [])).find((s) => s.nombre === SERVICIO);
        expect(servicio?.precio, `«${SERVICIO}» debe costar $${PRECIO}`).toBe(PRECIO);
        const barberos = (await request.get(`${API_URL}/api/v1/barbers`, { headers: JSON_HEADERS }).then((r) => r.json())) as { data?: { id: string; user?: { name?: string } }[] };
        // Citas de hoy en horarios libres, repartidas entre los barberos que tengan lugar.
        for (const b of barberos.data ?? []) {
          if (estado.citas.length >= CITAS) break;
          const s = await api(request, recepcion, "get", `/availability/slots?barber_id=${b.id}&service_id=${servicio!.id}&date=${fecha}`);
          const libres = ((s.cuerpo.slots ?? []) as (string | { time?: string; hora?: string; label?: string })[]).map((x) => (typeof x === "string" ? x : (x.time ?? x.hora ?? x.label ?? ""))).filter(Boolean);
          for (const hora of libres.slice(0, 5)) {
            if (estado.citas.length >= CITAS) break;
            const cliente = estado.clientes.find((c) => !estado.citas.some((x) => x.cliente === c.clientId))!;
            const r = await api(request, recepcion, "post", "/appointments", {
              client_id: cliente.clientId,
              barber_id: b.id,
              service_id: servicio!.id,
              fecha,
              hora_inicio: hora.slice(0, 5),
              estado: "confirmada",
              acepta_cargo_inasistencia: true,
              notas: `${NOTA} · cita ${estado.citas.length + 1} de ${CITAS}`,
            });
            if (r.estado !== 201 && r.estado !== 200) continue; // el horario ya no estaba libre: se prueba el siguiente
            const cita = ((r.cuerpo.data ?? r.cuerpo.appointment ?? r.cuerpo) as { id: string; code?: string; precio_cobrado?: number });
            estado.citas.push({ id: cita.id, code: cita.code, cliente: cliente.clientId, barbero: b.user?.name ?? b.id, hora: hora.slice(0, 5), precio: Number(cita.precio_cobrado ?? 0) });
            guardar();
          }
        }
        expect(estado.citas.length, `debe haber ${CITAS} citas creadas`).toBe(CITAS);
        // Se cobran todas antes de completarlas: así ningún cobro se recalcula con un nivel de lealtad nuevo.
        for (const c of estado.citas) {
          if (estado.pagos.some((p) => p.cita === c.id)) continue;
          const r = await api(request, recepcion, "post", "/payments", { appointment_id: c.id, monto: PRECIO, metodo_pago: "efectivo", propina: 0 });
          expect([200, 201], `el cobro de la cita ${c.hora} debe registrarse: ${JSON.stringify(r.cuerpo).slice(0, 200)}`).toContain(r.estado);
          const pago = ((r.cuerpo.data ?? r.cuerpo) as { id: string; monto: number | string });
          estado.pagos.push({ id: pago.id, cita: c.id, monto: Number(pago.monto) });
          guardar();
        }
        // Las citas de una corrida anterior pueden no tener su código: se toma de la lista de citas del día.
        if (estado.citas.some((c) => !c.code)) {
          const lista = await api(request, recepcion, "get", `/appointments?desde=${fecha}&hasta=${fecha}&per_page=100`);
          for (const a of (lista.cuerpo.data ?? []) as { id: string; code?: string }[]) {
            const c = estado.citas.find((x) => x.id === String(a.id));
            if (c && !c.code) c.code = a.code;
          }
          guardar();
        }
        for (const c of estado.citas) {
          if (estado.completadas.includes(c.id)) continue;
          expect(c.code, `la cita ${c.hora} debe tener su código público`).toBeTruthy();
          const r = await api(request, recepcion, "patch", `/appointments/${c.code}/status`, { estado: "completada" });
          expect(r.estado, `la cita ${c.hora} debe completarse: ${JSON.stringify(r.cuerpo).slice(0, 200)}`).toBe(200);
          estado.completadas.push(c.id);
          c.precio = Number(((r.cuerpo.data ?? {}) as { precio_cobrado?: number }).precio_cobrado ?? 0);
          if (!c.precio) {
            const detalle = await api(request, recepcion, "get", `/appointments/${c.code}`);
            c.precio = Number(((detalle.cuerpo.data ?? detalle.cuerpo) as { precio_cobrado?: number }).precio_cobrado ?? 0);
          }
          guardar();
        }
        const suma = estado.pagos.reduce((a, p) => a + p.monto, 0);
        const sumaPrecios = estado.citas.reduce((a, c) => a + c.precio, 0);
        datos.preparacion = { citas: estado.citas.length, pagos: estado.pagos.length, sumaPagos: suma, sumaPrecios, barberos: [...new Set(estado.citas.map((c) => c.barbero))].length };
        expect(suma, `los ${CITAS} cobros deben sumar $${TOTAL}`).toBe(TOTAL);
        expect(sumaPrecios, `el precio de las ${CITAS} citas debe sumar $${TOTAL}`).toBe(TOTAL);

        return `${CITAS} citas de hoy de «${SERVICIO}» con ${String((datos.preparacion as { barberos: number }).barberos)} barberos, confirmadas, cobradas en efectivo ($${PRECIO} c/u = ${dinero(suma)}) y completadas`;
      });
    }

    // ======================= Probar =======================
    if (FASES.includes("probar")) {
      expect(estado.citas.length, "primero hay que correr la fase «preparar»").toBe(CITAS);
      expect(estado.fecha, "los datos de prueba deben ser de hoy").toBe(fecha);

      await paso("1", async () => {
        await entrarWeb(page, ADMIN);
        const resumen = page.locator('section[aria-label="Resumen"]');
        await expect(resumen, "el dashboard debe mostrar el resumen").toBeVisible({ timeout: 60_000 });
        await page.waitForLoadState("networkidle").catch(() => {});
        // Las tarjetas cuentan hacia arriba con una animación (7, 8, … 20): se lee cuando dejan de cambiar.
        const leerUnaVez = async () => ({ citas: await tarjeta(page, "Citas de hoy"), ingresos: await tarjeta(page, "Ingresos de hoy") });
        const leer = async () => {
          let antes = await leerUnaVez();
          for (let i = 0; i < 20; i++) {
            await pausa(700);
            const ahora = await leerUnaVez();
            if (JSON.stringify(ahora) === JSON.stringify(antes)) return ahora;
            antes = ahora;
          }
          return antes;
        };
        const primera = await leer();
        await captura(page, testInfo, "1-a-dashboard-primera-vista.png");
        // El dashboard guarda sus cifras unos minutos: si aún no se ven, se recarga cada 15 s (hasta 4 min).
        const inicio = Date.now();
        let ahora = primera;
        while (!(ahora.citas.includes(`Citas de hoy ${CITAS} `) && ahora.ingresos.includes(dinero(TOTAL))) && Date.now() - inicio < 240_000) {
          await pausa(15_000);
          await page.reload();
          await expect(resumen).toBeVisible({ timeout: 60_000 });
          await page.waitForLoadState("networkidle").catch(() => {});
          ahora = await leer();
        }
        const espera = Math.round((Date.now() - inicio) / 1000);
        await captura(page, testInfo, "1-b-dashboard-totales-del-periodo.png");
        await captura(page, testInfo, "1-c-dashboard-resumen.png", resumen);
        datos.accion1 = { primeraVista: primera, final: ahora, segundosHastaVerlos: espera };
        expect(ahora.citas, `«Citas de hoy» debe decir ${CITAS}`).toContain(`Citas de hoy ${CITAS} `);
        expect(ahora.ingresos, `«Ingresos de hoy» debe decir ${dinero(TOTAL)}`).toContain(dinero(TOTAL));

        return `«Citas de hoy» ${CITAS} e «Ingresos de hoy» ${dinero(TOTAL)}${espera ? ` (al abrirlo mostraba «${primera.citas.slice(0, 40)}» y «${primera.ingresos.slice(0, 40)}»; los totales aparecieron a los ${espera} s)` : " desde la primera vista"}`;
      });

      await paso("2-pantalla", async () => {
        await page.goto("/reports");
        const periodos = page.getByRole("tablist", { name: "Periodo del reporte" });
        await periodos.getByRole("tab", { name: "Hoy" }).click();
        const calculando = page.getByText("Calculando métricas…");
        await calculando.waitFor({ state: "visible", timeout: 5_000 }).catch(() => {});
        await expect(calculando).toHaveCount(0, { timeout: 60_000 });
        await page.waitForLoadState("networkidle").catch(() => {});
        const kpis = page.locator('[aria-label="Indicadores del periodo"]');
        const textos = (await kpis.locator(":scope > *").allInnerTexts()).map((t) => t.replace(/\s+/g, " ").trim());
        await captura(page, testInfo, "2-a-reportes-hoy.png");
        const valor = (etiqueta: string) => textos.find((t) => t.startsWith(etiqueta)) ?? "";
        datos.accion2Pantalla = { ingresos: valor("Ingresos"), citas: valor("Citas "), ticket: valor("Ticket promedio"), finalizacion: valor("Finalización") };
        expect(valor("Citas "), `la tarjeta «Citas» debe decir ${CITAS}`).toMatch(new RegExp(`^Citas ${CITAS} `));
        expect(valor("Ingresos"), `la tarjeta «Ingresos» debe decir ${dinero(TOTAL)}`).toContain(dinero(TOTAL));

        return `En «Hoy»: ${valor("Citas ")} · ${valor("Ingresos")} · ${valor("Ticket promedio")} · ${valor("Finalización")}`;
      });

      await paso("2-excel", async () => {
        // Se exportan desde la misma pantalla, con «Hoy» elegido.
        await page.getByText("Exportar reporte detallado").scrollIntoViewIfNeeded();
        const resumen: Record<string, unknown> = {};
        const problemas: string[] = [];
        for (const [tipo, titulo] of [["citas", "Citas"], ["ingresos", "Ingresos"]] as const) {
          const caja = page.locator("div.rounded-xl").filter({ has: page.getByText(titulo, { exact: true }) }).filter({ has: page.getByRole("button", { name: "Excel" }) }).first();
          const espera = page.waitForEvent("download", { timeout: 120_000 });
          await caja.getByRole("button", { name: "Excel" }).click();
          const descarga = await espera;
          const ruta = testInfo.outputPath(`2-excel-${tipo}.xlsx`);
          await descarga.saveAs(ruta);
          await testInfo.attach(`2-excel-${tipo}.xlsx`, { path: ruta, contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
          const hojas = leerLibro(readFileSync(ruta));
          const { filas, total: filaTotal } = detalle(hojas);
          const portada = hojas[0]?.filas.flat().filter(Boolean).join(" · ").slice(0, 300) ?? "";
          const delPeriodo = filas.filter((f) => String(f.Fecha).startsWith(fecha));
          const montoCol = tipo === "citas" ? "Precio cobrado" : "Total";
          const suma = (fs: typeof filas) => fs.reduce((a, f) => a + numero(String(f[montoCol] ?? f[Object.keys(f).at(-1)!] ?? 0)), 0);
          const claves = delPeriodo.map((f) => JSON.stringify(f));
          const repetidas = claves.length - new Set(claves).size;
          const celdaTotal = String(filaTotal?.[montoCol] ?? "");
          // La fila TOTAL es una fórmula (SUBTOTAL) que Excel calcula al abrir; solo se compara si trae un número.
          const totalDelArchivo = !filaTotal || celdaTotal.startsWith("=") ? NaN : numero(celdaTotal);
          const periodoPortada = /(\d{2}\/\d{2}\/\d{4}) al (\d{2}\/\d{2}\/\d{4})/.exec(portada)?.[0] ?? "(sin periodo en la portada)";
          const fechas = [...new Set(filas.map((f) => String(f.Fecha).slice(0, 10)))].sort();
          resumen[tipo] = { archivo: descarga.suggestedFilename(), periodoPortada, filas: filas.length, fechas, sumaTodo: suma(filas), filaTotal: celdaTotal.startsWith("=") ? celdaTotal : totalDelArchivo, filasDelPeriodo: delPeriodo.length, sumaDelPeriodo: suma(delPeriodo), filasRepetidasDelPeriodo: repetidas };
          // Dentro del día: las filas de hoy cuadran y no se repite ninguna.
          if (delPeriodo.length !== CITAS) problemas.push(`${titulo}: ${delPeriodo.length} filas de hoy (se esperaban ${CITAS})`);
          if (Math.round(suma(delPeriodo)) !== TOTAL) problemas.push(`${titulo}: hoy suma ${dinero(suma(delPeriodo))} (se esperaban ${dinero(TOTAL)})`);
          if (repetidas) problemas.push(`${titulo}: ${repetidas} filas repetidas`);
          // El archivo: su fila TOTAL cuadra con sus filas, y es del periodo elegido en pantalla («Hoy»).
          if (!Number.isNaN(totalDelArchivo) && Math.round(totalDelArchivo) !== Math.round(suma(filas))) problemas.push(`${titulo}: la fila TOTAL dice ${dinero(totalDelArchivo)} y las filas suman ${dinero(suma(filas))}`);
          if (filas.length !== delPeriodo.length) problemas.push(`${titulo}: con «Hoy» elegido, el archivo es del ${periodoPortada} (${filas.length} filas de ${fechas.length} días, ${dinero(suma(filas))}), no del periodo; no coincide con la pantalla (${titulo === "Citas" ? `${CITAS} citas` : dinero(TOTAL)})`);
        }
        await captura(page, testInfo, "2-b-reportes-exportar.png");
        datos.accion2Excel = resumen;
        datos.accion2ExcelProblemas = problemas;
        // Lo que pide el caso: los reportes generados del periodo cuadran con sus totales y ningún pago se repite.
        expect(problemas, "los reportes generados deben ser del periodo, cuadrar con la pantalla y no repetir pagos").toEqual([]);

        return `Los dos archivos son del periodo: ${CITAS} citas y ${dinero(TOTAL)}, su fila TOTAL cuadra y ningún pago se repite`;
      });

      await paso("2-api", async () => {
        const citas = await reporteApi(request, admin, "citas", fecha);
        const ingresos = await reporteApi(request, admin, "ingresos", fecha);
        const sumaCitas = citas.reduce((a, f) => a + Number(f.precio_cobrado ?? 0), 0);
        const sumaIngresos = ingresos.reduce((a, f) => a + Number(f.total ?? 0), 0);
        const completadas = citas.filter((f) => f.estado === "completada").length;
        // Ningún pago dos veces: en la lista de pagos del día, cada pago creado aparece una sola vez.
        const lista = await api(request, admin, "get", `/payments?fecha_desde=${fecha}&fecha_hasta=${fecha}&q=${encodeURIComponent(NOMBRE_CLIENTE)}&per_page=100`);
        const pagos = ((lista.cuerpo.data ?? []) as { id: string; monto?: number | string }[]);
        const ids = pagos.map((p) => String(p.id));
        const nuestros = estado.pagos.map((p) => ids.filter((i) => i === p.id).length);
        datos.accion2Api = { filasCitas: citas.length, completadas, sumaCitas, filasIngresos: ingresos.length, sumaIngresos, pagosEnLista: pagos.length, vecesQueApareceCadaPago: [...new Set(nuestros)] };
        expect(citas.length, `el reporte de citas del día debe tener ${CITAS} filas`).toBe(CITAS);
        expect(completadas, "todas completadas").toBe(CITAS);
        expect(sumaCitas, `el reporte de citas debe sumar ${dinero(TOTAL)}`).toBe(TOTAL);
        expect(ingresos.length, `el reporte de ingresos del día debe tener ${CITAS} filas (una por pago)`).toBe(CITAS);
        expect(sumaIngresos, `el reporte de ingresos debe sumar ${dinero(TOTAL)}`).toBe(TOTAL);
        expect(nuestros.every((v) => v === 1), "cada pago debe aparecer una sola vez en la lista de pagos").toBe(true);
        expect(new Set(ids).size, "la lista de pagos no debe repetir ninguno").toBe(ids.length);

        return `Reporte de citas: ${citas.length} filas (${completadas} completadas), ${dinero(sumaCitas)}. Reporte de ingresos: ${ingresos.length} filas, ${dinero(sumaIngresos)}. Lista de pagos del día: ${pagos.length}, cada pago una sola vez`;
      });

      await paso("2-doble", async () => {
        const c = estado.citas[0]!;
        const r = await api(request, recepcion, "post", "/payments", { appointment_id: c.id, monto: PRECIO, metodo_pago: "efectivo", propina: 0 });
        if (r.estado < 300) {
          const pago = ((r.cuerpo.data ?? r.cuerpo) as { id: string; monto: number | string });
          estado.pagos.push({ id: pago.id, cita: c.id, monto: Number(pago.monto) });
          guardar();
        }
        datos.cobroDoble = { estado: r.estado, mensaje: r.cuerpo.message };
        expect(r.estado, "un segundo cobro de la misma cita debe rechazarse").toBe(422);

        return `POST /payments a la cita ya cobrada: ${r.estado} «${String(r.cuerpo.message ?? "")}»`;
      });

      await paso("2-mes", async () => {
        const k = await kpisDashboard(request, admin);
        const filas: string[] = [];
        const comparacion: Record<string, unknown> = {};
        for (const [periodo, kc, ki] of [["semana", "appointments_week", "income_week"], ["mes", "appointments_month", "income_month"]] as const) {
          const rep = (await api(request, admin, "get", `/admin/reports/appointments?period=${periodo}`)).cuerpo.data as { totalAppointments: number; startDate: string; endDate: string };
          const rev = (await api(request, admin, "get", `/admin/reports/revenue?period=${periodo}`)).cuerpo.data as { totalRevenue: number };
          comparacion[periodo] = { dashboard: { citas: k[kc], ingresos: k[ki] }, reportes: { citas: rep.totalAppointments, ingresos: rev.totalRevenue, desde: rep.startDate, hasta: rep.endDate } };
          if (k[kc] !== rep.totalAppointments || k[ki] !== rev.totalRevenue) filas.push(`${periodo}: dashboard ${k[kc]} citas y ${dinero(k[ki] ?? 0)}; reportes ${rep.totalAppointments} citas y ${dinero(rev.totalRevenue)}`);
        }
        datos.comparacionMesSemana = comparacion;
        if (filas.length) PASOS.find((p) => p.n === "2-mes")!.resultado = "observación";

        return filas.length ? `No coinciden fuera de «Hoy» → ${filas.join(" · ")}` : "Coinciden en la semana y el mes";
      });
    }
  } finally {
    for (const t of [admin, recepcion]) await request.post(`${API_URL}/api/v1/auth/logout`, { headers: { ...JSON_HEADERS, Authorization: `Bearer ${t}` } }).catch(() => {});
    const fallidos = PASOS.filter((p) => p.resultado === "falló");
    const pendientes = PASOS.filter((p) => p.resultado === "no se ejecutó" && FASES.includes(p.n.startsWith("P") ? "preparar" : "probar"));
    const veredicto = fallidos.length
      ? `FALLIDA: falló ${fallidos.map((p) => p.n).join(", ")}.`
      : pendientes.length
        ? `INCOMPLETA: faltan ${pendientes.map((p) => p.n).join(", ")}.`
        : FASES.includes("probar")
          ? "APROBADA: el dashboard y los reportes del periodo muestran 20 citas y $3,000, y ningún pago aparece dos veces."
          : "PREPARADA: los datos de prueba están listos.";
    const md = [
      `# Acta T126 (HT-44) — El dashboard y los reportes cuadran con los datos de prueba — ${new Date().toISOString()}`,
      "",
      ...Object.entries(datos).filter(([, v]) => typeof v === "string").map(([k, v]) => `- ${k}: ${String(v)}`),
      "",
      "| # | Dónde | Paso | Resultado esperado | Resultado | Detalle |",
      "|---|---|---|---|---|---|",
      ...PASOS.map((p) => `| ${p.n} | ${p.donde} | ${p.titulo} | ${p.esperado} | ${p.resultado} | ${p.detalle.replace(/\|/g, "/")} |`),
      "",
      `**Veredicto (local):** ${veredicto}`,
    ].join("\n");
    const sufijo = FASES.join("-");
    writeFileSync(testInfo.outputPath(`acta-T126-${sufijo}.md`), md);
    writeFileSync(testInfo.outputPath(`datos-T126-${sufijo}.json`), JSON.stringify({ ...datos, pasos: PASOS, veredicto, creados: { citas: estado.citas.length, pagos: estado.pagos.length } }, null, 2));
    await testInfo.attach(`acta-T126-${sufijo}.md`, { path: testInfo.outputPath(`acta-T126-${sufijo}.md`), contentType: "text/markdown" });
    console.log(`\n${md}\n`);
  }

  expect(PASOS.filter((p) => p.resultado === "falló").map((p) => `${p.n}: ${p.detalle}`), "pasos que fallaron").toEqual([]);
});
