import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { expect, test, type APIRequestContext, type Browser, type Page, type TestInfo } from "@playwright/test";

import { Apk } from "./apk";

/*
 * T075 y T074 (HT-46): prueba de humo del flujo crítico, con enfoque de caja negra. T075 la corre en el build congelado
 * antes de la sesión 1 de la UAT; T074, en el build corregido antes de la sesión 3 (HUMO_TAREA=T074 HUMO_SESION=3).
 * Integración real: la web y el APK desplegados para staging hablan con la API real de staging (nada simulado).
 *
 * Comprueba RF-10 (Reserva de citas), RF-13 (Administración de citas), RF-15 (Pago de la cita) y RF-24 (Información
 * compartida entre la app y la web). Cada paso es una fila del acta. Si un paso falla, la prueba se detiene ahí y el
 * acta dice «NO APTO»: la sesión de la UAT que sigue no se hace con ese build.
 *
 * Escritura real en staging solo con HUMO_PERMITIR_RESERVA=1: se crea una cita, el personal la aprueba, el cliente la
 * paga con la tarjeta de prueba de Stripe (staging usa claves de prueba: no hay cobro real) y se cancela en la app.
 *
 * HUMO_ENTORNO=local: ENSAYO del mismo recorrido contra la web y la API locales (build propio en localhost:3000, barber en
 * Docker en el puerto 8000 y el APK de debug por el túnel de adb). Sirve para validar el flujo y el script mientras staging
 * no está disponible; no reemplaza la corrida oficial, que exige la API real de staging.
 */

const LOCAL = process.env.HUMO_ENTORNO === "local";
const API_URL = process.env.HUMO_API_URL ?? (LOCAL ? "http://127.0.0.1:8000" : "https://api.urbanblade.com.mx");
const APK_RUTA = resolve(
  process.env.HUMO_APK
    ?? (LOCAL
      ? "../documentacion/HT-46/T075/apk/UrbanBlade-debug-local-main-095f168.apk"
      : "../documentacion/HT-46/T075/apk/UrbanBlade-staging-main-095f168.apk"),
);
// El commit sale del nombre del archivo (UrbanBlade-staging-main-<commit>.apk) si no se indica con HUMO_APK_COMMIT.
const APK_COMMIT =
  process.env.HUMO_APK_COMMIT ?? `${APK_RUTA.match(/main-([0-9a-f]{7,40})\.apk$/)?.[1] ?? "desconocido"} (main de UrbanBladeMobile)`;
/** T075 decide la sesión 1 de la UAT con el build congelado; T074, la sesión 3 con el build corregido. */
const TAREA = process.env.HUMO_TAREA ?? "T075";
const SESION = process.env.HUMO_SESION ?? (TAREA === "T074" ? "3" : "1");
const MANTENIMIENTO = "Mantenimiento programado";
const TARJETA_PRUEBA = { numero: "4242424242424242", vence: "1234", cvc: "123", cp: "50000" };

type Resultado = "pasó" | "falló" | "bloqueado" | "detenido" | "no se ejecutó";

interface Paso {
  n: string;
  donde: string;
  titulo: string;
  rf: string;
  resultado: Resultado;
  detalle: string;
}

const PASOS: Paso[] = [
  ["0", "—", "Build congelado y requisitos de la corrida", "—"],
  ["1", "API", "La API responde (solo lectura)", "—"],
  ["2", "Web", "La página de inicio carga", "—"],
  ["3", "Web", "El cliente inicia sesión", "RF-10"],
  ["4", "Web", "Elige servicio, barbero, día y hora", "RF-10"],
  ["5", "Web", "Reserva con «Pagar en el salón»: la cita nace Pendiente", "RF-10"],
  ["6", "Web", "«Mis citas» muestra la cita Pendiente", "RF-10, RF-24"],
  ["7", "APK", "La app muestra la misma cita Pendiente", "RF-24"],
  ["8", "Web (personal)", "El personal aprueba la cita: Confirmada", "RF-13"],
  ["9", "APK", "La app la muestra Confirmada y ofrece «Pagar cita»", "RF-24, RF-15"],
  ["10", "Web", "El cliente paga con la tarjeta de prueba", "RF-15"],
  ["11", "APK", "La app la muestra pagada", "RF-24, RF-15"],
  ["12", "APK", "El cliente cancela la cita en la app", "RF-13, RF-24"],
  ["13", "Web", "La web la muestra Cancelada", "RF-24"],
].map(([n, donde, titulo, rf]) => ({ n: n!, donde: donde!, titulo: titulo!, rf: rf!, resultado: "no se ejecutó", detalle: "" }));

interface Peticion {
  paso: string;
  metodo: string;
  ruta: string;
  estado: number;
}

const peticiones: Peticion[] = [];
let pasoActual = "0";

test.describe.configure({ mode: "serial" });

// ── Evidencia y registro ──────────────────────────────────────────────────────────────────────────────────────────

async function evidenciaWeb(page: Page, testInfo: TestInfo, nombre: string) {
  const ruta = testInfo.outputPath(`${nombre}.png`);
  // Correos y contraseñas quedan tapados en las capturas.
  await page.screenshot({ path: ruta, fullPage: true, mask: [page.locator('input[type="email"], input[type="password"]')] });
  await testInfo.attach(nombre, { path: ruta, contentType: "image/png" });
}

async function evidenciaApk(apk: Apk, testInfo: TestInfo, nombre: string) {
  const ruta = testInfo.outputPath(`${nombre}.png`);
  apk.captura(ruta);
  await testInfo.attach(nombre, { path: ruta, contentType: "image/png" });
}

function registrarRespuestas(page: Page) {
  page.on("response", (r) => {
    const url = new URL(r.url());
    if (url.pathname.startsWith("/api/v1/")) {
      peticiones.push({ paso: pasoActual, metodo: r.request().method(), ruta: url.pathname, estado: r.status() });
    }
  });
  // Una respuesta que el navegador no deja leer (por ejemplo, un error del servidor sin cabeceras CORS) no llega como
  // «response»: se anota con estado 0 para que el acta no la pierda.
  page.on("requestfailed", (r) => {
    const url = new URL(r.url());
    if (url.pathname.startsWith("/api/v1/")) {
      peticiones.push({ paso: pasoActual, metodo: r.method(), ruta: `${url.pathname} (${r.failure()?.errorText ?? "falló"})`, estado: 0 });
    }
  });
}

/** Ejecuta un paso del acta: si falla, lo marca y detiene la corrida (los siguientes quedan «no se ejecutó»). */
async function paso(n: string, fn: () => Promise<string | undefined>) {
  const p = PASOS.find((x) => x.n === n)!;
  pasoActual = n;
  await test.step(`${n} · ${p.titulo}`, async () => {
    try {
      p.detalle = (await fn()) ?? "";
      p.resultado = "pasó";
    } catch (error) {
      const mensaje = (error as Error).message.split("\n")[0]!;
      p.resultado = mensaje.startsWith("BLOQUEADO") ? "bloqueado" : mensaje.startsWith("DETENIDO") ? "detenido" : "falló";
      p.detalle = mensaje;
      throw error;
    }
  });
}

async function detenerSiHayMantenimiento(page: Page, testInfo: TestInfo, n: string) {
  if (await page.getByText(MANTENIMIENTO).first().isVisible()) {
    await evidenciaWeb(page, testInfo, `${n}-bloqueado-por-mantenimiento`);
    throw new Error(`BLOQUEADO en el paso ${n}: el sitio muestra «${MANTENIMIENTO}» (la API responde 503).`);
  }
}

async function esperarPagina(page: Page) {
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
}

// ── API real (solo para leer el estado y registrar lo que respondió) ─────────────────────────────────────────────

const conToken = (token: string) => ({ Accept: "application/json", Authorization: `Bearer ${token}` });

async function tokenDe(page: Page) {
  return decodeURIComponent((await page.context().cookies()).find((c) => c.name === "ub_token")?.value ?? "");
}

interface CitaApi {
  id: string;
  code: string;
  fecha: string;
  hora_inicio: string;
  estado: string;
  has_payment?: boolean;
  pago_resuelto?: boolean | null;
}

async function citaEnApi(request: APIRequestContext, token: string, codigo: string): Promise<CitaApi> {
  const r = await request.get(`${API_URL}/api/v1/appointments`, { headers: conToken(token) });
  peticiones.push({ paso: pasoActual, metodo: "GET", ruta: "/api/v1/appointments (revisión de la prueba)", estado: r.status() });
  expect(r.status(), "la API debe devolver las citas del cliente").toBe(200);
  const cita = ((await r.json()).data as CitaApi[]).find((c) => c.code === codigo);
  expect(cita, `la API debe tener la cita ${codigo}`).toBeTruthy();

  return cita!;
}

async function esperarEstadoEnApi(request: APIRequestContext, token: string, codigo: string, cumple: (c: CitaApi) => boolean, segundos: number) {
  const limite = Date.now() + segundos * 1000;
  let cita = await citaEnApi(request, token, codigo);
  while (!cumple(cita) && Date.now() < limite) {
    await new Promise((r) => setTimeout(r, 3000));
    cita = await citaEnApi(request, token, codigo);
  }

  return cita;
}

/** Último despliegue correcto a staging de un repositorio (historial público de GitHub Actions). */
async function versionDesplegada(request: APIRequestContext, repo: string) {
  try {
    const r = await request.get(`https://api.github.com/repos/${repo}/actions/runs?per_page=40`, { headers: { Accept: "application/vnd.github+json" } });
    const corridas = ((await r.json()).workflow_runs ?? []) as { name: string; status: string; conclusion: string; head_sha: string; updated_at: string }[];
    const despliegues = corridas.filter((c) => /staging/i.test(c.name));
    const enCurso = despliegues.find((c) => c.status === "in_progress");
    const ultimo = despliegues.find((c) => c.conclusion === "success");

    return { commit: ultimo?.head_sha.slice(0, 7) ?? "desconocido", fecha: ultimo?.updated_at ?? "", desplegandoAhora: Boolean(enCurso) };
  } catch {
    return { commit: "no disponible", fecha: "", desplegandoAhora: false };
  }
}

/** Commit de una carpeta local (ensayo): «abc1234» o «abc1234 + cambios sin subir». */
function versionLocal(carpeta: string) {
  try {
    const commit = execFileSync("git", ["-C", carpeta, "log", "-1", "--format=%h %cs"], { encoding: "utf8" }).trim();
    const cambios = execFileSync("git", ["-C", carpeta, "status", "--porcelain", "--untracked-files=no"], { encoding: "utf8" }).trim();

    return `${commit}${cambios ? " + cambios sin subir" : ""}`;
  } catch {
    return "desconocido";
  }
}

/** «18:30» → «6:30 PM», como lo muestra la app (UrbanFormat.time). */
function horaDeLaApp(hhmm: string) {
  const [h, m] = hhmm.slice(0, 5).split(":").map(Number) as [number, number];

  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

async function iniciarSesionWeb(page: Page, email: string, password: string, testInfo: TestInfo, n: string) {
  await page.goto("/login");
  await page.getByLabel("Correo").fill(email);
  await page.locator("#password").fill(password);
  const login = page.waitForResponse((r) => r.url().includes("/api/v1/auth/login") && r.request().method() === "POST");
  await page.getByRole("button", { name: "Ingresar" }).click();
  expect((await login).status(), "la API debe aceptar las credenciales").toBe(200);
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
  await esperarPagina(page);
  await detenerSiHayMantenimiento(page, testInfo, n);
  const cargando = page.getByText("Cargando perfil…").first();
  if (await cargando.isVisible()) await cargando.waitFor({ state: "hidden", timeout: 30_000 }).catch(() => {});
  await detenerSiHayMantenimiento(page, testInfo, n);
}

// ── El recorrido ──────────────────────────────────────────────────────────────────────────────────────────────────

test(`flujo crítico (${TAREA}, antes de la sesión ${SESION} de la UAT): web, API y APK de staging`, async ({ page, request, browser }, testInfo) => {
  const cliente = { email: process.env.HUMO_EMAIL ?? "", password: process.env.HUMO_PASSWORD ?? "" };
  const personal = { email: process.env.HUMO_STAFF_EMAIL ?? "", password: process.env.HUMO_STAFF_PASSWORD ?? "" };
  const permitirEscritura = process.env.HUMO_PERMITIR_RESERVA === "1";
  registrarRespuestas(page);

  const build: Record<string, string> = {};
  let apk: Apk | undefined;
  let tokenCliente = "";
  let tokenPersonal = "";
  let nombreCliente = "";
  let servicio = "";
  let barbero = "";
  let hora = "";
  let codigo = "";
  let cita: CitaApi | undefined;
  let cancelada = false;
  const limpieza: string[] = [];

  try {
    await paso("0", async () => {
      if (LOCAL) {
        build.entorno = "LOCAL (ensayo): web en localhost:3000 y API de barber en Docker (127.0.0.1:8000)";
        build.web = `${versionLocal(".")} (build local de frontend-urban)`;
        build.api = `${versionLocal("../barber")} (barber local en Docker)`;
      } else {
        const [web, api] = await Promise.all([
          versionDesplegada(request, "KikeGonRam/frontend_Urbanblade"),
          versionDesplegada(request, "KikeGonRam/barber"),
        ]);
        build.entorno = "staging (urbanblade.com.mx y api.urbanblade.com.mx)";
        build.web = `${web.commit} (desplegado ${web.fecha})`;
        build.api = `${api.commit} (desplegado ${api.fecha})`;
        if (web.desplegandoAhora || api.desplegandoAhora) {
          throw new Error("BLOQUEADO en el paso 0: hay un despliegue a staging en curso; el build no está congelado.");
        }
      }
      expect(cliente.email && cliente.password, "Falta la cuenta del cliente: HUMO_EMAIL y HUMO_PASSWORD").toBeTruthy();
      if (!existsSync(APK_RUTA)) throw new Error(`Falta el APK congelado en ${APK_RUTA}.`);
      build.apk = `${APK_COMMIT}, SHA-256 ${createHash("sha256").update(readFileSync(APK_RUTA)).digest("hex")}`;
      // Antes de escribir nada en staging se confirma que se puede llegar al final: cuenta de personal y emulador.
      if (permitirEscritura) {
        expect(personal.email && personal.password, "Falta la cuenta del personal: HUMO_STAFF_EMAIL y HUMO_STAFF_PASSWORD").toBeTruthy();
        apk = Apk.elegirEmulador();
        build.emulador = `${apk.nombreDelEmulador()} (${apk.serie})`;
      }

      return `${build.entorno} · Web ${build.web} · API ${build.api} · APK ${build.apk}`;
    });

    await paso("1", async () => {
      const resumen: string[] = [];
      const pedir = (ruta: string) => request.get(`${API_URL}/api/v1/${ruta}`, { headers: { Accept: "application/json" } });
      for (const ruta of ["services", "barbers", "products"]) {
        const r = await pedir(ruta);
        const data = r.ok() ? (await r.json()).data : null;
        peticiones.push({ paso: "1", metodo: "GET", ruta: `/api/v1/${ruta}`, estado: r.status() });
        resumen.push(`${ruta} ${r.status()} (${Array.isArray(data) ? data.length : 0})`);
        expect(r.status(), `/api/v1/${ruta}`).toBe(200);
        expect(Array.isArray(data) && (ruta !== "services" || data.length > 0), `/api/v1/${ruta} debe devolver una lista`).toBe(true);
      }
      const perfil = await pedir("profile");
      peticiones.push({ paso: "1", metodo: "GET", ruta: "/api/v1/profile (sin sesión)", estado: perfil.status() });
      expect(perfil.status(), "una ruta protegida sin sesión debe responder 401").toBe(401);

      return `${resumen.join(", ")}, profile sin sesión ${perfil.status()}`;
    });

    await paso("2", async () => {
      await page.goto("/");
      await expect(page).toHaveTitle(/UrbanBlade/i);
      await expect(page.getByRole("link", { name: "Reservar", exact: true }).first()).toBeVisible();
      await evidenciaWeb(page, testInfo, "02-web-inicio");

      return "Título UrbanBlade y enlace «Reservar» visibles";
    });

    await paso("3", async () => {
      await iniciarSesionWeb(page, cliente.email, cliente.password, testInfo, "3");
      if (page.url().includes("/complete-profile")) {
        throw new Error("DETENIDO en el paso 3: la cuenta del cliente no tiene el perfil completo. Complétalo en la web.");
      }
      tokenCliente = await tokenDe(page);
      const me = await request.get(`${API_URL}/api/v1/auth/me`, { headers: conToken(tokenCliente) });
      expect(me.status(), "/auth/me con la sesión del cliente").toBe(200);
      const usuario = (await me.json()).user as { name: string; roles: string[] };
      expect(usuario.roles, "la cuenta de prueba debe ser de cliente").toContain("cliente");
      nombreCliente = usuario.name;
      await evidenciaWeb(page, testInfo, "03-web-sesion-cliente");

      return "La API aceptó las credenciales y la cuenta tiene rol cliente";
    });

    await paso("4", async () => {
      const lista = async <T,>(ruta: string): Promise<T[]> => {
        const r = await request.get(`${API_URL}/api/v1/${ruta}`, { headers: { Accept: "application/json" } });
        expect(r.status(), `/api/v1/${ruta}`).toBe(200);

        return (await r.json()).data as T[];
      };
      const servicios = await lista<{ nombre: string }>("services");
      const barberos = await lista<{ user?: { name?: string } }>("barbers");
      servicio = servicios[0]!.nombre;
      barbero = barberos[0]?.user?.name ?? "";

      await page.goto("/reservar");
      await esperarPagina(page);
      await detenerSiHayMantenimiento(page, testInfo, "4");
      await page.locator("button", { hasText: servicio }).first().click();
      const botonBarbero = page.locator("button", { hasText: barbero }).first();
      if (barbero && (await botonBarbero.waitFor({ state: "visible", timeout: 8_000 }).then(() => true, () => false))) {
        await botonBarbero.click();
      }
      // El día más lejano con horarios libres y su última hora: el hueco que menos estorba a clientes reales y que
      // deja más de 24 h para poder cancelar al final.
      const dias = page.getByRole("group", { name: "Elegir día" }).getByRole("button");
      const horas = page.getByRole("button", { name: /^\d{1,2}:\d{2}$/ });
      await expect(dias.first()).toBeVisible();
      for (let i = (await dias.count()) - 1; i >= 0 && !hora; i--) {
        await dias.nth(i).click();
        await expect(page.getByText(/disponibles? para|Ese día ya no tiene horarios libres|Sin horarios libres ese día|No se pudieron cargar los horarios/).first()).toBeVisible();
        if (await horas.count()) {
          hora = (await horas.last().innerText()).trim();
          await horas.last().click();
        }
      }
      expect(hora, "ningún día del calendario tiene horarios libres").not.toBe("");
      await expect(page.getByRole("button", { name: "Confirmar cita" })).toBeVisible();
      await evidenciaWeb(page, testInfo, "04-web-horario-elegido");

      return `${servicio} con ${barbero || "el barbero disponible"}, ${hora}`;
    });

    await paso("5", async () => {
      if (!permitirEscritura) {
        throw new Error("DETENIDO en el paso 5 a propósito: reservar crea una cita real. Para la corrida completa usa HUMO_PERMITIR_RESERVA=1.");
      }
      await page.getByRole("radio", { name: /Pagar en el salón/ }).click();
      await page.getByLabel(/Acepto el cargo por inasistencia/).check();
      // El código se toma de la respuesta real de la API al reservar (su formato ya no es «UB-0001»).
      const reserva = page.waitForResponse(
        (r) => r.request().method() === "POST" && new URL(r.url()).pathname === "/api/v1/appointments",
        { timeout: 60_000 },
      );
      await page.getByRole("button", { name: "Confirmar cita" }).click();
      const respuesta = await reserva;
      if (respuesta.status() === 503) {
        await evidenciaWeb(page, testInfo, "5-bloqueado-por-mantenimiento");
        throw new Error("BLOQUEADO en el paso 5: la API responde 503 (modo mantenimiento) al reservar.");
      }
      expect(respuesta.status(), "la API debe crear la cita (201)").toBe(201);
      codigo = ((await respuesta.json()) as { data?: { code?: string } }).data?.code ?? "";
      expect(codigo, "la API debe devolver el código de la cita").not.toBe("");
      await expect(page.getByText("Solicitud de cita registrada")).toBeVisible();
      await evidenciaWeb(page, testInfo, "05-web-cita-registrada");
      cita = await citaEnApi(request, tokenCliente, codigo);
      expect(cita.estado, "la cita nueva debe nacer pendiente en la API").toBe("pendiente");
      hora = cita.hora_inicio.slice(0, 5);

      return `Cita ${codigo} del ${cita.fecha} a las ${hora}: la API la tiene «pendiente»`;
    });

    // Las tarjetas de «Mis citas» con el mismo servicio y hora pueden ser de corridas anteriores (ya canceladas). La cita
    // de esta corrida es la que sigue activa: la única de ese horario que ofrece «Reagendar».
    const tarjetasWeb = () => page.locator(".ui-card").filter({ hasText: servicio }).filter({ hasText: `${hora} con` });
    const tarjetaWeb = () => tarjetasWeb().filter({ has: page.getByRole("button", { name: "Reagendar" }) }).first();

    await paso("6", async () => {
      await page.goto("/my/appointments");
      await esperarPagina(page);
      await detenerSiHayMantenimiento(page, testInfo, "6");
      await expect(tarjetaWeb()).toContainText("Pendiente");
      await evidenciaWeb(page, testInfo, "06-web-mis-citas-pendiente");

      return "La tarjeta de la cita dice «Pendiente»";
    });

    await paso("7", async () => {
      const huella = apk!.instalar(APK_RUTA);
      // El APK de debug habla con 127.0.0.1:8000: el túnel lleva ese puerto del emulador a la API local.
      if (LOCAL) apk!.adb(["reverse", "tcp:8000", "tcp:8000"]);
      build.apkInstalado = `versión ${apk!.versionInstalada()}, SHA-256 ${huella}`;
      await apk!.abrirLimpia("Iniciar sesión");
      await apk!.tocar("Iniciar sesión");
      await apk!.esperar("Entrar a UrbanBlade");
      await apk!.escribir(0, cliente.email, "el correo del cliente");
      await apk!.escribir(1, cliente.password, "la contraseña del cliente", { oculto: true });
      apk!.ocultarTeclado();
      await apk!.tocar("Entrar a UrbanBlade");
      await apk!.tocar("Mis citas", 60);
      await apk!.esperar(horaDeLaApp(hora), 45);
      await apk!.esperar("Pendiente");
      await apk!.esperar(/^Esperando que tu barbero apruebe la cita/);
      await evidenciaApk(apk!, testInfo, "07-apk-mis-citas-pendiente");

      const reaperturas = apk!.reaperturasPorAnr ? ` · la app se volvió a abrir ${apk!.reaperturasPorAnr} vez/veces por un ANR al arrancar` : "";

      return `La app muestra ${horaDeLaApp(hora)} «Pendiente» (${build.apkInstalado})${reaperturas}`;
    });

    await paso("8", async () => {
      const contexto = await (browser as Browser).newContext({
        baseURL: testInfo.project.use.baseURL,
        locale: "es-MX",
        timezoneId: "America/Mexico_City",
        storageState: testInfo.project.use.storageState as never,
      });
      const staff = await contexto.newPage();
      registrarRespuestas(staff);
      try {
        await iniciarSesionWeb(staff, personal.email, personal.password, testInfo, "8");
        tokenPersonal = await tokenDe(staff);
        const roles = ((await (await request.get(`${API_URL}/api/v1/auth/me`, { headers: conToken(tokenPersonal) })).json()).user?.roles ?? []) as string[];
        const aprobar = staff.waitForResponse((r) => r.url().includes(`/appointments/${codigo}/status`) && r.request().method() === "PATCH", { timeout: 60_000 });

        let fila;
        if (roles.includes("administrador") || roles.includes("recepcionista")) {
          await staff.goto("/appointments");
          await esperarPagina(staff);
          await staff.locator("select").filter({ has: staff.locator('option[value="pendiente"]') }).first().selectOption("pendiente");
          fila = staff.locator("tr").filter({ hasText: nombreCliente }).filter({ hasText: hora }).first();
          await expect(fila).toBeVisible();
          await fila.screenshot({ path: testInfo.outputPath("08a-personal-cita-pendiente.png") });
          await fila.getByRole("button", { name: "Confirmar", exact: true }).click();
        } else if (roles.includes("barbero")) {
          await staff.goto("/barber/agenda");
          await esperarPagina(staff);
          await staff.locator("#agenda-periodo").selectOption("week");
          fila = staff.getByRole("article").filter({ hasText: nombreCliente }).filter({ hasText: hora }).first();
          for (let semana = 0; semana < 8 && !(await fila.isVisible()); semana++) {
            await staff.getByRole("button", { name: "Siguiente" }).click();
            await esperarPagina(staff);
          }
          await expect(fila).toBeVisible();
          await fila.screenshot({ path: testInfo.outputPath("08a-personal-cita-pendiente.png") });
          await fila.getByRole("button", { name: "Aprobar" }).click();
        } else {
          throw new Error(`La cuenta del personal no puede aprobar citas (roles: ${roles.join(", ") || "ninguno"}).`);
        }
        await testInfo.attach("08a-personal-cita-pendiente", { path: testInfo.outputPath("08a-personal-cita-pendiente.png"), contentType: "image/png" });
        expect((await aprobar).status(), "la API debe aceptar la aprobación").toBe(200);
        cita = await esperarEstadoEnApi(request, tokenCliente, codigo, (c) => c.estado === "confirmada", 30);
        expect(cita.estado, "la API debe tener la cita confirmada").toBe("confirmada");
        // En la tabla de citas del personal el filtro «pendiente» esconde la fila en cuanto se confirma: se cambia el filtro.
        if (roles.includes("administrador") || roles.includes("recepcionista")) {
          await staff.locator("select").filter({ has: staff.locator('option[value="confirmada"]') }).first().selectOption("confirmada");
          fila = staff.locator("tr").filter({ hasText: nombreCliente }).filter({ hasText: hora }).first();
        }
        await expect(fila).toContainText("Confirmada");
        await fila.screenshot({ path: testInfo.outputPath("08b-personal-cita-confirmada.png") });
        await testInfo.attach("08b-personal-cita-confirmada", { path: testInfo.outputPath("08b-personal-cita-confirmada.png"), contentType: "image/png" });

        return `Aprobada por una cuenta con rol ${roles.join(", ")}; la API la tiene «confirmada»`;
      } finally {
        await contexto.close();
      }
    });

    await paso("9", async () => {
      await apk!.tocar("Actualizar");
      await apk!.esperar("Confirmada", 45);
      await apk!.esperar("Pagar cita");
      await evidenciaApk(apk!, testInfo, "09-apk-confirmada-pagar-cita");

      return "La app muestra «Confirmada» y el botón «Pagar cita»";
    });

    await paso("10", async () => {
      await page.goto("/my/appointments");
      await esperarPagina(page);
      await expect(tarjetaWeb()).toContainText("Confirmada");
      await tarjetaWeb().getByRole("button", { name: "Pagar con tarjeta" }).click();
      const dialogo = page.getByRole("dialog", { name: "Pagar con tarjeta" });
      await expect(dialogo).toBeVisible();
      const stripe = page.frameLocator('iframe[name^="__privateStripeFrame"]').first();
      await stripe.locator('input[name="cardnumber"]').pressSequentially(TARJETA_PRUEBA.numero, { delay: 40 });
      await stripe.locator('input[name="exp-date"]').pressSequentially(TARJETA_PRUEBA.vence, { delay: 40 });
      await stripe.locator('input[name="cvc"]').pressSequentially(TARJETA_PRUEBA.cvc, { delay: 40 });
      const cp = stripe.locator('input[name="postal"]');
      if (await cp.isVisible().catch(() => false)) await cp.pressSequentially(TARJETA_PRUEBA.cp, { delay: 40 });
      await evidenciaWeb(page, testInfo, "10a-web-pago-con-tarjeta-de-prueba");
      await dialogo.getByRole("button", { name: "Pagar", exact: true }).click();
      await expect(dialogo.getByText("Pago recibido.")).toBeVisible({ timeout: 60_000 });
      await evidenciaWeb(page, testInfo, "10b-web-pago-recibido");
      // El pago lo registra el webhook de Stripe en barber, no la web: se espera a que la API lo refleje.
      cita = await esperarEstadoEnApi(request, tokenCliente, codigo, (c) => Boolean(c.has_payment), 90);
      expect(cita.has_payment, "la API debe registrar el pago (webhook de Stripe)").toBe(true);
      await page.goto("/my/appointments");
      await esperarPagina(page);
      await expect(tarjetaWeb().getByRole("button", { name: "Pagar con tarjeta" })).toHaveCount(0);
      await evidenciaWeb(page, testInfo, "10c-web-mis-citas-pagada");

      return "Stripe (modo de prueba) aceptó la tarjeta 4242 y la API registró el pago";
    });

    await paso("11", async () => {
      const limite = Date.now() + 60_000;
      do {
        await apk!.tocar("Actualizar");
        if (!(await apk!.hay("Pagar cita"))) break;
      } while (Date.now() < limite);
      await apk!.esperarQueDesaparezca("Pagar cita", 5);
      await apk!.esperar("Confirmada");
      await evidenciaApk(apk!, testInfo, "11-apk-pagada");
      const resuelto = await apk!.hay(/^Cita aprobada y pago resuelto/);

      return `La app ya no ofrece «Pagar cita»${resuelto ? " y dice «Cita aprobada y pago resuelto»" : ""}`;
    });

    await paso("12", async () => {
      await apk!.tocar("Cancelar");
      await apk!.esperar("¿Cancelar tu cita?");
      await evidenciaApk(apk!, testInfo, "12a-apk-confirmar-cancelacion");
      await apk!.tocar("Sí, cancelar");
      cita = await esperarEstadoEnApi(request, tokenCliente, codigo, (c) => c.estado === "cancelada", 30);
      expect(cita.estado, "la API debe tener la cita cancelada").toBe("cancelada");
      cancelada = true;
      await apk!.tocar("Historial");
      await apk!.esperar("Cancelada");
      await evidenciaApk(apk!, testInfo, "12b-apk-historial-cancelada");

      return "Cancelada desde la app; la API la tiene «cancelada»";
    });

    await paso("13", async () => {
      await page.goto("/my/appointments");
      await esperarPagina(page);
      // Ya no queda ninguna tarjeta activa de ese horario y la cita aparece entre las canceladas.
      await expect(tarjetasWeb().filter({ has: page.getByRole("button", { name: "Reagendar" }) })).toHaveCount(0);
      await expect(tarjetasWeb().filter({ hasText: "Cancelada" }).first()).toBeVisible();
      await evidenciaWeb(page, testInfo, "13-web-mis-citas-cancelada");

      return "La tarjeta de la cita dice «Cancelada»";
    });
  } finally {
    // Limpieza: si la corrida se detuvo con la cita creada, se cancela para no dejar un horario ocupado en staging.
    if (codigo && !cancelada && tokenCliente) {
      const r = await request.delete(`${API_URL}/api/v1/appointments/${codigo}`, { headers: conToken(tokenCliente) }).catch(() => null);
      limpieza.push(`Cita ${codigo} cancelada por la limpieza: ${r ? r.status() : "sin respuesta"}`);
    }
    for (const token of [tokenPersonal, tokenCliente].filter(Boolean)) {
      await request.post(`${API_URL}/api/v1/auth/logout`, { headers: conToken(token) }).catch(() => null);
    }

    const fallo = PASOS.find((p) => p.resultado !== "pasó" && p.resultado !== "no se ejecutó");
    const veredicto = !fallo
      ? `APTO: todos los pasos respondieron con la API real y el estado coincide en la web y el APK. La sesión ${SESION} de la UAT puede hacerse con este build.`
      : fallo.resultado === "detenido"
        ? `INCOMPLETO: la corrida se detuvo en el paso ${fallo.n} a propósito (${fallo.detalle}).`
        : `NO APTO: falló el paso ${fallo.n} (${fallo.titulo}). La sesión ${SESION} de la UAT no se hace con este build.`;
    const acta = {
      tarea: TAREA,
      sesionUat: SESION,
      fecha: new Date().toISOString(),
      build,
      cita: codigo ? { codigo, servicio, barbero, hora, estadoFinal: cita?.estado, pagada: cita?.has_payment } : null,
      pasos: PASOS,
      limpieza,
      veredicto,
    };
    const tabla = PASOS.map((p) => `| ${p.n} | ${p.donde} | ${p.titulo} | ${p.rf} | ${p.resultado} | ${p.detalle.replace(/\|/g, "/")} |`);
    const md = [
      `# Acta de la prueba de humo (${TAREA}, antes de la sesión ${SESION} de la UAT) — ${acta.fecha}`,
      "",
      `- Entorno: ${build.entorno ?? "—"}`,
      `- Web: ${build.web ?? "—"}`,
      `- API: ${build.api ?? "—"}`,
      `- APK: ${build.apk ?? "—"}${build.apkInstalado ? ` · instalado: ${build.apkInstalado}` : ""}`,
      `- Emulador: ${build.emulador ?? "—"}`,
      "",
      "| # | Dónde | Paso | Requisito | Resultado | Detalle |",
      "|---|---|---|---|---|---|",
      ...tabla,
      "",
      ...limpieza.map((l) => `- Limpieza: ${l}`),
      "",
      `**Veredicto:** ${veredicto}`,
    ].join("\n");
    writeFileSync(testInfo.outputPath("acta.md"), md);
    writeFileSync(testInfo.outputPath("acta.json"), JSON.stringify(acta, null, 2));
    writeFileSync(testInfo.outputPath("peticiones-api.json"), JSON.stringify(peticiones, null, 2));
    await testInfo.attach("acta.md", { path: testInfo.outputPath("acta.md"), contentType: "text/markdown" });
    await testInfo.attach("peticiones-api.json", { path: testInfo.outputPath("peticiones-api.json"), contentType: "application/json" });
    console.log(`\n${md}\n`);
  }
});
