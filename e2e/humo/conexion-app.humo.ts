import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { expect, test, type APIRequestContext, type Browser, type TestInfo } from "@playwright/test";

import { Apk } from "./apk";

/*
 * T108 (HT-42): «App sin conexión y con conexión lenta». Prueba de aceptación operativa del módulo «App · conexión»,
 * con enfoque de caja negra, para RNF-09 (Aviso al usuario ante fallas).
 *
 * Precondición: emulador con perfil de red lento (consola del emulador: «network speed» y «network delay»).
 *   1. Activar modo avión y reservar: la app avisa que no hay conexión y permite reintentar.
 *      (a) Abrir «Reservar» sin red y reintentar con red. (b) Confirmar la reserva sin red y reintentar con red.
 *   2. Repetir con red lenta y reintentar: al reintentar no se duplican reservas.
 *      La reserva sale con la red lenta; en cuanto el servidor ya la registró (se consulta la API), se corta la red,
 *      así que la respuesta no le llega a la app. Con la red de vuelta (aún lenta) se reintenta.
 *   Complementaria: con la red lenta, dos toques seguidos en «Reservar cita» no crean dos citas.
 *
 * Crea reservas reales en staging (pago en el salón, días lejanos): exige HUMO_PERMITIR_RESERVA=1. Al terminar cancela
 * todas las que la prueba creó y deja la red del emulador normal.
 */

const API_URL = process.env.HUMO_API_URL ?? "https://api.urbanblade.com.mx";
const APK_RUTA = resolve(process.env.HUMO_APK ?? "../documentacion/HT-46/T075/apk/UrbanBlade-staging-main-095f168.apk");
const PERMITIR = process.env.HUMO_PERMITIR_RESERVA === "1";
const EMAIL = process.env.HUMO_EMAIL ?? "";
const CLAVE = process.env.HUMO_PASSWORD ?? "";
// Perfil de red lento del emulador: EDGE (≈ 118 kbps de subida, 236 de bajada) con 4 s de latencia por paquete.
const RED_LENTA = { velocidad: "edge", latencia: "4000" };
const SIN_CONEXION = /Sin conexión|sin conexión|conexión|Revisa tu red/i;
const RESERVADA = /reservada|Reservaste|Cita confirmada|¡Listo/i;
const UNA_POR_DIA = /una cita por día|Ya tienes una cita/i;
const JSON_HEADERS = { Accept: "application/json" };
// HUMO_PASOS elige qué acciones correr (por ejemplo «2,2c» para repetir solo la red lenta); por omisión, todas.
const PASOS_ELEGIDOS = (process.env.HUMO_PASOS ?? "1a,1b,2,2c").split(",").map((s) => s.trim());
const corre = (n: string) => PASOS_ELEGIDOS.includes(n);

type Resultado = "pasó" | "falló" | "no se ejecutó" | "observación" | "omitido";
interface Paso { n: string; titulo: string; esperado: string; resultado: Resultado; detalle: string }
const PASOS: Paso[] = [];
const nuevoPaso = (n: string, titulo: string, esperado: string) => PASOS.push({ n, titulo, esperado, resultado: "no se ejecutó", detalle: "" });
nuevoPaso("0", "Entorno: API, app y consola de red del emulador", "Responden");
nuevoPaso("P", "Precondición: emulador con perfil de red lento y días libres", "La red del emulador se puede poner lenta; el cliente no tiene citas esos días");
nuevoPaso("1a", "Modo avión: abrir «Reservar» y reintentar con red", "Avisa que no hay conexión y permite reintentar");
nuevoPaso("1b", "Modo avión: confirmar la reserva y reintentar con red", "Avisa que no hay conexión, permite reintentar y al reintentar queda una sola cita");
nuevoPaso("2", "Red lenta: la conexión se corta cuando el servidor ya registró la cita; se reintenta", "Al reintentar no se duplica la reserva");
nuevoPaso("2c", "Complementaria: red lenta y dos toques seguidos en «Reservar cita»", "Una sola cita");
nuevoPaso("R", "Cancelar las citas de la prueba y dejar la red normal", "Todas canceladas; red normal");

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

// ---------------------------------------------------------------- Red del emulador ----------------------------------------------------------------

function red(apk: Apk, velocidad: string, latencia: string) {
  apk.adb(["emu", "network", "speed", velocidad]);
  apk.adb(["emu", "network", "delay", latencia]);
  return apk.adb(["emu", "network", "status"]).replace(/\r/g, "").split("\n").filter((l) => /speed|latency/.test(l)).map((l) => l.trim()).join(" · ");
}

function modoAvion(apk: Apk, activo: boolean) {
  apk.adb(["shell", "cmd", "connectivity", "airplane-mode", activo ? "enable" : "disable"]);
}

/** Espera a que Android vuelva a tener una red por defecto (después de quitar el modo avión). */
async function esperarRed(apk: Apk, segundos = 60) {
  const limite = Date.now() + segundos * 1000;
  while (Date.now() < limite) {
    if (/Active default network: \d+/.test(apk.adb(["shell", "dumpsys", "connectivity"]))) return;
    await pausa(1500);
  }
  throw new Error("El emulador no recuperó la red");
}

// ---------------------------------------------------------------- API ----------------------------------------------------------------

interface Cita { code: string; fecha: string; hora_inicio: string; estado: string }

async function citasDelCliente(request: APIRequestContext, token: string): Promise<Cita[]> {
  const r = await request.get(`${API_URL}/api/v1/appointments?per_page=100`, { headers: { ...JSON_HEADERS, Authorization: `Bearer ${token}` } });
  expect(r.status(), "GET /appointments debe responder 200").toBe(200);
  return (((await r.json()) as { data?: Cita[] }).data ?? []).map((c) => ({ ...c, fecha: String(c.fecha).slice(0, 10) }));
}

const activasDelDia = (citas: Cita[], fecha: string) => citas.filter((c) => c.fecha === fecha && c.estado !== "cancelada");

// ---------------------------------------------------------------- App ----------------------------------------------------------------

async function captura(apk: Apk, browser: Browser, testInfo: TestInfo, archivo: string) {
  const ruta = testInfo.outputPath(archivo);
  const nodos = await apk.nodos();
  apk.captura(ruta);
  const zonas = nodos.filter((n) => /[\w.+-]+@[\w-]+\.[\w.-]+/.test(n.texto + n.descripcion)).map((n) => ({ x1: n.izquierda, y1: n.arriba, x2: n.derecha, y2: n.abajo }));
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

async function textos(apk: Apk) {
  return [...new Set((await apk.nodos()).flatMap((n) => [n.texto, n.descripcion]).filter(Boolean))];
}

async function entrar(apk: Apk) {
  await apk.abrirLimpia("Iniciar sesión");
  await apk.tocar("Iniciar sesión");
  await apk.esperar("Entrar a UrbanBlade");
  await apk.escribir(0, EMAIL, "el correo de la cuenta");
  await apk.escribir(1, CLAVE, "la contraseña", { oculto: true });
  await apk.tocar("Entrar a UrbanBlade");
  await apk.esperar("Mis citas", 90);
  await apk.esperar("Inicio", 30);
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** Recorre la reserva hasta el paso de pago: primer servicio, el barbero, el día y la hora pedidos, sin extras, efectivo y la política aceptada. */
async function hastaElPago(apk: Apk, fecha: string, hora: string, segundos = 60) {
  await apk.tocar("Reservar", segundos);
  await apk.esperar(/^Afeitado Clásico$/, segundos);
  // La lista de servicios se acomoda unos instantes al cargar: un toque temprano puede caer en un filtro de arriba.
  // Se espera a que se asiente, se toca el servicio y, si no avanza al horario, se vuelve a tocar.
  let enHorario = false;
  for (let i = 0; i < 3 && !enHorario; i++) {
    await pausa(2000);
    const servicio = await apk.buscar(/^Afeitado Clásico$/);
    if (servicio) apk.adb(["shell", "input", "tap", String(servicio.x), String(servicio.y)]);
    enHorario = await apk.esperar("DÍA", i < 2 ? 20 : segundos).then(() => true, () => false);
  }
  if (!enHorario) throw new Error("La app no pasó al paso del horario («DÍA») al tocar el servicio.");
  // El día: se desliza la fila de días hasta verlo (los días van del de hoy hasta unas semanas adelante).
  const dia = String(Number(fecha.slice(8, 10)));
  for (let i = 0; i < 8; i++) {
    const nodos = await apk.nodos();
    const fila = nodos.find((n) => n.texto === "DÍA");
    const chip = nodos.find((n) => n.texto === dia && fila && n.arriba > fila.abajo && n.arriba < fila.abajo + 300);
    if (chip) {
      apk.adb(["shell", "input", "tap", String(chip.x), String(chip.y)]);
      break;
    }
    const y = (fila?.abajo ?? 1100) + 90;
    apk.adb(["shell", "input", "swipe", "950", String(y), "200", String(y), "400"]);
    await pausa(1200);
  }
  await apk.tocar(hora, segundos);
  await apk.tocar("Elegir extras", segundos);
  await apk.tocar("Continuar sin extras", segundos);
  await apk.esperar("Revisa y reserva", segundos);
  // Efectivo («En el salón») viene elegido; se baja hasta la política de inasistencia y se acepta.
  for (let i = 0; i < 4 && !(await apk.hay(/^Acepto el cargo por inasistencia/)); i++) {
    apk.deslizar();
    await pausa(1200);
  }
  await apk.tocar("Efectivo", segundos);
  await apk.tocar(/^Acepto el cargo por inasistencia/, segundos);
  const resumen = `${Number(fecha.slice(8, 10))} de ${MESES[Number(fecha.slice(5, 7)) - 1]}`;
  return resumen;
}

/** Espera el resultado de tocar «Reservar cita»: éxito, sin conexión u otro mensaje. */
async function resultadoDeReservar(apk: Apk, segundos: number) {
  const limite = Date.now() + segundos * 1000;
  while (Date.now() < limite) {
    const t = await textos(apk);
    const exito = t.find((x) => RESERVADA.test(x));
    if (exito) return { tipo: "reservada" as const, texto: exito };
    const sin = t.find((x) => SIN_CONEXION.test(x) && !/^Acepto/.test(x));
    if (sin) return { tipo: "sin-conexion" as const, texto: sin };
    const una = t.find((x) => UNA_POR_DIA.test(x));
    if (una) return { tipo: "una-por-dia" as const, texto: una };
    await pausa(1000);
  }
  return { tipo: "nada" as const, texto: "" };
}

// ---------------------------------------------------------------- Prueba ----------------------------------------------------------------

test("T108: app sin conexión y con conexión lenta (RNF-09)", async ({ request, browser }, testInfo) => {
  test.setTimeout(60 * 60_000);
  test.skip(!PERMITIR, "Crea reservas reales en staging: se corre solo con HUMO_PERMITIR_RESERVA=1.");
  expect(EMAIL && CLAVE, "la cuenta del cliente (HUMO_EMAIL y HUMO_PASSWORD)").toBeTruthy();
  const datos: Record<string, unknown> = { entorno: "staging", api: API_URL };
  let apk: Apk | undefined;
  let token = "";
  const fechas: Record<string, { fecha: string; hora: string }> = {};

  try {
    await paso("0", async () => {
      const api = await request.get(`${API_URL}/api/v1/services`, { headers: JSON_HEADERS });
      expect(api.status(), "la API debe responder").toBe(200);
      apk = Apk.elegirEmulador();
      apk.mantenerDespierto();
      apk.adb(["shell", "settings", "put", "secure", "stylus_handwriting_enabled", "0"]);
      modoAvion(apk, false);
      datos.redNormal = red(apk, "full", "none");
      datos.apk = `${APK_RUTA.split(/[\\/]/).pop()} (SHA-256 ${apk.instalar(APK_RUTA)})`;
      datos.emulador = `${apk.nombreDelEmulador()} (${apk.serie})`;
      const r = await request.post(`${API_URL}/api/v1/auth/login`, { headers: JSON_HEADERS, data: { email: EMAIL, password: CLAVE, device_name: "QA T108" } });
      expect(r.status(), "la cuenta debe iniciar sesión en la API").toBe(200);
      token = ((await r.json()) as { token: string }).token;

      return `API ${api.status()} · app ${String(datos.apk)} · red normal: ${String(datos.redNormal)}`;
    });

    await paso("P", async () => {
      expect(apk, "sin emulador").toBeTruthy();
      datos.redLenta = red(apk!, RED_LENTA.velocidad, RED_LENTA.latencia);
      expect(String(datos.redLenta), "la consola debe aceptar el perfil lento").toMatch(/latency:\s+4000 ms/);
      red(apk!, "full", "none");
      // Tres días lejanos con horarios libres para el primer servicio y su barbero, y sin citas del cliente.
      const servicios = (await request.get(`${API_URL}/api/v1/services`, { headers: JSON_HEADERS }).then((x) => x.json())) as { data?: { id: string; nombre: string }[] };
      const servicio = (servicios.data ?? []).find((s) => s.nombre === "Afeitado Clásico");
      const barberos = (await request.get(`${API_URL}/api/v1/barbers`, { headers: JSON_HEADERS }).then((x) => x.json())) as { data?: { id: string }[] };
      expect(servicio && barberos.data?.[0], "debe existir «Afeitado Clásico» y su barbero").toBeTruthy();
      const citas = await citasDelCliente(request, token);
      const candidatos: { fecha: string; hora: string }[] = [];
      for (let d = 22; d >= 8 && candidatos.length < 3; d--) {
        const f = new Date(Date.now() + d * 86_400_000);
        const fecha = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" }).format(f);
        if (activasDelDia(citas, fecha).length) continue;
        const s = await request.get(`${API_URL}/api/v1/availability/slots?barber_id=${barberos.data![0]!.id}&service_id=${servicio!.id}&date=${fecha}`, { headers: { ...JSON_HEADERS, Authorization: `Bearer ${token}` } });
        const slots = (((await s.json()) as { slots?: { time: string; label: string }[] }).slots ?? []);
        if (slots.length) candidatos.push({ fecha, hora: slots[0]!.label });
      }
      expect(candidatos.length, "debe haber 3 días lejanos libres").toBe(3);
      fechas["1b"] = candidatos[0]!;
      fechas["2"] = candidatos[1]!;
      fechas["2c"] = candidatos[2]!;
      datos.fechas = fechas;

      return `Perfil lento aceptado (${String(datos.redLenta)}). Días: 1b ${candidatos[0]!.fecha} ${candidatos[0]!.hora} · 2 ${candidatos[1]!.fecha} ${candidatos[1]!.hora} · 2c ${candidatos[2]!.fecha} ${candidatos[2]!.hora}`;
    });

    for (const n of ["1a", "1b", "2", "2c"]) {
      if (!corre(n)) Object.assign(PASOS.find((p) => p.n === n)!, { resultado: "omitido", detalle: "No se eligió en esta corrida (HUMO_PASOS)" });
    }

    // ======================= Acción 1: modo avión =======================
    if (corre("1a")) await paso("1a", async () => {
      await entrar(apk!);
      modoAvion(apk!, true);
      await pausa(3000);
      await apk!.tocar("Reservar");
      await apk!.esperar(SIN_CONEXION, 60).catch(() => undefined);
      await pausa(1500);
      const t = await textos(apk!);
      await captura(apk!, browser, testInfo, "1a-1-reservar-sin-conexion.png");
      const reintentar = t.find((x) => /^Reintentar/.test(x));
      datos.accion1a = { textos: t.filter((x) => SIN_CONEXION.test(x) || /Reintentar|No pudimos|error/i.test(x)) };
      expect(t.some((x) => SIN_CONEXION.test(x)), `debe avisar que no hay conexión (textos: ${t.slice(0, 12).join(" | ")})`).toBe(true);
      expect(reintentar, "debe ofrecer «Reintentar»").toBeTruthy();
      modoAvion(apk!, false);
      await esperarRed(apk!);
      await apk!.tocar(reintentar!);
      await apk!.esperar(/^Afeitado Clásico$/, 60);
      await captura(apk!, browser, testInfo, "1a-2-reintentar-con-red.png");

      return `Sin red, «Reservar» muestra «${t.find((x) => SIN_CONEXION.test(x))}» y «${reintentar}»; con la red de vuelta, «${reintentar}» carga los servicios`;
    });

    if (corre("1b")) await paso("1b", async () => {
      const { fecha, hora } = fechas["1b"]!;
      await entrar(apk!);
      await hastaElPago(apk!, fecha, hora);
      await captura(apk!, browser, testInfo, "1b-1-listo-para-reservar.png");
      modoAvion(apk!, true);
      await pausa(3000);
      await apk!.tocar("Reservar cita");
      const primero = await resultadoDeReservar(apk!, 60);
      await captura(apk!, browser, testInfo, "1b-2-reservar-sin-conexion.png");
      const sinRed = await citasDelCliente(request, token);
      expect(primero.tipo, `sin red debe avisar que no hay conexión (vio: ${primero.tipo} «${primero.texto}»)`).toBe("sin-conexion");
      expect(activasDelDia(sinRed, fecha).length, "sin red no debe crearse la cita").toBe(0);
      expect(await apk!.hay("Reservar cita"), "debe seguir el botón para reintentar").toBe(true);
      modoAvion(apk!, false);
      await esperarRed(apk!);
      await apk!.tocar("Reservar cita");
      const segundo = await resultadoDeReservar(apk!, 90);
      await pausa(1500);
      await captura(apk!, browser, testInfo, "1b-3-reintentar-con-red.png");
      const despues = activasDelDia(await citasDelCliente(request, token), fecha);
      datos.accion1b = { sinRed: primero, alReintentar: segundo, citasDelDia: despues.map((c) => `${c.code} ${c.hora_inicio} ${c.estado}`) };
      expect(segundo.tipo, `al reintentar con red debe reservarse (vio: ${segundo.tipo} «${segundo.texto}»)`).toBe("reservada");
      expect(despues.length, "debe quedar una sola cita ese día").toBe(1);

      return `Sin red: «${primero.texto}» y no se crea nada. Al reintentar con red: «${segundo.texto}»; una sola cita (${despues[0]!.code})`;
    });

    // ======================= Acción 2: red lenta y reintento =======================
    if (corre("2")) await paso("2", async () => {
      const { fecha, hora } = fechas["2"]!;
      await entrar(apk!);
      datos.redAccion2 = red(apk!, RED_LENTA.velocidad, RED_LENTA.latencia);
      await hastaElPago(apk!, fecha, hora, 180);
      await captura(apk!, browser, testInfo, "2-1-red-lenta-listo-para-reservar.png");
      const inicio = Date.now();
      await apk!.tocar("Reservar cita");
      // En cuanto el servidor registra la cita, se corta la red: la respuesta (con 4 s de latencia) no le llega a la app.
      let registradaEn = 0;
      while (Date.now() - inicio < 180_000) {
        if (activasDelDia(await citasDelCliente(request, token), fecha).length) {
          modoAvion(apk!, true);
          registradaEn = Date.now() - inicio;
          break;
        }
        await pausa(400);
      }
      expect(registradaEn, "el servidor debe registrar la cita con la red lenta").toBeGreaterThan(0);
      const primero = await resultadoDeReservar(apk!, 120);
      await captura(apk!, browser, testInfo, "2-2-respuesta-perdida.png");
      modoAvion(apk!, false);
      await esperarRed(apk!);
      let segundo: Awaited<ReturnType<typeof resultadoDeReservar>> = { tipo: "nada", texto: "" };
      if (primero.tipo !== "reservada" && (await apk!.hay("Reservar cita"))) {
        // Reintento, con la red aún lenta.
        await apk!.tocar("Reservar cita", 60);
        segundo = await resultadoDeReservar(apk!, 180);
        await pausa(1500);
        await captura(apk!, browser, testInfo, "2-3-reintento-con-red-lenta.png");
      }
      red(apk!, "full", "none");
      const despues = activasDelDia(await citasDelCliente(request, token), fecha);
      datos.accion2 = { registradaEnMs: registradaEn, primerIntento: primero, reintento: segundo, citasDelDia: despues.map((c) => `${c.code} ${c.hora_inicio} ${c.estado}`) };
      expect(despues.length, `al reintentar no deben duplicarse las reservas (citas del día: ${despues.length})`).toBe(1);
      if (primero.tipo === "reservada") PASOS.find((p) => p.n === "2")!.resultado = "observación";
      if (segundo.tipo !== "reservada") PASOS.find((p) => p.n === "2")!.resultado = "observación";

      return primero.tipo === "reservada"
        ? `La respuesta alcanzó a llegar antes del corte («${primero.texto}»): no hubo nada que reintentar; una sola cita`
        : `El servidor registró la cita a los ${(registradaEn / 1000).toFixed(1)} s y se cortó la red: la app mostró «${primero.texto || "(nada)"}». Al reintentar con la red lenta: «${segundo.texto || "(nada)"}». En el servidor hay una sola cita ese día (${despues[0]!.code})`;
    });

    if (corre("2c")) await paso("2c", async () => {
      const { fecha, hora } = fechas["2c"]!;
      await entrar(apk!);
      red(apk!, RED_LENTA.velocidad, RED_LENTA.latencia);
      await hastaElPago(apk!, fecha, hora, 180);
      const boton = (await apk!.nodos()).find((n) => n.texto === "Reservar cita")!;
      // Dos toques seguidos, como alguien impaciente con la red lenta.
      apk!.adb(["shell", "input", "tap", String(boton.x), String(boton.y)]);
      await pausa(700);
      apk!.adb(["shell", "input", "tap", String(boton.x), String(boton.y)]);
      const r = await resultadoDeReservar(apk!, 240);
      await pausa(1500);
      await captura(apk!, browser, testInfo, "2c-1-doble-toque-red-lenta.png");
      red(apk!, "full", "none");
      await pausa(5000);
      const despues = activasDelDia(await citasDelCliente(request, token), fecha);
      datos.accion2c = { resultado: r, citasDelDia: despues.map((c) => `${c.code} ${c.hora_inicio} ${c.estado}`) };
      expect(despues.length, "dos toques no deben crear dos citas").toBe(1);

      return `Con dos toques seguidos y la red lenta: «${r.texto || r.tipo}»; una sola cita (${despues[0]?.code ?? "—"})`;
    });
  } finally {
    await paso("R", async () => {
      if (apk) {
        modoAvion(apk, false);
        red(apk, "full", "none");
      }
      expect(token, "sin sesión no hay qué cancelar").toBeTruthy();
      const nuestras = (await citasDelCliente(request, token)).filter((c) => Object.values(fechas).some((f) => f.fecha === c.fecha) && c.estado !== "cancelada");
      const canceladas: string[] = [];
      for (const c of nuestras) {
        // Como lo hace la app: el cliente cancela su cita con DELETE /appointments/{código}.
        const r = await request.delete(`${API_URL}/api/v1/appointments/${c.code}`, { headers: { ...JSON_HEADERS, Authorization: `Bearer ${token}` } });
        expect(r.status(), `cancelar ${c.code} debe responder 200`).toBe(200);
        canceladas.push(`${c.code} (${c.fecha} ${c.hora_inicio})`);
      }
      const quedan = (await citasDelCliente(request, token)).filter((c) => Object.values(fechas).some((f) => f.fecha === c.fecha) && c.estado !== "cancelada");
      datos.canceladas = canceladas;
      expect(quedan.length, "no deben quedar citas activas de la prueba").toBe(0);
      await request.post(`${API_URL}/api/v1/auth/logout`, { headers: { ...JSON_HEADERS, Authorization: `Bearer ${token}` } }).catch(() => {});

      return `${canceladas.length} cita(s) cancelada(s): ${canceladas.join(", ") || "ninguna"}; red del emulador normal y sin modo avión`;
    });

    const fallidos = PASOS.filter((p) => p.resultado === "falló" && p.n !== "R");
    const veredicto = fallidos.length
      ? `FALLIDA: falló ${fallidos.map((p) => p.n).join(", ")}.`
      : PASOS.some((p) => p.resultado === "no se ejecutó")
        ? "INCOMPLETA: hay pasos sin correr."
        : PASOS.some((p) => p.resultado === "omitido")
          ? `SIN FALLAS en lo que se corrió (${PASOS.filter((p) => p.resultado !== "omitido" && /^\d/.test(p.n)).map((p) => p.n).join(", ")}); omitidas en esta corrida: ${PASOS.filter((p) => p.resultado === "omitido").map((p) => p.n).join(", ")}.`
          : "APROBADA: la app avisa que no hay conexión y permite reintentar; al reintentar con red lenta no se duplican las reservas.";
    const md = [
      `# Acta T108 (HT-42) — App sin conexión y con conexión lenta — ${new Date().toISOString()}`,
      "",
      ...Object.entries(datos).filter(([, v]) => typeof v === "string").map(([k, v]) => `- ${k}: ${String(v)}`),
      "",
      "| # | Paso | Resultado esperado | Resultado | Detalle |",
      "|---|---|---|---|---|",
      ...PASOS.map((p) => `| ${p.n} | ${p.titulo} | ${p.esperado} | ${p.resultado} | ${p.detalle.replace(/\|/g, "/")} |`),
      "",
      `**Veredicto (staging):** ${veredicto}`,
    ].join("\n");
    writeFileSync(testInfo.outputPath("acta-T108.md"), md);
    writeFileSync(testInfo.outputPath("datos-T108.json"), JSON.stringify({ ...datos, pasos: PASOS, veredicto }, null, 2));
    await testInfo.attach("acta-T108.md", { path: testInfo.outputPath("acta-T108.md"), contentType: "text/markdown" });
    console.log(`\n${md}\n`);
  }

  expect(PASOS.filter((p) => p.resultado === "falló").map((p) => `${p.n}: ${p.detalle}`), "pasos que fallaron").toEqual([]);
});
