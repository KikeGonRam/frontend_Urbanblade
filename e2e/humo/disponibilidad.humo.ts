import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { expect, test, type APIRequestContext, type TestInfo } from "@playwright/test";

import { Apk } from "./apk";

/*
 * T093 (HT-43): «La disponibilidad no ofrece horarios ocupados». Prueba de integración de sistemas del módulo
 * «Disponibilidad», con enfoque de caja negra, para RF-09 (Consulta de disponibilidad).
 *
 * Precondición: una cita CONFIRMADA del barbero 1 a las 12:00. Acciones, como cliente en la app Android:
 *   1. Consultar la disponibilidad del barbero 1  -> 12:00 no aparece (sí sus vecinas 11:30 y 12:30).
 *   2. Consultar la de un barbero libre ese mismo día -> 12:00 sí aparece.
 * Cada acción se contrasta con la API real (GET /availability/slots). La precondición se prepara por la API (reserva
 * del cliente y aprobación de recepción) y la cita se cancela al terminar.
 *
 * Datos (con valores por defecto para el ensayo local): HUMO_T093_BARBERO_1, HUMO_T093_BARBERO_LIBRE (nombre completo),
 * HUMO_T093_FECHA (AAAA-MM-DD), HUMO_T093_SERVICIO y HUMO_T093_HORA. Solo escribe datos con HUMO_PERMITIR_RESERVA=1.
 */

const LOCAL = process.env.HUMO_ENTORNO === "local";
const API_URL = process.env.HUMO_API_URL ?? (LOCAL ? "http://127.0.0.1:8000" : "https://api.urbanblade.com.mx");
const APK_RUTA = resolve(
  process.env.HUMO_APK
    ?? (LOCAL
      ? "../documentacion/HT-46/T075/apk/UrbanBlade-debug-local-main-095f168.apk"
      : "../documentacion/HT-46/T075/apk/UrbanBlade-staging-main-095f168.apk"),
);
const BARBERO_1 = process.env.HUMO_T093_BARBERO_1 ?? "Adrián Marrero Delarosa";
const BARBERO_LIBRE = process.env.HUMO_T093_BARBERO_LIBRE ?? "Juan José Rendón Pacheco";
const FECHA = process.env.HUMO_T093_FECHA ?? "2026-11-16";
const SERVICIO = process.env.HUMO_T093_SERVICIO ?? "Afeitado Clásico";
const HORA = process.env.HUMO_T093_HORA ?? "12:00";

/** Las dos horas vecinas: prueban que la lista cargó y que solo falta la hora ocupada. */
function vecinas(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number) as [number, number];
  const fmt = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

  return [fmt(h * 60 + m - 30), fmt(h * 60 + m + 30)];
}

type Resultado = "pasó" | "falló" | "detenido" | "no se ejecutó";
interface Paso { n: string; donde: string; titulo: string; esperado: string; resultado: Resultado; detalle: string }

const PASOS: Paso[] = [
  ["0", "—", "Entorno y datos de la prueba", "—"],
  ["P", "API", `Precondición: cita confirmada del barbero 1 a las ${HORA}`, "La API la tiene «confirmada»"],
  ["1a", "API", "Disponibilidad del barbero 1 (API real)", `${HORA} no aparece`],
  ["1b", "APK", "Disponibilidad del barbero 1 en la app", `${HORA} no aparece para el barbero 1`],
  ["2a", "API", "Disponibilidad del barbero libre (API real)", `${HORA} sí aparece`],
  ["2b", "APK", "Disponibilidad del barbero libre en la app", `${HORA} sí aparece para el barbero libre`],
].map(([n, donde, titulo, esperado]) => ({ n: n!, donde: donde!, titulo: titulo!, esperado: esperado!, resultado: "no se ejecutó", detalle: "" }));

async function paso(n: string, fn: () => Promise<string>) {
  const p = PASOS.find((x) => x.n === n)!;
  await test.step(`${n} · ${p.titulo}`, async () => {
    try {
      p.detalle = await fn();
      p.resultado = "pasó";
    } catch (error) {
      const mensaje = (error as Error).message.split("\n")[0]!;
      p.resultado = mensaje.startsWith("DETENIDO") ? "detenido" : "falló";
      p.detalle = mensaje;
      throw error;
    }
  });
}

const conToken = (token: string) => ({ Accept: "application/json", Authorization: `Bearer ${token}` });

async function iniciarSesion(request: APIRequestContext, email: string, password: string) {
  const r = await request.post(`${API_URL}/api/v1/auth/login`, {
    headers: { Accept: "application/json" },
    data: { email, password, device_name: "Prueba T093", plataforma: "web" },
  });
  expect(r.status(), "la API debe aceptar la cuenta").toBe(200);

  return (await r.json()).token as string;
}

async function horasEnApi(request: APIRequestContext, barberId: string, serviceId: string) {
  const r = await request.get(`${API_URL}/api/v1/availability/slots?barber_id=${barberId}&service_id=${serviceId}&date=${FECHA}`, {
    headers: { Accept: "application/json" },
  });
  expect(r.status(), "GET /availability/slots").toBe(200);

  return ((await r.json()).slots as { time: string }[]).map((s) => s.time);
}

/** La app muestra las horas en formato de 12 h («12:00 PM»); la API, en 24 h («12:00»). */
const HORA_APP = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i;

function a24h(etiqueta: string) {
  const m = etiqueta.trim().match(HORA_APP);
  if (!m) return etiqueta.trim();
  let h = Number(m[1]) % 12;
  if (m[3]!.toUpperCase() === "PM") h += 12;

  return `${String(h).padStart(2, "0")}:${m[2]}`;
}

function aEtiquetaApp(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number) as [number, number];

  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

/** Todas las horas que la app muestra en el paso de horario (en 24 h), recorriendo la lista hacia abajo. */
async function horasEnLaApp(apk: Apk): Promise<string[]> {
  const vistas = new Set<string>();
  for (let i = 0; i < 6; i++) {
    const antes = vistas.size;
    for (const n of await apk.nodos()) if (HORA_APP.test(n.texto)) vistas.add(a24h(n.texto));
    if (i > 0 && vistas.size === antes) break;
    apk.deslizar();
  }
  for (let i = 0; i < 6; i++) apk.adb(["shell", "input", "swipe", "540", "900", "540", "1700", "300"]);

  return [...vistas].sort();
}

/** Deja a la vista la zona de la hora probada (con sus vecinas) para la captura. */
async function mostrarZona(apk: Apk, referencia: string) {
  for (let i = 0; i < 6 && !(await apk.hay(referencia)); i++) {
    apk.adb(["shell", "input", "swipe", "540", "1500", "540", "1100", "300"]);
  }
}

async function capturaApk(apk: Apk, testInfo: TestInfo, nombre: string) {
  const ruta = testInfo.outputPath(`${nombre}.png`);
  apk.captura(ruta);
  await testInfo.attach(nombre, { path: ruta, contentType: "image/png" });
}

test("T093: la disponibilidad no ofrece horarios ocupados (RF-09)", async ({ request }, testInfo) => {
  const cliente = { email: process.env.HUMO_EMAIL ?? "", password: process.env.HUMO_PASSWORD ?? "" };
  const personal = { email: process.env.HUMO_STAFF_EMAIL ?? "", password: process.env.HUMO_STAFF_PASSWORD ?? "" };
  let apk: Apk | undefined;
  let tokenCliente = "";
  let tokenPersonal = "";
  let codigo = "";
  let barbero1 = { id: "", nombre: "" };
  let barberoLibre = { id: "", nombre: "" };
  let servicio = { id: "", nombre: "" };
  const datos: Record<string, unknown> = {};

  try {
    await paso("0", async () => {
      if (process.env.HUMO_PERMITIR_RESERVA !== "1") {
        throw new Error("DETENIDO en el paso 0: la precondición crea una cita real. Usa HUMO_PERMITIR_RESERVA=1.");
      }
      expect(cliente.email && personal.email, "Faltan las cuentas de cliente y de personal").toBeTruthy();
      const lista = async (ruta: string) =>
        ((await (await request.get(`${API_URL}/api/v1/${ruta}`, { headers: { Accept: "application/json" } })).json()).data) as {
          id: string; nombre?: string; user?: { name?: string };
        }[];
      const barberos = await lista("barbers");
      const servicios = await lista("services");
      const b1 = barberos.find((b) => b.user?.name === BARBERO_1);
      const bl = barberos.find((b) => b.user?.name === BARBERO_LIBRE);
      const sv = servicios.find((s) => s.nombre === SERVICIO);
      expect(b1, `existe el barbero 1 «${BARBERO_1}»`).toBeTruthy();
      expect(bl, `existe el barbero libre «${BARBERO_LIBRE}»`).toBeTruthy();
      expect(sv, `existe el servicio «${SERVICIO}»`).toBeTruthy();
      barbero1 = { id: b1!.id, nombre: BARBERO_1 };
      barberoLibre = { id: bl!.id, nombre: BARBERO_LIBRE };
      servicio = { id: sv!.id, nombre: SERVICIO };
      // Antes de la precondición, las dos agendas deben tener libre la hora y sus vecinas: si no, el dato no sirve.
      for (const b of [barbero1, barberoLibre]) {
        const horas = await horasEnApi(request, b.id, servicio.id);
        for (const h of [HORA, ...vecinas(HORA)]) expect(horas, `${b.nombre} debe tener ${h} libre antes de empezar`).toContain(h);
      }
      apk = Apk.elegirEmulador();
      apk.mantenerDespierto();
      Object.assign(datos, { entorno: LOCAL ? "local (ensayo)" : "staging", api: API_URL, fecha: FECHA, hora: HORA, servicio: SERVICIO, barbero1: BARBERO_1, barberoLibre: BARBERO_LIBRE, emulador: `${apk.nombreDelEmulador()} (${apk.serie})` });

      return `${datos.entorno} · ${SERVICIO} · ${FECHA} ${HORA} · barbero 1: ${BARBERO_1} · barbero libre: ${BARBERO_LIBRE}`;
    });

    await paso("P", async () => {
      tokenCliente = await iniciarSesion(request, cliente.email, cliente.password);
      tokenPersonal = await iniciarSesion(request, personal.email, personal.password);
      const reserva = await request.post(`${API_URL}/api/v1/appointments`, {
        headers: conToken(tokenCliente),
        data: { barber_id: barbero1.id, service_id: servicio.id, fecha: FECHA, hora_inicio: HORA, acepta_cargo_inasistencia: true },
      });
      expect(reserva.status(), `la API debe crear la cita de la precondición (respondió: ${(await reserva.text()).slice(0, 160)})`).toBe(201);
      codigo = (await reserva.json()).data.code;
      const aprobada = await request.patch(`${API_URL}/api/v1/appointments/${codigo}/status`, {
        headers: conToken(tokenPersonal),
        data: { estado: "confirmada" },
      });
      expect(aprobada.status(), "recepción debe poder confirmarla").toBe(200);
      const citas = (await (await request.get(`${API_URL}/api/v1/appointments`, { headers: conToken(tokenCliente) })).json()).data as { code: string; estado: string }[];
      expect(citas.find((c) => c.code === codigo)?.estado, "la cita debe estar confirmada").toBe("confirmada");

      return `Cita ${codigo}: ${BARBERO_1}, ${FECHA} a las ${HORA}, «confirmada»`;
    });

    await paso("1a", async () => {
      const horas = await horasEnApi(request, barbero1.id, servicio.id);
      datos.horasApiBarbero1 = horas;
      expect(horas, `la API no debe ofrecer ${HORA} al barbero 1`).not.toContain(HORA);
      for (const h of vecinas(HORA)) expect(horas, `la API sí ofrece ${h}`).toContain(h);

      return `${horas.length} horarios; ${HORA} no está; ${vecinas(HORA).join(" y ")} sí`;
    });

    await paso("1b", async () => {
      apk!.instalar(APK_RUTA);
      if (LOCAL) apk!.adb(["reverse", "tcp:8000", "tcp:8000"]);
      await apk!.abrirLimpia("Iniciar sesión");
      await apk!.tocar("Iniciar sesión");
      await apk!.esperar("Entrar a UrbanBlade");
      await apk!.escribir(0, cliente.email, "el correo del cliente");
      await apk!.escribir(1, cliente.password, "la contraseña del cliente", { oculto: true });
      await apk!.tocar("Entrar a UrbanBlade");
      await apk!.tocar("Mis citas", 60);
      // «Reservar» aparece en el encabezado de Mis citas y en la barra de abajo: se toca el botón de arriba.
      const reservar = (await apk!.nodos()).filter((n) => n.texto === "Reservar").sort((a, b) => a.y - b.y)[0];
      expect(reservar, "Mis citas debe ofrecer «Reservar»").toBeTruthy();
      apk!.adb(["shell", "input", "tap", String(reservar!.x), String(reservar!.y)]);
      await apk!.tocar(SERVICIO, 45);
      await apk!.tocar("Elegir horario");
      await apk!.tocar(BARBERO_1.split(" ")[0]!, 45);
      await apk!.tocar(String(Number(FECHA.slice(8, 10))));
      await apk!.esperar(HORA_APP, 45);
      const horas = await horasEnLaApp(apk!);
      datos.horasAppBarbero1 = horas;
      await mostrarZona(apk!, aEtiquetaApp(vecinas(HORA)[1]!));
      await capturaApk(apk!, testInfo, "1b-apk-barbero-1-sin-12");
      expect(horas, `la app no debe ofrecer ${HORA} al barbero 1`).not.toContain(HORA);
      for (const h of vecinas(HORA)) expect(horas, `la app sí muestra ${h}`).toContain(h);

      return `La app muestra ${horas.length} horas para ${BARBERO_1}; ${aEtiquetaApp(HORA)} no está; ${vecinas(HORA).map(aEtiquetaApp).join(" y ")} sí`;
    });

    await paso("2a", async () => {
      const horas = await horasEnApi(request, barberoLibre.id, servicio.id);
      datos.horasApiBarberoLibre = horas;
      expect(horas, `la API debe ofrecer ${HORA} al barbero libre`).toContain(HORA);

      return `${horas.length} horarios; ${HORA} sí está`;
    });

    await paso("2b", async () => {
      await apk!.tocar(BARBERO_LIBRE.split(" ")[0]!);
      await apk!.esperar(HORA_APP, 45);
      const horas = await horasEnLaApp(apk!);
      datos.horasAppBarberoLibre = horas;
      await mostrarZona(apk!, aEtiquetaApp(HORA));
      await capturaApk(apk!, testInfo, "2b-apk-barbero-libre-con-12");
      expect(horas, `la app debe ofrecer ${HORA} al barbero libre`).toContain(HORA);

      return `La app muestra ${horas.length} horas para ${BARBERO_LIBRE}; ${aEtiquetaApp(HORA)} sí está`;
    });
  } finally {
    const limpieza: string[] = [];
    // La cancela recepción: el cliente no puede cancelar con menos de 24 h de anticipación (política del negocio).
    if (codigo && tokenPersonal) {
      const r = await request
        .patch(`${API_URL}/api/v1/appointments/${codigo}/status`, { headers: conToken(tokenPersonal), data: { estado: "cancelada" } })
        .catch(() => null);
      limpieza.push(`Cita ${codigo} cancelada por recepción al terminar: ${r ? r.status() : "sin respuesta"}`);
    }
    for (const token of [tokenPersonal, tokenCliente].filter(Boolean)) {
      await request.post(`${API_URL}/api/v1/auth/logout`, { headers: conToken(token) }).catch(() => null);
    }
    const fallo = PASOS.find((p) => p.resultado !== "pasó" && p.resultado !== "no se ejecutó");
    const veredicto = !fallo
      ? `PASA: ${HORA} no aparece para el barbero 1 (cita confirmada) y sí para el barbero libre, en la API y en la app.`
      : `NO PASA: falló el paso ${fallo.n} (${fallo.titulo}): ${fallo.detalle}`;
    const md = [
      `# Acta T093 (HT-43) — La disponibilidad no ofrece horarios ocupados — ${new Date().toISOString()}`,
      "",
      ...Object.entries(datos).filter(([, v]) => !Array.isArray(v)).map(([k, v]) => `- ${k}: ${String(v)}`),
      "",
      "| # | Dónde | Paso | Resultado esperado | Resultado | Detalle |",
      "|---|---|---|---|---|---|",
      ...PASOS.map((p) => `| ${p.n} | ${p.donde} | ${p.titulo} | ${p.esperado} | ${p.resultado} | ${p.detalle.replace(/\|/g, "/")} |`),
      "",
      ...limpieza.map((l) => `- Limpieza: ${l}`),
      "",
      `**Veredicto:** ${veredicto}`,
    ].join("\n");
    writeFileSync(testInfo.outputPath("acta-T093.md"), md);
    writeFileSync(testInfo.outputPath("datos-T093.json"), JSON.stringify({ ...datos, codigo, pasos: PASOS, limpieza, veredicto }, null, 2));
    await testInfo.attach("acta-T093.md", { path: testInfo.outputPath("acta-T093.md"), contentType: "text/markdown" });
    console.log(`\n${md}\n`);
  }
});
