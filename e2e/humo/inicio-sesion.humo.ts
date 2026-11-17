import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { expect, test, type APIRequestContext, type Browser, type BrowserContext, type Page, type TestInfo } from "@playwright/test";

import { Apk } from "./apk";

/*
 * T076 (HT-43): «Cada rol entra a sus pantallas». Prueba de integración de sistemas del módulo «Inicio de sesión por
 * rol», con enfoque de caja negra, para RF-02 (Inicio de sesión) y RF-18 (Administración de usuarios y roles).
 *
 *   1. Iniciar sesión con cada cuenta en la web (y el cliente también en la app): cada rol entra a SU panel, ve SU menú,
 *      abre una pantalla propia y, si intenta abrir una pantalla de otro rol, la web lo regresa a su panel.
 *   2. Intentar con contraseña incorrecta: se muestra el error y no se inicia la sesión (web y app).
 *
 * Las cuentas salen de ~/.urbanblade-humo.env (staging) o ~/.urbanblade-humo-local.env (HUMO_ENTORNO=local):
 *   HUMO_EMAIL / HUMO_PASSWORD                         cliente
 *   HUMO_BARBERO_EMAIL / HUMO_BARBERO_PASSWORD         barbero
 *   HUMO_RECEPCION_EMAIL / HUMO_RECEPCION_PASSWORD     recepcionista (si no está, HUMO_STAFF_EMAIL / HUMO_STAFF_PASSWORD)
 *   HUMO_ADMIN_EMAIL / HUMO_ADMIN_PASSWORD             administrador
 * Un rol sin cuenta en el entorno queda «bloqueado» (no se puede probar), no «falló».
 *
 * Los correos y contraseñas quedan tapados en todas las capturas (web y app).
 */

const LOCAL = process.env.HUMO_ENTORNO === "local";
const API_URL = process.env.HUMO_API_URL ?? (LOCAL ? "http://127.0.0.1:8000" : "https://api.urbanblade.com.mx");
const APK_RUTA = resolve(process.env.HUMO_APK ?? "../documentacion/HT-46/T075/apk/UrbanBlade-staging-main-095f168.apk");
// La app se prueba contra staging (el APK de staging apunta a la API de staging). En local se omite.
const CON_APP = !LOCAL && process.env.HUMO_SIN_APP !== "1";
const CLAVE_INCORRECTA = "ClaveIncorrecta2026";
const AVISO_SIN_PERMISO = /No tienes permiso para abrir esa pantalla/;
const ERROR_CREDENCIALES = /Las credenciales no son válidas/;
// La app no repite el mensaje de la API: con un 422 en el acceso dice «Revisa tu correo y tu contraseña e inténtalo de nuevo.».
const ERROR_CREDENCIALES_APP = /Revisa tu correo y tu contraseña|credenciales/i;

// En local la web corre en otro puerto que el que acepta el CORS de la API local: el navegador de la prueba no aplica
// CORS (solo en este ensayo local, con HUMO_WEB_SIN_CORS=1). En staging no se usa.
if (process.env.HUMO_WEB_SIN_CORS === "1") test.use({ launchOptions: { args: ["--disable-web-security"] } });

type Rol = "cliente" | "barbero" | "recepcionista" | "administrador";
interface Cuenta {
  rol: Rol;
  email?: string;
  password?: string;
  /** Lo que el panel de ese rol muestra siempre. */
  panel: { descripcion: string; localizador: (p: Page) => ReturnType<Page["locator"]> };
  /** Una pantalla del menú de ese rol, que debe abrir. */
  propia: { ruta: string; texto: string };
  /** Una pantalla de otro rol, que no debe abrir. */
  ajena: { ruta: string; texto: string };
}

const env = process.env;
const CUENTAS: Cuenta[] = [
  {
    rol: "cliente",
    email: env.HUMO_EMAIL,
    password: env.HUMO_PASSWORD,
    panel: { descripcion: "«Tu nivel» y «Tu próxima cita»", localizador: (p) => p.locator('[aria-label="Tu nivel"]') },
    propia: { ruta: "/my/appointments", texto: "Mis Citas" },
    ajena: { ruta: "/users", texto: "Usuarios (administrador)" },
  },
  {
    rol: "barbero",
    email: env.HUMO_BARBERO_EMAIL,
    password: env.HUMO_BARBERO_PASSWORD,
    panel: { descripcion: "«Tu semana» (citas de los últimos 7 días)", localizador: (p) => p.getByText("Tu semana", { exact: true }) },
    propia: { ruta: "/barber/agenda", texto: "Mi Agenda" },
    ajena: { ruta: "/users", texto: "Usuarios (administrador)" },
  },
  {
    rol: "recepcionista",
    email: env.HUMO_RECEPCION_EMAIL ?? env.HUMO_STAFF_EMAIL,
    password: env.HUMO_RECEPCION_PASSWORD ?? env.HUMO_STAFF_PASSWORD,
    panel: { descripcion: "«Resumen del turno» y «Citas por hora»", localizador: (p) => p.locator('[aria-label="Resumen del turno"]') },
    propia: { ruta: "/appointments", texto: "Citas" },
    ajena: { ruta: "/users", texto: "Usuarios (administrador)" },
  },
  {
    rol: "administrador",
    email: env.HUMO_ADMIN_EMAIL,
    password: env.HUMO_ADMIN_PASSWORD,
    panel: { descripcion: "«Ingresos por semana» y «Servicios más pedidos»", localizador: (p) => p.getByText("Ingresos por semana", { exact: true }) },
    propia: { ruta: "/users", texto: "Usuarios" },
    ajena: { ruta: "/barber/agenda", texto: "Mi Agenda (barbero)" },
  },
];

type Resultado = "pasó" | "falló" | "bloqueado" | "omitido" | "no se ejecutó";
interface Paso { n: string; donde: string; titulo: string; esperado: string; resultado: Resultado; detalle: string }
const PASOS: Paso[] = [];
function nuevoPaso(n: string, donde: string, titulo: string, esperado: string) {
  PASOS.push({ n, donde, titulo, esperado, resultado: "no se ejecutó", detalle: "" });
}

nuevoPaso("0", "—", "Entorno: web, API y cuentas", "La web y la API responden");
nuevoPaso("P", "API", "Precondición: una cuenta por rol, con su rol", "Cada cuenta inicia sesión en la API con el rol esperado");
for (const c of CUENTAS) nuevoPaso(`1-${c.rol}`, "Web", `Iniciar sesión como ${c.rol}`, `Entra a su panel, ve su menú y abre «${c.propia.texto}»; una pantalla de otro rol lo regresa a su panel`);
nuevoPaso("1-cliente-app", "APK", "Iniciar sesión como cliente en la app", "Entra a su inicio (dashboard) en la app");
for (const c of CUENTAS) nuevoPaso(`2-${c.rol}`, "Web", `Contraseña incorrecta (${c.rol})`, "Se muestra el error y no se inicia la sesión");
nuevoPaso("2-cliente-app", "APK", "Contraseña incorrecta en la app (cliente)", "Se muestra el error y no se inicia la sesión");

/** Corre un paso. Si falla, lo marca en rojo en el reporte y sigue con el siguiente; al final la prueba falla. */
async function paso(n: string, fn: () => Promise<string>) {
  const p = PASOS.find((x) => x.n === n)!;
  try {
    await test.step(`${n} · ${p.titulo}`, async () => {
      try {
        p.detalle = await fn();
        p.resultado = "pasó";
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

function marcar(n: string, resultado: "bloqueado" | "omitido", motivo: string) {
  const p = PASOS.find((x) => x.n === n)!;
  p.resultado = resultado;
  p.detalle = motivo;
}

async function loginApi(request: APIRequestContext, email: string, password: string) {
  const r = await request.post(`${API_URL}/api/v1/auth/login`, { headers: { Accept: "application/json" }, data: { email, password, device_name: "QA T076 roles" } });
  const cuerpo = r.ok() ? await r.json() : {};

  return { estado: r.status(), roles: (cuerpo.user?.roles ?? []) as string[], completo: Boolean(cuerpo.user?.profile_complete), nombre: (cuerpo.user?.name ?? "") as string };
}

/** Captura de página completa con correos y contraseñas tapados. */
async function capturaWeb(page: Page, testInfo: TestInfo, archivo: string) {
  const ruta = testInfo.outputPath(archivo);
  // Se tapa cualquier correo que se vea (por ejemplo, la columna «Email» de «Gestión de Usuarios»), no solo el de la
  // cuenta que entra: la evidencia se comparte.
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
  const ctx = await browser.newContext({ viewport: { width: ancho, height: alto }, deviceScaleFactor: 1, recordVideo: undefined });
  const p = await ctx.newPage();
  const cajas = zonas
    .map((z) => `<div style="position:absolute;left:${z.x1}px;top:${z.y1}px;width:${z.x2 - z.x1}px;height:${z.y2 - z.y1}px;background:#3b3b3b;border-radius:18px;color:#e6e6e6;font:600 34px sans-serif;display:flex;align-items:center;justify-content:center">correo oculto</div>`)
    .join("");
  await p.setContent(`<body style="margin:0"><div id="c" style="position:relative;width:${ancho}px;height:${alto}px"><img src="data:image/png;base64,${png.toString("base64")}" style="display:block;width:${ancho}px;height:${alto}px">${cajas}</div></body>`);
  await p.locator("#c").screenshot({ path: ruta });
  await ctx.close();
}

async function capturaApp(apk: Apk, browser: Browser, testInfo: TestInfo, archivo: string, email?: string) {
  const ruta = testInfo.outputPath(archivo);
  const nodos = await apk.nodos();
  apk.captura(ruta);
  const zonas = email ? nodos.filter((n) => n.texto.includes(email) || n.descripcion.includes(email)).map((n) => ({ x1: n.izquierda, y1: n.arriba, x2: n.derecha, y2: n.abajo })) : [];
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

/** Llena el formulario de acceso de la web y espera la respuesta de POST /auth/login. */
async function entrarWeb(page: Page, email: string, password: string) {
  await page.goto("/login");
  await escribirSinRegistro(page, "#email", email);
  await escribirSinRegistro(page, "#password", password);
  const respuesta = page.waitForResponse((r) => r.url().includes("/auth/login") && r.request().method() === "POST", { timeout: 60_000 });
  await page.getByRole("button", { name: "Ingresar" }).click();

  return (await respuesta).status();
}

async function sesionAbierta(contexto: BrowserContext) {
  return (await contexto.cookies()).some((c) => c.name === "ub_token" && c.value && c.value !== "null");
}

test("T076: cada rol entra a sus pantallas (RF-02 y RF-18)", async ({ request, browser, baseURL }, testInfo) => {
  test.setTimeout(30 * 60_000);
  const datos: Record<string, unknown> = {};
  const disponibles = CUENTAS.filter((c) => c.email && c.password);
  const faltantes = CUENTAS.filter((c) => !c.email || !c.password);
  let apk: Apk | undefined;

  try {
    await paso("0", async () => {
      const web = await request.get(`${baseURL}/login`);
      expect(web.status(), "la web debe responder").toBe(200);
      const api = await request.get(`${API_URL}/api/v1/services`, { headers: { Accept: "application/json" } });
      expect(api.status(), "la API debe responder").toBe(200);
      Object.assign(datos, {
        entorno: LOCAL ? "local (web en este equipo + API en Docker con Atlas)" : "staging",
        web: baseURL,
        api: API_URL,
        cuentas: disponibles.map((c) => c.rol).join(", ") || "(ninguna)",
        sinCuenta: faltantes.map((c) => c.rol).join(", ") || "(ninguna)",
        claveIncorrecta: "(una contraseña inventada, la misma para todos)",
      });
      if (CON_APP) {
        apk = Apk.elegirEmulador();
        apk.mantenerDespierto();
        datos.apk = `${APK_RUTA.split(/[\\/]/).pop()} (SHA-256 ${apk.instalar(APK_RUTA)})`;
        datos.emulador = `${apk.nombreDelEmulador()} (${apk.serie})`;
      }

      return `${datos.entorno} · web ${web.status()} · API ${api.status()} · cuentas: ${datos.cuentas}`;
    });

    for (const c of faltantes) {
      marcar(`1-${c.rol}`, "bloqueado", `No hay cuenta de ${c.rol} en este entorno`);
      marcar(`2-${c.rol}`, "bloqueado", `No hay cuenta de ${c.rol} en este entorno`);
    }
    if (!CON_APP) {
      const motivo = LOCAL ? "La app se prueba en staging" : "Corrida solo de la web (HUMO_SIN_APP=1)";
      marcar("1-cliente-app", "omitido", motivo);
      marcar("2-cliente-app", "omitido", motivo);
    }

    // ---- Precondición: cada cuenta existe en la API con su rol; el cliente, con el perfil completo ----
    await paso("P", async () => {
      const filas: string[] = [];
      const precondicion: Record<string, unknown> = {};
      for (const c of disponibles) {
        const r = await loginApi(request, c.email!, c.password!);
        precondicion[c.rol] = { estado: r.estado, roles: r.roles, perfilCompleto: r.completo };
        expect(r.estado, `la cuenta de ${c.rol} debe iniciar sesión en la API`).toBe(200);
        expect(r.roles, `la cuenta de ${c.rol} debe tener ese rol`).toContain(c.rol);
        if (c.rol === "cliente" && !r.completo) {
          // Un cliente sin teléfono ni fecha de nacimiento entra primero a «Completa tu perfil» (así funciona la web).
          // La cuenta sintética se completa una sola vez con datos inventados, y queda en la evidencia.
          const ctx = await browser.newContext();
          const page = await ctx.newPage();
          await entrarWeb(page, c.email!, c.password!);
          await page.waitForURL(/complete-profile/, { timeout: 60_000 });
          await capturaWeb(page, testInfo, "P-1-cliente-completa-tu-perfil.png");
          await page.locator("#telefono").fill("5512345678");
          await page.locator("#fecha-nacimiento").fill("1995-04-12");
          await page.locator("#sexo").selectOption("prefiero_no_decir");
          await page.getByRole("button", { name: "Guardar y continuar" }).click();
          await page.waitForURL((u) => !u.pathname.includes("complete-profile"), { timeout: 60_000 });
          await capturaWeb(page, testInfo, "P-2-cliente-perfil-completo.png");
          await ctx.close();
          precondicion.perfilDelClienteCompletado = "teléfono 5512345678, nacimiento 1995-04-12, sexo «prefiero no decir» (datos sintéticos)";
          filas.push("cliente (se completó su perfil con datos sintéticos)");
        } else {
          filas.push(c.rol);
        }
      }
      datos.precondicion = precondicion;

      return `Inician sesión en la API con su rol: ${filas.join(", ")}`;
    });

    // ---- Acción 1: cada rol entra a sus pantallas ----
    for (const c of disponibles) {
      await paso(`1-${c.rol}`, async () => {
        const ctx = await browser.newContext();
        const page = await ctx.newPage();
        try {
          const estado = await entrarWeb(page, c.email!, c.password!);
          expect(estado, "POST /auth/login debe responder 200").toBe(200);
          await page.waitForURL(/\/dashboard/, { timeout: 60_000 });
          await expect(c.panel.localizador(page).first(), `el panel de ${c.rol} debe mostrar ${c.panel.descripcion}`).toBeVisible({ timeout: 60_000 });
          await expect(page.getByText("todavía no está migrado")).toHaveCount(0);
          await page.waitForLoadState("networkidle").catch(() => {});
          await capturaWeb(page, testInfo, `1-${c.rol}-a-panel.png`);

          // Su menú: tiene su pantalla propia y no la del otro rol.
          const linkPropio = await page.locator(`a[href="${c.propia.ruta}"]`).count();
          const linkAjeno = await page.locator(`a[href="${c.ajena.ruta}"]`).count();
          expect(linkPropio, `el menú de ${c.rol} debe tener «${c.propia.texto}»`).toBeGreaterThan(0);
          expect(linkAjeno, `el menú de ${c.rol} no debe tener «${c.ajena.texto}»`).toBe(0);

          // Abre su pantalla propia.
          await page.goto(c.propia.ruta);
          await page.waitForLoadState("networkidle").catch(() => {});
          await expect(page, `${c.rol} debe poder abrir ${c.propia.ruta}`).toHaveURL(new RegExp(`${c.propia.ruta.replace(/\//g, "\\/")}(\\?|$)`), { timeout: 30_000 });
          await expect(page.getByText(AVISO_SIN_PERMISO)).toHaveCount(0);
          await capturaWeb(page, testInfo, `1-${c.rol}-b-pantalla-propia.png`);

          // Intenta una pantalla de otro rol: la web lo regresa a su panel con un aviso.
          await page.goto(c.ajena.ruta);
          await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
          await expect(page.getByText(AVISO_SIN_PERMISO).first(), "debe avisar que no tiene permiso").toBeVisible({ timeout: 30_000 });
          await expect(c.panel.localizador(page).first(), `debe regresar al panel de ${c.rol}`).toBeVisible({ timeout: 60_000 });
          await page.waitForLoadState("networkidle").catch(() => {});
          await capturaWeb(page, testInfo, `1-${c.rol}-c-pantalla-ajena-denegada.png`);

          (datos.accion1 ??= {} as Record<string, unknown>);
          (datos.accion1 as Record<string, unknown>)[c.rol] = { panel: c.panel.descripcion, propia: c.propia.ruta, ajenaDenegada: c.ajena.ruta };

          return `Entra a /dashboard con su panel (${c.panel.descripcion}); su menú tiene «${c.propia.texto}» y no «${c.ajena.texto}»; abre ${c.propia.ruta}; ${c.ajena.ruta} lo regresa a su panel con «No tienes permiso…»`;
        } finally {
          await ctx.close();
        }
      });
    }

    const cliente = CUENTAS.find((c) => c.rol === "cliente")!;
    if (CON_APP && apk && cliente.email) {
      await paso("1-cliente-app", async () => {
        await apk!.abrirLimpia("Iniciar sesión");
        await apk!.tocar("Iniciar sesión");
        await apk!.esperar("Entrar a UrbanBlade");
        await apk!.escribir(0, cliente.email!, "el correo del cliente");
        await apk!.escribir(1, cliente.password!, "la contraseña del cliente", { oculto: true });
        await capturaApp(apk!, browser, testInfo, "1-cliente-app-a-acceso.png", cliente.email);
        await apk!.tocar("Entrar a UrbanBlade");
        await apk!.esperar("Mis citas", 90);
        await apk!.esperar("Inicio", 30);
        await new Promise((r) => setTimeout(r, 2500));
        const textos = [...new Set((await apk!.nodos()).flatMap((n) => [n.texto, n.descripcion]).filter(Boolean))];
        await capturaApp(apk!, browser, testInfo, "1-cliente-app-b-inicio.png", cliente.email);
        datos.appInicio = textos;
        expect(await apk!.hay("Entrar a UrbanBlade"), "ya no debe estar en el acceso").toBe(false);

        return `La app entra al inicio del cliente: ${textos.filter((t) => /^(BUENAS|Inicio|Reservar|Mis citas|Cuenta)/i.test(t)).join(" · ")}`;
      });
    }

    // ---- Acción 2: contraseña incorrecta ----
    for (const c of disponibles) {
      await paso(`2-${c.rol}`, async () => {
        const ctx = await browser.newContext();
        const page = await ctx.newPage();
        try {
          const estado = await entrarWeb(page, c.email!, CLAVE_INCORRECTA);
          expect(estado, "POST /auth/login con contraseña incorrecta debe responder 422").toBe(422);
          await expect(page.getByText(ERROR_CREDENCIALES).first(), "debe mostrarse el error").toBeVisible({ timeout: 30_000 });
          await expect(page).toHaveURL(/\/login/);
          await capturaWeb(page, testInfo, `2-${c.rol}-a-error.png`);
          expect(await sesionAbierta(ctx), "no debe quedar sesión (cookie ub_token)").toBe(false);
          // Sin sesión, el panel no abre: la web manda al acceso.
          await page.goto("/dashboard");
          await page.waitForURL(/\/login/, { timeout: 30_000 });
          await capturaWeb(page, testInfo, `2-${c.rol}-b-dashboard-sin-sesion.png`);

          return `POST /auth/login 422; la web muestra «Las credenciales no son válidas.» y sigue en /login; sin cookie de sesión; /dashboard manda a /login`;
        } finally {
          await ctx.close();
        }
      });
    }

    if (CON_APP && apk && cliente.email) {
      await paso("2-cliente-app", async () => {
        await apk!.abrirLimpia("Iniciar sesión");
        await apk!.tocar("Iniciar sesión");
        await apk!.esperar("Entrar a UrbanBlade");
        await apk!.escribir(0, cliente.email!, "el correo del cliente");
        await apk!.escribir(1, CLAVE_INCORRECTA, "la contraseña incorrecta", { oculto: true });
        await apk!.tocar("Entrar a UrbanBlade");
        const error = await apk!.esperar(ERROR_CREDENCIALES_APP, 60);
        await capturaApp(apk!, browser, testInfo, "2-cliente-app-a-error.png", cliente.email);
        expect(await apk!.hay("Entrar a UrbanBlade"), "debe seguir en el acceso").toBe(true);
        expect(await apk!.hay("Mis citas"), "no debe entrar al inicio del cliente").toBe(false);

        return `La app muestra «${error.texto || error.descripcion}» y sigue en el acceso; no entra al inicio`;
      });
    }
  } finally {
    const fallidos = PASOS.filter((p) => p.resultado === "falló");
    const bloqueados = PASOS.filter((p) => p.resultado === "bloqueado");
    const veredicto = fallidos.length
      ? `FALLIDA: falló ${fallidos.map((p) => p.n).join(", ")}.`
      : bloqueados.length
        ? `BLOQUEADA en este entorno para: ${[...new Set(bloqueados.map((p) => p.n.replace(/^\d-/, "")))].join(", ")} (sin cuenta). Lo demás pasó.`
        : "APROBADA: cada rol entra a sus pantallas y la contraseña incorrecta muestra el error sin iniciar sesión.";
    const md = [
      `# Acta T076 (HT-43) — Cada rol entra a sus pantallas — ${new Date().toISOString()}`,
      "",
      ...Object.entries(datos).filter(([, v]) => typeof v === "string").map(([k, v]) => `- ${k}: ${String(v)}`),
      "",
      "| # | Dónde | Paso | Resultado esperado | Resultado | Detalle |",
      "|---|---|---|---|---|---|",
      ...PASOS.map((p) => `| ${p.n} | ${p.donde} | ${p.titulo} | ${p.esperado} | ${p.resultado} | ${p.detalle.replace(/\|/g, "/")} |`),
      "",
      `**Veredicto (${LOCAL ? "local" : "staging"}):** ${veredicto}`,
    ].join("\n");
    writeFileSync(testInfo.outputPath("acta-T076-roles.md"), md);
    writeFileSync(testInfo.outputPath("datos-T076-roles.json"), JSON.stringify({ ...datos, pasos: PASOS, veredicto }, null, 2));
    await testInfo.attach("acta-T076-roles.md", { path: testInfo.outputPath("acta-T076-roles.md"), contentType: "text/markdown" });
    console.log(`\n${md}\n`);
  }

  expect(PASOS.filter((p) => p.resultado === "falló").map((p) => `${p.n}: ${p.detalle}`), "pasos que fallaron").toEqual([]);
});
