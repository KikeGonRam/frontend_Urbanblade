import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/*
 * Maneja el APK en un EMULADOR de Android con adb, como lo haría una persona: lee lo que hay en pantalla (uiautomator),
 * toca textos y escribe en los campos. Lo usa la prueba de humo (T075) para revisar que la app muestra lo mismo que la
 * web. Nunca trabaja con un teléfono físico: solo acepta dispositivos «emulator-».
 */

const ADB =
  process.env.HUMO_ADB
  ?? join(process.env.LOCALAPPDATA ?? join(homedir(), "AppData", "Local"), "Android", "Sdk", "platform-tools", process.platform === "win32" ? "adb.exe" : "adb");

export const PAQUETE = "com.urbanblade.mobile";

export interface Nodo {
  texto: string;
  descripcion: string;
  clase: string;
  x: number;
  y: number;
  arriba: number;
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

function decodificar(valor: string) {
  return valor
    .replace(/&#10;/g, "\n")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/** `adb shell input text` no escribe bien espacios, %, comillas ni barras: se avisa sin mostrar el valor. */
function paraInputText(valor: string, que: string) {
  if (/[\s%'"\\`]/.test(valor)) {
    throw new Error(
      `${que} tiene espacios, %, comillas o barras, que adb no puede escribir de forma confiable. Usa otra contraseña `
        + "para la cuenta de prueba o escribe ese dato a mano en el emulador.",
    );
  }

  return valor.replace(/([^A-Za-z0-9@._+-])/g, "\\$1");
}

export class Apk {
  private constructor(readonly serie: string) {}

  /** El único emulador encendido, o el que indique HUMO_ADB_SERIAL. */
  static elegirEmulador(): Apk {
    const lineas = execFileSync(ADB, ["devices"], { encoding: "utf8" }).split(/\r?\n/);
    const emuladores = lineas
      .map((l) => l.split("\t"))
      .filter(([serie, estado]) => serie?.startsWith("emulator-") && estado === "device")
      .map(([serie]) => serie!);
    const pedido = process.env.HUMO_ADB_SERIAL;
    if (pedido) {
      if (!pedido.startsWith("emulator-")) throw new Error("HUMO_ADB_SERIAL debe ser un emulador (emulator-XXXX).");
      if (!emuladores.includes(pedido)) throw new Error(`El emulador ${pedido} no está encendido.`);

      return new Apk(pedido);
    }
    if (emuladores.length !== 1) {
      throw new Error(
        `Se necesita exactamente un emulador encendido y hay ${emuladores.length}. Enciende uno (por ejemplo Medium Phone `
          + "API 36.1) o indica cuál con HUMO_ADB_SERIAL.",
      );
    }

    return new Apk(emuladores[0]!);
  }

  /**
   * Mantiene la pantalla encendida y desbloqueada: los pasos de la web tardan minutos y, si el emulador se duerme,
   * uiautomator ya no ve nada («null root node»). `stayon` solo dura mientras el emulador esté encendido.
   */
  mantenerDespierto() {
    this.adb(["shell", "svc", "power", "stayon", "true"]);
    this.adb(["shell", "input", "keyevent", "KEYCODE_WAKEUP"]);
    this.adb(["shell", "wm", "dismiss-keyguard"]);
  }

  adb(args: string[]): string {
    return execFileSync(ADB, ["-s", this.serie, ...args], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  }

  nombreDelEmulador(): string {
    return this.adb(["emu", "avd", "name"]).split(/\r?\n/)[0]!.trim();
  }

  /** Instala el APK congelado y devuelve su huella SHA-256. */
  instalar(rutaApk: string): string {
    const huella = createHash("sha256").update(readFileSync(rutaApk)).digest("hex");
    execFileSync(ADB, ["-s", this.serie, "install", "-r", rutaApk], { encoding: "utf8" });

    return huella;
  }

  versionInstalada(): string {
    const info = this.adb(["shell", "dumpsys", "package", PAQUETE]);

    return info.match(/versionName=(\S+)/)?.[1] ?? "desconocida";
  }

  /** Cuántas veces hubo que volver a abrir la app porque Android la cerró por un ANR al arrancar (se anota en el acta). */
  reaperturasPorAnr = 0;

  private lanzar() {
    this.adb(["shell", "monkey", "-p", PAQUETE, "-c", "android.intent.category.LAUNCHER", "1"]);
  }

  /**
   * Arranca la app desde cero: sin sesión ni datos guardados y sin el aviso de permiso de notificaciones. En un emulador
   * con poca memoria Android puede cerrar la app por un ANR mientras arranca; si eso pasa (queda en el registro de
   * Android), se vuelve a abrir hasta 2 veces y se anota en `reaperturasPorAnr`. Cualquier otro problema hace fallar.
   */
  async abrirLimpia(textoDeBienvenida: string) {
    this.adb(["shell", "pm", "clear", PAQUETE]);
    try {
      this.adb(["shell", "pm", "grant", PAQUETE, "android.permission.POST_NOTIFICATIONS"]);
    } catch {
      // Android anterior a 13 no tiene ese permiso.
    }
    this.mantenerDespierto();
    this.adb(["logcat", "-c"]);
    this.lanzar();
    for (let intento = 0; intento <= 2; intento++) {
      const limite = Date.now() + 60_000;
      let cerradaPorAnr = false;
      while (Date.now() < limite) {
        if (await this.hay(textoDeBienvenida)) return;
        const registro = this.adb(["logcat", "-d", "-s", "ActivityManager:I"]);
        if (/Killing \d+:com\.urbanblade\.mobile\/\S+ \(adj -?\d+\): .*anr/i.test(registro)) {
          cerradaPorAnr = true;
          break;
        }
        await esperar(1500);
      }
      if (!cerradaPorAnr) break;
      if (intento < 2) {
        this.reaperturasPorAnr++;
        this.adb(["logcat", "-c"]);
        this.lanzar();
      }
    }
    throw new Error(`La app no mostró «${textoDeBienvenida}» al abrirla (reaperturas por ANR: ${this.reaperturasPorAnr}).`);
  }

  /** Lo que hay en pantalla ahora, según uiautomator. */
  async nodos(): Promise<Nodo[]> {
    for (let intento = 0; intento < 4; intento++) {
      try {
        this.adb(["shell", "uiautomator", "dump", "/sdcard/humo-ui.xml"]);
        const xml = this.adb(["exec-out", "cat", "/sdcard/humo-ui.xml"]);
        const nodos: Nodo[] = [];
        for (const m of xml.matchAll(/<node ([^>]*?)\/?>/g)) {
          const atributo = (nombre: string) => decodificar(m[1]!.match(new RegExp(`${nombre}="([^"]*)"`))?.[1] ?? "");
          const limites = atributo("bounds").match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);
          if (!limites) continue;
          const [x1, y1, x2, y2] = limites.slice(1).map(Number) as [number, number, number, number];
          nodos.push({
            texto: atributo("text").trim(),
            descripcion: atributo("content-desc").trim(),
            clase: atributo("class"),
            x: Math.round((x1 + x2) / 2),
            y: Math.round((y1 + y2) / 2),
            arriba: y1,
          });
        }
        if (nodos.length) return nodos;
      } catch {
        // uiautomator falla a veces mientras hay animaciones: se reintenta.
      }
      await esperar(800);
    }

    return [];
  }

  private coincide(nodo: Nodo, texto: string | RegExp) {
    return [nodo.texto, nodo.descripcion].some((v) => (typeof texto === "string" ? v === texto : texto.test(v)));
  }

  async buscar(texto: string | RegExp): Promise<Nodo | undefined> {
    return (await this.nodos()).find((n) => this.coincide(n, texto));
  }

  async hay(texto: string | RegExp): Promise<boolean> {
    return Boolean(await this.buscar(texto));
  }

  /** Espera a que aparezca el texto en pantalla y devuelve su nodo. */
  async esperar(texto: string | RegExp, segundos = 30): Promise<Nodo> {
    const limite = Date.now() + segundos * 1000;
    while (Date.now() < limite) {
      const nodo = await this.buscar(texto);
      if (nodo) return nodo;
      await esperar(1000);
    }
    throw new Error(`La app no mostró «${String(texto)}» en ${segundos} s.`);
  }

  /** Espera a que el texto ya no esté en pantalla. */
  async esperarQueDesaparezca(texto: string | RegExp, segundos = 30) {
    const limite = Date.now() + segundos * 1000;
    while (Date.now() < limite) {
      if (!(await this.hay(texto))) return;
      await esperar(1000);
    }
    throw new Error(`La app sigue mostrando «${String(texto)}» después de ${segundos} s.`);
  }

  async tocar(texto: string | RegExp, segundos = 30) {
    const nodo = await this.esperar(texto, segundos);
    this.adb(["shell", "input", "tap", String(nodo.x), String(nodo.y)]);
    await esperar(1200);
  }

  /** Escribe en el campo de texto número `indice` (0 = el primero de arriba abajo). */
  private async campo(indice: number, que: string): Promise<Nodo> {
    const campos = (await this.nodos()).filter((n) => n.clase === "android.widget.EditText").sort((a, b) => a.arriba - b.arriba);
    const campo = campos[indice];
    if (!campo) throw new Error(`La app no muestra el campo de ${que}.`);

    return campo;
  }

  /**
   * Escribe en el campo de texto número `indice` (0 = el primero de arriba abajo) y revisa lo que quedó escrito: si el
   * teclado aún se estaba abriendo, `input text` puede repetir o perder la primera letra. En un campo de contraseña la app
   * muestra puntos, así que ahí se compara la cantidad de caracteres. Si no coincide, se borra y se vuelve a escribir.
   */
  async escribir(indice: number, valor: string, que: string, { oculto = false } = {}) {
    for (let intento = 0; intento < 3; intento++) {
      const campo = await this.campo(indice, que);
      this.adb(["shell", "input", "tap", String(campo.x), String(campo.y)]);
      await esperar(1200);
      // Se deja el campo vacío: cursor al final y se borra todo lo que hubiera.
      this.adb(["shell", "input", "keyevent", "123"]);
      this.adb(["shell", "input", "keyevent", ...Array<string>(Math.max(campo.texto.length, valor.length) + 5).fill("67")]);
      this.adb(["shell", "input", "text", paraInputText(valor, que)]);
      await esperar(800);
      // Con el teclado abierto, la barra fija de abajo (por ejemplo «Entrar a UrbanBlade») sube y tapa el campo siguiente:
      // se cierra el teclado, como haría una persona, para que el resto del formulario vuelva a verse.
      this.ocultarTeclado();
      await esperar(800);
      const escrito = (await this.campo(indice, que)).texto;
      // En un campo oculto, si Android no expone ni los puntos (texto vacío), no hay forma de compararlo: se acepta.
      if (oculto ? escrito.length === valor.length || escrito === "" : escrito === valor) return;
    }
    throw new Error(`La app no dejó escribir bien ${que} después de 3 intentos.`);
  }

  ocultarTeclado() {
    if (/mInputShown=true/.test(this.adb(["shell", "dumpsys", "input_method"]))) {
      this.adb(["shell", "input", "keyevent", "4"]);
    }
  }

  /** Desliza hacia arriba para ver lo que sigue en la lista. */
  deslizar() {
    this.adb(["shell", "input", "swipe", "540", "1700", "540", "900", "400"]);
  }

  captura(ruta: string) {
    const png = execFileSync(ADB, ["-s", this.serie, "exec-out", "screencap", "-p"], { maxBuffer: 64 * 1024 * 1024 });
    writeFileSync(ruta, png);
  }
}
