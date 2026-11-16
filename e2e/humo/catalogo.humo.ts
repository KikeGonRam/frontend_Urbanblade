import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { expect, test, type APIRequestContext, type TestInfo } from "@playwright/test";

import { Apk, type Nodo } from "./apk";

/*
 * T093 (HT-43): «Servicios y barberos visibles para el cliente». Prueba de integración de sistemas del módulo «Servicios y
 * barberos», con enfoque de caja negra, para RF-04 (Consulta de servicios) y RF-06 (Consulta de barberos).
 *
 * La app se usa como invitado («Ver servicios sin iniciar sesión»): se recorre el catálogo completo de arriba abajo y se
 * lee lo que muestra cada tarjeta.
 *   1. Servicios: cada servicio muestra nombre, precio y duración iguales a la base, y no sobra ni falta ninguno.
 *   2. Barberos: el barbero inactivo no aparece (ni en la app ni en GET /barbers) y los activos sí.
 *
 * «La base» es el archivo HUMO_T093_BASE: un JSON leído de la base de datos con los servicios y los barberos, con su
 * estado. Sin ese archivo (staging, donde no hay acceso a la base) la referencia es la API real (GET /services y
 * GET /barbers). La acción 2 necesita un barbero inactivo (HUMO_T093_BARBERO_INACTIVO); si no hay, queda omitida y lo
 * dice el reporte. Esta prueba solo lee: no escribe nada en la API.
 */

const LOCAL = process.env.HUMO_ENTORNO === "local";
const API_URL = process.env.HUMO_API_URL ?? (LOCAL ? "http://127.0.0.1:8000" : "https://api.urbanblade.com.mx");
const APK_RUTA = resolve(
  process.env.HUMO_APK
    ?? (LOCAL
      ? "../documentacion/HT-46/T075/apk/UrbanBlade-debug-local-main-095f168.apk"
      : "../documentacion/HT-46/T075/apk/UrbanBlade-staging-main-095f168.apk"),
);
const BASE_RUTA = process.env.HUMO_T093_BASE;
const INACTIVO = process.env.HUMO_T093_BARBERO_INACTIVO ?? "";
const pausa = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Servicio { nombre: string; precio: number; duracion_min: number }
interface Barbero { nombre: string; activo: boolean }
interface Referencia { origen: string; servicios: Servicio[]; barberos: Barbero[] }
interface Pantalla { archivo: string; servicios: string[]; barberos: string[] }

type Resultado = "pasó" | "falló" | "omitido" | "no se ejecutó";
interface Paso { n: string; donde: string; titulo: string; esperado: string; resultado: Resultado; detalle: string }

const PASOS: Paso[] = [
  ["0", "—", "Entorno, app y referencia de la base", "—"],
  ["1a", "API", "Servicios de la API contra la base", "Mismos servicios, precios y duraciones"],
  ["1b", "APK", "Servicios en el catálogo de la app", "Cada servicio muestra nombre, precio y duración iguales a la base"],
  ["P", "Base", "Precondición: un barbero inactivo en los datos de prueba", "Existe y está inactivo"],
  ["2a", "API", "Barberos de la API", "El barbero inactivo no aparece; los activos sí"],
  ["2b", "APK", "Barberos en el catálogo de la app", "El barbero inactivo no aparece; los activos sí"],
].map(([n, donde, titulo, esperado]) => ({ n: n!, donde: donde!, titulo: titulo!, esperado: esperado!, resultado: "no se ejecutó", detalle: "" }));

async function paso(n: string, fn: () => Promise<string>) {
  const p = PASOS.find((x) => x.n === n)!;
  await test.step(`${n} · ${p.titulo}`, async () => {
    try {
      p.detalle = await fn();
      p.resultado = "pasó";
    } catch (error) {
      p.resultado = "falló";
      p.detalle = (error as Error).message.split("\n")[0]!;
      throw error;
    }
  });
}

function omitir(n: string, motivo: string) {
  const p = PASOS.find((x) => x.n === n)!;
  p.resultado = "omitido";
  p.detalle = motivo;
}

async function lista<T>(request: APIRequestContext, ruta: string): Promise<T[]> {
  // La API local a veces no resuelve el DNS de Atlas y responde 500: se reintenta.
  for (let intento = 0; intento < 5; intento++) {
    const r = await request.get(`${API_URL}/api/v1/${ruta}`, { headers: { Accept: "application/json" } });
    if (r.ok()) return (await r.json()).data as T[];
    await pausa(3000);
  }
  throw new Error(`GET /${ruta} no respondió después de 5 intentos.`);
}

const DURACION = /^(\d+) min$/;
const PRECIO = /^\$\s?[\d.,]+$/;
const aNumero = (precio: string) => Number(precio.replace(/[^\d]/g, ""));

/**
 * Las tarjetas de servicio que hay en pantalla. En cada tarjeta, el nombre va justo arriba de la duración («N min») y el
 * precio («$180») va debajo, antes de la duración de la tarjeta siguiente. Una tarjeta cortada por el borde de la pantalla
 * (sin precio a la vista) se lee en la pantalla siguiente.
 */
function serviciosEnPantalla(nodos: Nodo[]) {
  const conTexto = nodos.filter((n) => n.texto);
  // Arriba queda fijo el buscador con los filtros (hasta y ≈ 420): lo que pasa por debajo de esa franja se lee en la
  // pantalla anterior, cuando aún se veía completo.
  const duraciones = conTexto.filter((n) => DURACION.test(n.texto) && n.arriba >= 440).sort((a, b) => a.arriba - b.arriba);
  const tarjetas: { nombre: string; precio: number; duracion: number }[] = [];
  for (const [i, d] of duraciones.entries()) {
    const siguiente = duraciones[i + 1]?.arriba ?? Number.POSITIVE_INFINITY;
    const nombre = conTexto
      .filter((n) => n.arriba >= 420 && n.arriba <= d.arriba && d.arriba - n.arriba < 140 && n !== d && !DURACION.test(n.texto) && !PRECIO.test(n.texto))
      .sort((a, b) => b.arriba - a.arriba)[0];
    const precio = conTexto
      .filter((n) => PRECIO.test(n.texto) && n.arriba > d.arriba && n.arriba < siguiente && n.arriba - d.arriba < 450)
      .sort((a, b) => a.arriba - b.arriba)[0];
    if (nombre && precio) tarjetas.push({ nombre: nombre.texto, precio: aNumero(precio.texto), duracion: Number(d.texto.match(DURACION)![1]) });
  }

  return tarjetas;
}

/** Recorre el catálogo completo, de arriba abajo, con una captura por pantalla, hasta que la pantalla ya no se mueve. */
async function recorrerCatalogo(apk: Apk, testInfo: TestInfo, nombresDeBarberos: Set<string>) {
  const servicios = new Map<string, { precio: number; duracion: number }>();
  const barberos: string[] = [];
  const pantallas: Pantalla[] = [];
  let firmaAnterior = "";
  for (let i = 0; i < 80; i++) {
    const nodos = await apk.nodos();
    const firma = nodos.filter((n) => n.texto).map((n) => `${n.texto}@${n.y}`).join("|");
    if (firma === firmaAnterior) break;
    firmaAnterior = firma;
    const enPantalla = serviciosEnPantalla(nodos);
    for (const s of enPantalla) servicios.set(s.nombre, { precio: s.precio, duracion: s.duracion });
    const barberosEnPantalla = nodos.filter((n) => nombresDeBarberos.has(n.texto)).map((n) => n.texto);
    for (const b of barberosEnPantalla) if (!barberos.includes(b)) barberos.push(b);
    const archivo = `recorrido-${String(i + 1).padStart(2, "0")}.png`;
    apk.captura(testInfo.outputPath(archivo));
    pantallas.push({ archivo, servicios: enPantalla.map((s) => s.nombre), barberos: barberosEnPantalla });
    apk.adb(["shell", "input", "swipe", "540", "1750", "540", "950", "900"]);
    await pausa(900);
  }

  return { servicios, barberos, pantallas };
}

async function adjuntar(testInfo: TestInfo, archivo: string, nombre = archivo.replace(/\.png$/, "")) {
  await testInfo.attach(nombre, { path: testInfo.outputPath(archivo), contentType: "image/png" });
}

test("T093: servicios y barberos visibles para el cliente (RF-04 y RF-06)", async ({ request }, testInfo) => {
  test.setTimeout(30 * 60_000);
  let apk: Apk | undefined;
  let referencia: Referencia = { origen: "", servicios: [], barberos: [] };
  let recorrido: Awaited<ReturnType<typeof recorrerCatalogo>> | undefined;
  const datos: Record<string, unknown> = {};

  try {
    await paso("0", async () => {
      if (BASE_RUTA) {
        const archivo = JSON.parse(readFileSync(resolve(BASE_RUTA), "utf8")) as Omit<Referencia, "servicios"> & { servicios: (Servicio & { activo: boolean })[] };
        referencia = { origen: `base de datos (${archivo.origen})`, servicios: archivo.servicios.filter((s) => s.activo), barberos: archivo.barberos };
      } else {
        const servicios = await lista<{ nombre: string; precio: number; duracion_min: number }>(request, "services");
        const barberos = await lista<{ user?: { name?: string } }>(request, "barbers");
        referencia = {
          origen: "API real (sin acceso a la base en este entorno)",
          servicios: servicios.map((s) => ({ nombre: s.nombre, precio: Number(s.precio), duracion_min: Number(s.duracion_min) })),
          barberos: barberos.map((b) => ({ nombre: b.user?.name ?? "", activo: true })),
        };
      }
      expect(referencia.servicios.length, "la referencia debe tener servicios").toBeGreaterThan(0);
      apk = Apk.elegirEmulador();
      apk.mantenerDespierto();
      const huella = apk.instalar(APK_RUTA);
      if (LOCAL) apk.adb(["reverse", "tcp:8000", "tcp:8000"]);
      Object.assign(datos, {
        entorno: LOCAL ? "local (ensayo)" : "staging",
        api: API_URL,
        apk: `${APK_RUTA.split(/[\\/]/).pop()} (SHA-256 ${huella})`,
        emulador: `${apk.nombreDelEmulador()} (${apk.serie})`,
        referencia: referencia.origen,
        barberoInactivo: INACTIVO || "(ninguno indicado)",
      });

      return `${datos.entorno} · referencia: ${referencia.origen} · ${referencia.servicios.length} servicios activos · ${referencia.barberos.filter((b) => b.activo).length} barberos activos`;
    });

    await paso("1a", async () => {
      const api = await lista<{ nombre: string; precio: number; duracion_min: number }>(request, "services");
      datos.serviciosApi = api.map((s) => ({ nombre: s.nombre, precio: Number(s.precio), duracion_min: Number(s.duracion_min) }));
      const diferencias: string[] = [];
      for (const s of referencia.servicios) {
        const a = api.find((x) => x.nombre === s.nombre);
        if (!a) diferencias.push(`falta «${s.nombre}»`);
        else if (Number(a.precio) !== s.precio || Number(a.duracion_min) !== s.duracion_min) {
          diferencias.push(`«${s.nombre}»: API $${a.precio}/${a.duracion_min} min, base $${s.precio}/${s.duracion_min} min`);
        }
      }
      for (const a of api) if (!referencia.servicios.some((s) => s.nombre === a.nombre)) diferencias.push(`sobra «${a.nombre}»`);
      expect(diferencias, "la API debe dar los mismos servicios que la base").toEqual([]);

      return `${api.length} servicios; iguales a la referencia`;
    });

    await paso("1b", async () => {
      await apk!.abrirLimpia("Ver servicios sin iniciar sesión");
      await apk!.tocar("Ver servicios sin iniciar sesión");
      await apk!.esperar(DURACION, 60);
      recorrido = await recorrerCatalogo(apk!, testInfo, new Set(referencia.barberos.map((b) => b.nombre)));
      datos.serviciosApp = [...recorrido.servicios].map(([nombre, v]) => ({ nombre, precio: v.precio, duracion_min: v.duracion }));
      datos.pantallas = recorrido.pantallas;
      datos.barberosApp = recorrido.barberos;
      const diferencias: string[] = [];
      for (const s of referencia.servicios) {
        const a = recorrido.servicios.get(s.nombre);
        if (!a) diferencias.push(`la app no muestra «${s.nombre}»`);
        else if (a.precio !== s.precio || a.duracion !== s.duracion_min) {
          diferencias.push(`«${s.nombre}»: app $${a.precio}/${a.duracion} min, base $${s.precio}/${s.duracion_min} min`);
        }
      }
      for (const nombre of recorrido.servicios.keys()) if (!referencia.servicios.some((s) => s.nombre === nombre)) diferencias.push(`la app muestra «${nombre}», que no está en la base`);
      for (const p of recorrido.pantallas.filter((x) => x.servicios.length)) await adjuntar(testInfo, p.archivo);
      expect(diferencias, "cada servicio de la app debe coincidir con la base").toEqual([]);

      return `La app muestra ${recorrido.servicios.size} servicios; nombre, precio y duración iguales a la base en todos`;
    });

    if (!INACTIVO) {
      for (const n of ["P", "2a", "2b"]) omitir(n, "No hay un barbero inactivo en este entorno (HUMO_T093_BARBERO_INACTIVO vacío)");
      // Aun así se deja la evidencia de los barberos que muestra la app (sirve de «antes» si luego se desactiva uno).
      for (const p of recorrido!.pantallas.filter((x) => x.barberos.length).slice(0, 2)) await adjuntar(testInfo, p.archivo);
      test.info().annotations.push({ type: "acción 2 omitida", description: "No hay un barbero inactivo en este entorno" });

      return;
    }

    await paso("P", async () => {
      const b = referencia.barberos.find((x) => x.nombre === INACTIVO);
      expect(b, `«${INACTIVO}» debe estar en la base`).toBeTruthy();
      expect(b!.activo, `«${INACTIVO}» debe estar inactivo en la base`).toBe(false);

      return `«${INACTIVO}» está en la base con activo = false (${referencia.barberos.filter((x) => x.activo).length} activos, ${referencia.barberos.filter((x) => !x.activo).length} inactivo)`;
    });

    await paso("2a", async () => {
      const api = (await lista<{ user?: { name?: string } }>(request, "barbers")).map((b) => b.user?.name ?? "");
      datos.barberosApi = api;
      const activos = referencia.barberos.filter((b) => b.activo).map((b) => b.nombre);
      expect(api, `la API no debe listar a «${INACTIVO}»`).not.toContain(INACTIVO);
      expect([...api].sort(), "la API debe listar exactamente a los barberos activos").toEqual([...activos].sort());

      return `${api.length} barberos; «${INACTIVO}» no está; son exactamente los activos de la base`;
    });

    await paso("2b", async () => {
      const activos = referencia.barberos.filter((b) => b.activo).map((b) => b.nombre);
      for (const p of recorrido!.pantallas.filter((x) => x.barberos.length).slice(0, 2)) await adjuntar(testInfo, p.archivo);
      expect(recorrido!.barberos, `la app no debe mostrar a «${INACTIVO}»`).not.toContain(INACTIVO);
      expect([...recorrido!.barberos].sort(), "la app debe mostrar exactamente a los barberos activos").toEqual([...activos].sort());

      return `La app muestra ${recorrido!.barberos.length} barberos; «${INACTIVO}» no está; son exactamente los activos de la base`;
    });
  } finally {
    const fallo = PASOS.find((p) => p.resultado === "falló");
    const omitidos = PASOS.filter((p) => p.resultado === "omitido");
    const veredicto = fallo
      ? `NO PASA: falló el paso ${fallo.n} (${fallo.titulo}): ${fallo.detalle}`
      : omitidos.length
        ? "PASA la acción 1 (servicios). La acción 2 (barbero inactivo) queda OMITIDA en este entorno: no hay un barbero inactivo."
        : "PASA: cada servicio muestra nombre, precio y duración iguales a la base, y el barbero inactivo no aparece.";
    const md = [
      `# Acta T093 (HT-43) — Servicios y barberos visibles para el cliente — ${new Date().toISOString()}`,
      "",
      ...Object.entries(datos).filter(([, v]) => typeof v === "string").map(([k, v]) => `- ${k}: ${String(v)}`),
      "",
      "| # | Dónde | Paso | Resultado esperado | Resultado | Detalle |",
      "|---|---|---|---|---|---|",
      ...PASOS.map((p) => `| ${p.n} | ${p.donde} | ${p.titulo} | ${p.esperado} | ${p.resultado} | ${p.detalle.replace(/\|/g, "/")} |`),
      "",
      `**Veredicto:** ${veredicto}`,
    ].join("\n");
    writeFileSync(testInfo.outputPath("acta-T093-servicios-barberos.md"), md);
    writeFileSync(testInfo.outputPath("datos-T093-servicios-barberos.json"), JSON.stringify({ ...datos, pasos: PASOS, veredicto }, null, 2));
    await testInfo.attach("acta-T093-servicios-barberos.md", { path: testInfo.outputPath("acta-T093-servicios-barberos.md"), contentType: "text/markdown" });
    console.log(`\n${md}\n`);
  }
});
