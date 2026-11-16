import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { expect, test, type APIRequestContext, type TestInfo } from "@playwright/test";

import { Apk, type Nodo } from "./apk";

/*
 * T076 (HT-43): «Registro de cliente con datos válidos e inválidos». Prueba de integración de sistemas del módulo
 * «Registro», con enfoque de caja negra (particiones de equivalencia), para RF-01 (Registro de clientes).
 *
 * La app se usa como lo haría una persona nueva: «Crear mi cuenta» desde la bienvenida.
 *   1. Partición válida: todos los datos y un correo nuevo. La cuenta se crea y se muestra la confirmación.
 *   2. Partición inválida, falta un dato obligatorio (el nombre). La cuenta no se crea y se muestra el error del campo.
 *      Como apoyo se revisan también los otros datos obligatorios: correo, aceptación legal y contraseña.
 *   3. Partición inválida, correo «cliente@correo» (sin dominio de nivel superior). La cuenta no se crea y se muestra el
 *      error del correo.
 *
 * Integración con la API real: después de cada acción se pregunta a la API si la cuenta existe. Para no crear nada, la
 * pregunta es un POST /auth/register SIN nombre ni contraseña: la API siempre lo rechaza (422) y, si el correo ya está
 * registrado, lo dice en errors.email. Al final, la cuenta creada en la acción 1 se borra con DELETE /profile, como
 * lo haría su dueño.
 *
 * Los correos nuevos usan el dominio reservado urbanblade.test: el correo de bienvenida nunca llega a una persona real.
 * La contraseña se genera en cada corrida y no se guarda en ninguna parte.
 */

const LOCAL = process.env.HUMO_ENTORNO === "local";
const API_URL = process.env.HUMO_API_URL ?? (LOCAL ? "http://127.0.0.1:8000" : "https://api.urbanblade.com.mx");
const APK_RUTA = resolve(
  process.env.HUMO_APK
    ?? (LOCAL
      ? "../documentacion/HT-46/T075/apk/UrbanBlade-debug-local-main-095f168.apk"
      : "../documentacion/HT-46/T075/apk/UrbanBlade-staging-main-095f168.apk"),
);
const pausa = (ms: number) => new Promise((r) => setTimeout(r, ms));

const SELLO = new Date().toISOString().replace(/\D/g, "").slice(0, 12);
const NOMBRE = "Mateo Prueba T076";
const PRIMER_NOMBRE = NOMBRE.split(" ")[0]!;
const INICIALES = NOMBRE.split(" ").slice(0, 2).map((p) => p[0]).join("");
const CORREO_NUEVO = `qa.t076.${SELLO}@urbanblade.test`;
const CORREO_SIN_NOMBRE = `qa.t076.${SELLO}.sinnombre@urbanblade.test`;
const CORREO_SIN_ACEPTAR = `qa.t076.${SELLO}.sinaceptar@urbanblade.test`;
const CORREO_SIN_CONTRASENA = `qa.t076.${SELLO}.sincontrasena@urbanblade.test`;
const CORREO_INVALIDO = "cliente@correo";
// Mayúscula, minúscula y número (Password::defaults() de la API); solo letras y números para que adb la escriba.
const CONTRASENA = `Qa${randomBytes(6).toString("hex")}T76`;

// Un mensaje de error del campo: lo que la app diría si avisara que falta o que está mal.
const MENSAJE_DE_ERROR = /obligatori|requerid|escribe|ingresa|introduce|captura|falta|vac[ií]o|v[aá]lid|inv[aá]lid|necesari/i;

type Resultado = "pasó" | "falló" | "no se ejecutó";
interface Paso { n: string; donde: string; titulo: string; esperado: string; resultado: Resultado; detalle: string }

const PASOS: Paso[] = [
  ["0", "—", "Entorno, app y correos de prueba", "La API responde; los correos nuevos no están registrados"],
  ["1a", "APK", "Registrar con todos los datos", "La cuenta se crea y se muestra la confirmación"],
  ["1b", "API", "La cuenta existe en la API", "Inicia sesión con el correo nuevo; rol cliente; mismo nombre"],
  ["2a", "APK", "Registrar sin el nombre (dato obligatorio)", "No se crea y se muestra el error del campo faltante"],
  ["2b", "API", "La cuenta sin nombre no existe", "El correo sigue libre; la API exige el nombre"],
  ["2c", "APK", "Apoyo: sin correo, sin aceptar los términos y sin contraseña", "No se crea y se muestra el error del campo faltante"],
  ["3a", "APK", "Registrar con el correo «cliente@correo»", "No se crea y se muestra el error del correo"],
  ["3b", "API", "La cuenta con «cliente@correo» no existe", "El correo no quedó registrado"],
  ["L", "API", "Limpieza: borrar la cuenta de la acción 1", "DELETE /profile 200; ya no inicia sesión"],
].map(([n, donde, titulo, esperado]) => ({ n: n!, donde: donde!, titulo: titulo!, esperado: esperado!, resultado: "no se ejecutó", detalle: "" }));

/**
 * Corre un paso; si falla, lo anota y sigue con el siguiente, porque las tres acciones son independientes. El error se
 * deja salir de test.step para que el reporte HTML marque ese paso en rojo, y se atrapa afuera para seguir; al final, la
 * prueba falla si algún paso falló.
 */
async function paso(n: string, fn: () => Promise<string>) {
  const p = PASOS.find((x) => x.n === n)!;
  try {
    await test.step(`${n} · ${p.titulo}`, async () => {
      try {
        p.detalle = await fn();
        p.resultado = "pasó";
      } catch (error) {
        p.resultado = "falló";
        // Solo el mensaje propio del paso, sin el detalle de expect ni los colores de la terminal.
        const sinColores = (error as Error).message.split(String.fromCharCode(27)).map((t, i) => (i ? t.replace(/^\[[0-9;]*m/, "") : t)).join("");
        p.detalle = sinColores.split("\n")[0]!.replace(/^Error:\s*/, "").trim();
        throw error;
      }
    });
  } catch {
    // Ya quedó anotado en PASOS y marcado en el reporte: se sigue con el siguiente paso.
  }
}

/** Lo que dice la API de un correo sin crear nada: POST /auth/register sin nombre ni contraseña siempre da 422. */
async function sondearCorreo(request: APIRequestContext, correo: string) {
  for (let intento = 0; intento < 4; intento++) {
    const r = await request.post(`${API_URL}/api/v1/auth/register`, { headers: { Accept: "application/json" }, data: { email: correo } });
    if (r.status() === 429) {
      await pausa(20_000);
      continue;
    }
    expect(r.status(), "la consulta sin nombre ni contraseña debe rechazarse (422) y no crear nada").toBe(422);
    const errores = ((await r.json()).errors ?? {}) as Record<string, string[]>;
    const delCorreo = errores.email ?? [];

    return {
      errores,
      registrado: delCorreo.some((m) => /registrad|taken|en uso|existe/i.test(m)),
      formatoRechazado: delCorreo.some((m) => /v[aá]lid/i.test(m)),
    };
  }
  throw new Error("La API respondió 429 (demasiadas solicitudes) cuatro veces seguidas.");
}

async function adjuntar(testInfo: TestInfo, archivo: string) {
  await testInfo.attach(archivo.replace(/\.png$/, ""), { path: testInfo.outputPath(archivo), contentType: "image/png" });
}

function campos(nodos: Nodo[]) {
  return nodos.filter((n) => n.clase === "android.widget.EditText").sort((a, b) => a.arriba - b.arriba);
}

/** Escribe un texto con espacios (adb los escribe como %s) y comprueba lo que quedó en el campo. */
async function escribirTexto(apk: Apk, indice: number, valor: string, que: string) {
  for (let intento = 0; intento < 3; intento++) {
    const campo = campos(await apk.nodos())[indice];
    if (!campo) throw new Error(`La app no muestra el campo de ${que}.`);
    apk.adb(["shell", "input", "tap", String(campo.x), String(campo.y)]);
    await pausa(1200);
    apk.adb(["shell", "input", "keyevent", "123"]);
    apk.adb(["shell", "input", "keyevent", ...Array<string>(Math.max(campo.texto.length, valor.length) + 5).fill("67")]);
    if (valor) apk.adb(["shell", "input", "text", valor.replace(/ /g, "%s")]);
    await pausa(800);
    apk.ocultarTeclado();
    await pausa(800);
    const escrito = campos(await apk.nodos())[indice]?.texto ?? "";
    if (escrito === valor || (!valor && !/[@\w]{3,}@/.test(escrito))) return;
  }
  throw new Error(`La app no dejó escribir bien ${que} después de 3 intentos.`);
}

/**
 * Toca un campo y luego otro, como quien pasa por él sin escribir: así la app puede marcarlo como visitado. Entre un
 * toque y otro se cierra el teclado, porque al abrirse mueve el formulario y el segundo toque caería en otro lugar.
 */
async function pasarPorCampo(apk: Apk, indice: number, siguiente: number) {
  for (const i of [indice, siguiente]) {
    const campo = campos(await apk.nodos())[i];
    if (campo) {
      apk.adb(["shell", "input", "tap", String(campo.x), String(campo.y)]);
      await pausa(1200);
      apk.ocultarTeclado();
      await pausa(900);
    }
  }
}

/** Verdadero si el nodo `fuera` envuelve por completo al nodo `dentro`. */
function envuelve(fuera: Nodo, dentro: Nodo) {
  return fuera.izquierda <= dentro.izquierda && fuera.derecha >= dentro.derecha && fuera.arriba <= dentro.arriba && fuera.abajo >= dentro.abajo;
}

/**
 * La casilla «Soy mayor de edad y acepto…». En la app es una fila marcable que envuelve el texto; se toca al inicio de
 * la fila (donde está el cuadro), no sobre los enlaces a los Términos y al Aviso de Privacidad.
 */
async function casillaLegal(apk: Apk) {
  const nodos = await apk.nodos();
  const texto = nodos.find((n) => /^Soy mayor de edad/.test(n.texto) || /^Soy mayor de edad/.test(n.descripcion));
  if (!texto) throw new Error("La app no muestra la casilla «Soy mayor de edad y acepto…».");
  const fila = nodos.filter((n) => n.marcable && envuelve(n, texto)).sort((a, b) => (a.abajo - a.arriba) - (b.abajo - b.arriba))[0];
  if (!fila) throw new Error("La casilla legal no se puede marcar.");

  return fila;
}

async function marcarCasilla(apk: Apk, marcar: boolean) {
  for (let intento = 0; intento < 3; intento++) {
    const fila = await casillaLegal(apk);
    if (fila.marcado === marcar) return;
    apk.adb(["shell", "input", "tap", String(fila.izquierda + 40), String(fila.y)]);
    await pausa(900);
  }
  throw new Error(`La casilla legal no quedó ${marcar ? "marcada" : "sin marcar"}.`);
}

/** Un botón está deshabilitado si él o el contenedor que lo envuelve lo está (en Compose, el texto queda dentro). */
function botonHabilitado(nodos: Nodo[], boton: string) {
  const texto = nodos.find((n) => n.texto === boton || n.descripcion === boton);
  if (!texto) return false;

  return !nodos.some((n) => !n.habilitado && envuelve(n, texto));
}

/** Abre la app desde cero y entra a «Crear mi cuenta». */
async function abrirRegistro(apk: Apk) {
  await apk.abrirLimpia("Crear mi cuenta");
  await apk.tocar("Crear mi cuenta");
  await apk.esperar("Paso 1 de 2", 30);
}

/** Lo que muestra la pantalla: textos visibles, botón principal y si hay algún mensaje de error. */
async function leerFormulario(apk: Apk, boton: string, etiquetas: string[]) {
  const nodos = await apk.nodos();
  const textos = [...new Set(nodos.flatMap((n) => [n.texto, n.descripcion]).filter(Boolean))];
  const errores = textos.filter((t) => MENSAJE_DE_ERROR.test(t) && !etiquetas.includes(t) && !/^Soy mayor de edad/.test(t));

  return { textos, botonHabilitado: botonHabilitado(nodos, boton), errores };
}

/** Toca el botón aunque esté deshabilitado, como haría una persona, y revisa que la app no avance. */
async function intentarAvanzar(apk: Apk, boton: string, pasoActual: string) {
  const nodo = await apk.buscar(boton);
  if (nodo) {
    apk.adb(["shell", "input", "tap", String(nodo.x), String(nodo.y)]);
    await pausa(2000);
  }

  return apk.hay(pasoActual);
}

test("T076: registro de cliente con datos válidos e inválidos (RF-01)", async ({ request }, testInfo) => {
  test.setTimeout(30 * 60_000);
  let apk: Apk | undefined;
  let cuentaCreada = false;
  const datos: Record<string, unknown> = {};
  const etiquetasPaso1 = ["Nombre", "Correo electrónico", "nombre@correo.com", "Continuar", "Paso 1 de 2"];
  const etiquetasPaso2 = ["Contraseña", "Confirmar contraseña", "Crear cuenta", "Paso 2 de 2"];

  try {
    await paso("0", async () => {
      const servicios = await request.get(`${API_URL}/api/v1/services`, { headers: { Accept: "application/json" } });
      expect(servicios.status(), "la API de staging debe responder").toBe(200);
      for (const correo of [CORREO_NUEVO, CORREO_SIN_NOMBRE, CORREO_INVALIDO]) {
        const s = await sondearCorreo(request, correo);
        (datos.correosAntes ??= {} as Record<string, unknown>);
        (datos.correosAntes as Record<string, unknown>)[correo] = s.errores.email ?? [];
        if (correo !== CORREO_INVALIDO) expect(s.registrado, `«${correo}» no debe estar registrado antes de la prueba`).toBe(false);
      }
      apk = Apk.elegirEmulador();
      apk.mantenerDespierto();
      const huella = apk.instalar(APK_RUTA);
      if (LOCAL) apk.adb(["reverse", "tcp:8000", "tcp:8000"]);
      Object.assign(datos, {
        entorno: LOCAL ? "local (ensayo)" : "staging",
        api: API_URL,
        apk: `${APK_RUTA.split(/[\\/]/).pop()} (SHA-256 ${huella})`,
        emulador: `${apk.nombreDelEmulador()} (${apk.serie})`,
        nombre: NOMBRE,
        correoNuevo: CORREO_NUEVO,
        correoSinNombre: CORREO_SIN_NOMBRE,
        correoInvalido: CORREO_INVALIDO,
        contrasena: "(generada en la corrida; no se guarda)",
      });

      return `${datos.entorno} · API ${API_URL} responde · los correos nuevos no están registrados`;
    });
    if (!apk) throw new Error("No hay emulador: no se pueden correr las acciones en la app.");
    const app = apk;

    // ---- Acción 1: partición válida ----
    await paso("1a", async () => {
      await abrirRegistro(app);
      app.captura(testInfo.outputPath("1a-1-formulario-vacio.png"));
      await marcarCasilla(app, true);
      await escribirTexto(app, 0, NOMBRE, "nombre");
      await escribirTexto(app, 1, CORREO_NUEVO, "correo");
      const paso1 = await leerFormulario(app, "Continuar", etiquetasPaso1);
      app.captura(testInfo.outputPath("1a-2-paso-1-lleno.png"));
      expect(paso1.botonHabilitado, "con nombre, correo y la casilla, «Continuar» debe estar habilitado").toBe(true);
      await app.tocar("Continuar");
      await app.esperar("Paso 2 de 2", 20);
      await app.escribir(0, CONTRASENA, "la contraseña", { oculto: true });
      await app.escribir(1, CONTRASENA, "la confirmación de la contraseña", { oculto: true });
      app.captura(testInfo.outputPath("1a-3-paso-2-lleno.png"));
      await app.tocar("Crear cuenta");
      // La app entra a la sesión del cliente recién creado.
      const inicio = await app.esperar(/^(Reservar cita|¿Te toca corte\?|Tu agenda está libre|Mis citas)$/, 90);
      await pausa(2500);
      const textos = [...new Set((await app.nodos()).flatMap((n) => [n.texto, n.descripcion]).filter(Boolean))];
      app.captura(testInfo.outputPath("1a-4-confirmacion.png"));
      datos.pantallaDespuesDelRegistro = textos;
      const saludo = textos.find((t) => t === PRIMER_NOMBRE);
      const iniciales = textos.find((t) => t === INICIALES);
      const aviso = textos.find((t) => /cuenta creada|bienvenid|registr/i.test(t));
      datos.confirmacionVisible = { saludoConElNombre: saludo ?? null, inicialesEnElAvatar: iniciales ?? null, avisoDeCuentaCreada: aviso ?? null };
      expect(saludo ?? aviso, `la app debe mostrar una confirmación: un aviso de cuenta creada o el saludo «${PRIMER_NOMBRE}»`).toBeTruthy();
      cuentaCreada = true;
      for (const f of ["1a-1-formulario-vacio.png", "1a-2-paso-1-lleno.png", "1a-3-paso-2-lleno.png", "1a-4-confirmacion.png"]) await adjuntar(testInfo, f);

      return `La app entró a la sesión del cliente nuevo: inicio con el saludo «${saludo ?? aviso}»${iniciales ? ` y el avatar «${iniciales}»` : ""} («${inicio.texto || inicio.descripcion}»); aviso de «cuenta creada»: ${aviso ? `sí, «${aviso}»` : "no"}`;
    });

    let token = "";
    await paso("1b", async () => {
      const r = await request.post(`${API_URL}/api/v1/auth/login`, {
        headers: { Accept: "application/json" },
        data: { email: CORREO_NUEVO, password: CONTRASENA, device_name: "QA T076" },
      });
      expect(r.status(), "la cuenta nueva debe poder iniciar sesión en la API").toBe(200);
      const cuerpo = await r.json();
      token = cuerpo.token;
      cuentaCreada = true;
      const me = await request.get(`${API_URL}/api/v1/auth/me`, { headers: { Accept: "application/json", Authorization: `Bearer ${token}` } });
      const u = (await me.json()).user as { id: string; name: string; email: string; roles: string[]; client_id: string | null };
      datos.cuentaEnLaApi = { id: u.id, name: u.name, email: u.email, roles: u.roles, client_id: u.client_id };
      expect(u.email).toBe(CORREO_NUEVO);
      expect(u.name).toBe(NOMBRE);
      expect(u.roles).toContain("cliente");
      expect(u.client_id, "debe tener su perfil de cliente").toBeTruthy();

      return `POST /auth/login 200 · /auth/me: «${u.name}», ${u.email}, roles ${u.roles.join(", ")}, perfil de cliente ${u.client_id}`;
    });

    // ---- Acción 2: falta un dato obligatorio (el nombre) ----
    await paso("2a", async () => {
      await abrirRegistro(app);
      await marcarCasilla(app, true);
      await escribirTexto(app, 1, CORREO_SIN_NOMBRE, "correo");
      await pasarPorCampo(app, 0, 1);
      const f = await leerFormulario(app, "Continuar", etiquetasPaso1);
      const sigueEnPaso1 = await intentarAvanzar(app, "Continuar", "Paso 1 de 2");
      app.captura(testInfo.outputPath("2a-sin-nombre.png"));
      await adjuntar(testInfo, "2a-sin-nombre.png");
      datos.sinNombre = { botonContinuarHabilitado: f.botonHabilitado, sigueEnPaso1, mensajesDeError: f.errores, textos: f.textos };
      expect(sigueEnPaso1, "sin nombre la app avanzó al paso 2").toBe(true);
      expect(f.errores, `No avanza («Continuar» ${f.botonHabilitado ? "habilitado" : "deshabilitado"}), pero NO muestra ningún error del campo Nombre que falta`).not.toEqual([]);

      return `No avanza; error mostrado: «${f.errores.join(" / ")}»`;
    });

    await paso("2b", async () => {
      const s = await sondearCorreo(request, CORREO_SIN_NOMBRE);
      datos.sinNombreApi = s.errores;
      expect(s.registrado, `«${CORREO_SIN_NOMBRE}» no debe haberse registrado`).toBe(false);
      expect(s.errores.name, "la API también debe exigir el nombre").toBeTruthy();

      return `El correo sigue libre (la cuenta no se creó). La API exige el nombre: «${s.errores.name![0]}»`;
    });

    await paso("2c", async () => {
      const casos: Record<string, unknown> = {};
      const faltan: string[] = [];

      // Sin correo.
      await abrirRegistro(app);
      await marcarCasilla(app, true);
      await escribirTexto(app, 0, NOMBRE, "nombre");
      await pasarPorCampo(app, 1, 0);
      let f = await leerFormulario(app, "Continuar", etiquetasPaso1);
      let sigue = await intentarAvanzar(app, "Continuar", "Paso 1 de 2");
      app.captura(testInfo.outputPath("2c-1-sin-correo.png"));
      casos.sinCorreo = { botonHabilitado: f.botonHabilitado, sigueEnPaso1: sigue, mensajesDeError: f.errores };
      if (!sigue) faltan.push("sin correo avanzó al paso 2");
      if (!f.errores.length) faltan.push("sin correo no muestra error");

      // Sin aceptar los términos.
      await marcarCasilla(app, false);
      await escribirTexto(app, 1, CORREO_SIN_ACEPTAR, "correo");
      f = await leerFormulario(app, "Continuar", etiquetasPaso1);
      sigue = await intentarAvanzar(app, "Continuar", "Paso 1 de 2");
      app.captura(testInfo.outputPath("2c-2-sin-aceptar.png"));
      casos.sinAceptar = { botonHabilitado: f.botonHabilitado, sigueEnPaso1: sigue, mensajesDeError: f.errores };
      if (!sigue) faltan.push("sin aceptar avanzó al paso 2");
      if (!f.errores.length) faltan.push("sin aceptar no muestra error");

      // Sin contraseña (paso 2), con el paso 1 completo.
      await marcarCasilla(app, true);
      await escribirTexto(app, 1, CORREO_SIN_CONTRASENA, "correo");
      await app.tocar("Continuar");
      await app.esperar("Paso 2 de 2", 20);
      await pasarPorCampo(app, 0, 1);
      f = await leerFormulario(app, "Crear cuenta", etiquetasPaso2);
      const nodos = await app.nodos();
      const ayuda = [...new Set(nodos.map((n) => n.texto).filter((t) => /^m[ií]nimo/i.test(t)))];
      const crear = nodos.find((n) => n.texto === "Crear cuenta");
      if (crear) {
        app.adb(["shell", "input", "tap", String(crear.x), String(crear.y)]);
        await pausa(3000);
      }
      sigue = await app.hay("Paso 2 de 2");
      app.captura(testInfo.outputPath("2c-3-sin-contrasena.png"));
      casos.sinContrasena = { botonHabilitado: f.botonHabilitado, sigueEnPaso2: sigue, mensajesDeError: f.errores, ayudaVisible: ayuda };
      if (!sigue) faltan.push("sin contraseña salió del paso 2");
      if (!f.errores.length && !ayuda.length) faltan.push("sin contraseña no muestra error");
      for (const a of ["2c-1-sin-correo.png", "2c-2-sin-aceptar.png", "2c-3-sin-contrasena.png"]) await adjuntar(testInfo, a);
      const s = await sondearCorreo(request, CORREO_SIN_CONTRASENA);
      casos.sinContrasenaRegistrado = s.registrado;
      if (s.registrado) faltan.push("la cuenta sin contraseña quedó registrada");
      datos.apoyo = casos;
      expect(faltan, `Ninguno avanza ni crea la cuenta, pero: ${faltan.join("; ")}`).toEqual([]);

      return `Sin correo, sin aceptar y sin contraseña: no avanza y muestra el error${ayuda.length ? ` (contraseña: «${ayuda.join(" / ")}»)` : ""}`;
    });

    // ---- Acción 3: correo «cliente@correo» ----
    await paso("3a", async () => {
      await abrirRegistro(app);
      await marcarCasilla(app, true);
      await escribirTexto(app, 0, NOMBRE, "nombre");
      await escribirTexto(app, 1, CORREO_INVALIDO, "correo");
      // Se sale del campo de correo (al nombre) para que la app lo revise.
      await pasarPorCampo(app, 0, 0);
      const f = await leerFormulario(app, "Continuar", etiquetasPaso1);
      const sigueEnPaso1 = await intentarAvanzar(app, "Continuar", "Paso 1 de 2");
      app.captura(testInfo.outputPath("3a-correo-invalido.png"));
      await adjuntar(testInfo, "3a-correo-invalido.png");
      datos.correoInvalidoApp = { botonContinuarHabilitado: f.botonHabilitado, sigueEnPaso1, mensajesDeError: f.errores };
      expect(sigueEnPaso1, "con «cliente@correo» la app no debe avanzar").toBe(true);
      expect(f.errores, "la app debe mostrar el error del correo").not.toEqual([]);

      return `No avanza; error mostrado: «${f.errores.join(" / ")}»; «Continuar» ${f.botonHabilitado ? "habilitado" : "deshabilitado"}`;
    });

    await paso("3b", async () => {
      const s = await sondearCorreo(request, CORREO_INVALIDO);
      datos.correoInvalidoApi = { erroresDelCorreo: s.errores.email ?? [], formatoRechazadoPorLaApi: s.formatoRechazado, registrado: s.registrado };
      expect(s.registrado, "«cliente@correo» no debe haber quedado registrado").toBe(false);

      return s.formatoRechazado
        ? `No está registrado; la API también rechaza el formato: «${s.errores.email![0]}»`
        : "No está registrado. Nota: la API acepta el formato «cliente@correo» (solo la app lo bloquea)";
    });
  } finally {
    // ---- Limpieza: la cuenta de la acción 1 se borra como lo haría su dueño ----
    if (cuentaCreada) {
      await paso("L", async () => {
        const login = await request.post(`${API_URL}/api/v1/auth/login`, {
          headers: { Accept: "application/json" },
          data: { email: CORREO_NUEVO, password: CONTRASENA, device_name: "QA T076 limpieza" },
        });
        expect(login.status()).toBe(200);
        const token = (await login.json()).token as string;
        const borrar = await request.delete(`${API_URL}/api/v1/profile`, {
          headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
          data: { password: CONTRASENA },
        });
        expect(borrar.status(), "DELETE /profile debe borrar la cuenta de prueba").toBe(200);
        const otraVez = await request.post(`${API_URL}/api/v1/auth/login`, {
          headers: { Accept: "application/json" },
          data: { email: CORREO_NUEVO, password: CONTRASENA },
        });
        expect(otraVez.status(), "la cuenta borrada ya no debe iniciar sesión").not.toBe(200);

        return `DELETE /profile ${borrar.status()}; el inicio de sesión después responde ${otraVez.status()}`;
      });
    }

    const fallidos = PASOS.filter((p) => p.resultado === "falló");
    const accion = (n: string) => PASOS.filter((p) => p.n.startsWith(n)).every((p) => p.resultado === "pasó");
    const veredicto = fallidos.length
      ? `NO APROBADA: falló ${fallidos.map((p) => `${p.n} (${p.titulo})`).join(", ")}.`
      : "APROBADA: la acción 1 crea la cuenta con confirmación; las acciones 2 y 3 no la crean y muestran el error del campo.";
    datos.acciones = { "1": accion("1") ? "Aprobada" : "No aprobada", "2": accion("2") ? "Aprobada" : "No aprobada", "3": accion("3") ? "Aprobada" : "No aprobada" };
    const md = [
      `# Acta T076 (HT-43) — Registro de cliente con datos válidos e inválidos — ${new Date().toISOString()}`,
      "",
      ...Object.entries(datos).filter(([, v]) => typeof v === "string").map(([k, v]) => `- ${k}: ${String(v)}`),
      "",
      "| # | Dónde | Paso | Resultado esperado | Resultado | Detalle |",
      "|---|---|---|---|---|---|",
      ...PASOS.map((p) => `| ${p.n} | ${p.donde} | ${p.titulo} | ${p.esperado} | ${p.resultado} | ${p.detalle.replace(/\|/g, "/")} |`),
      "",
      `**Acciones:** 1 ${(datos.acciones as Record<string, string>)["1"]} · 2 ${(datos.acciones as Record<string, string>)["2"]} · 3 ${(datos.acciones as Record<string, string>)["3"]}`,
      "",
      `**Veredicto:** ${veredicto}`,
    ].join("\n");
    writeFileSync(testInfo.outputPath("acta-T076.md"), md);
    writeFileSync(testInfo.outputPath("datos-T076.json"), JSON.stringify({ ...datos, pasos: PASOS, veredicto }, null, 2));
    await testInfo.attach("acta-T076.md", { path: testInfo.outputPath("acta-T076.md"), contentType: "text/markdown" });
    console.log(`\n${md}\n`);
  }

  expect(PASOS.filter((p) => p.resultado === "falló").map((p) => `${p.n}: ${p.detalle}`), "pasos que fallaron").toEqual([]);
});
