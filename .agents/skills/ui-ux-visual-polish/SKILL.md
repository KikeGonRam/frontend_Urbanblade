---
name: ui-ux-visual-polish
description: Mejora la presentacion y accesibilidad visual de frontend-urban sin cambiar contratos, rutas, permisos, datos ni flujos de negocio.
---

# Pulido visual UrbanBlade

Usa esta skill al mejorar la UI/UX de `frontend-urban` cuando el producto ya funciona y el alcance es visual.

## Limites innegociables

- Conserva contratos de API, autenticacion, rutas, permisos, composables y acciones de mutacion.
- Respeta los cuatro temas mediante tokens existentes; no introduzcas paletas hardcodeadas.
- `AppSidebarV2.vue` conserva la navegacion y permisos de `useNavigation()`; los shells moviles se preservan.
- Las mascotas comunican estado: no cubras contenido ni controles y conserva `prefers-reduced-motion`.
- Revisa `git status` y el diff de los archivos a tocar; no sobrescribas cambios locales ajenos.

## Criterios del pase

Prioriza jerarquia, legibilidad, foco de teclado visible, objetivos tactiles de 44 px, contraste por tema, estados hover/activo/disabled y responsive. No conviertas un control visual en una funcion nueva.

No inicies ni reinicies el servidor de desarrollo si el usuario indica que ya esta corriendo. Si surge un defecto funcional o vulnerabilidad, reportalo con evidencia breve sin corregirlo durante el pase visual.

Para controles, dashboards, gráficas y tablas usa el kit propio descrito en `urbanblade-ui-kit` (interruptor, selector de método de pago, KPI, tablas) en vez de estilos locales.

## Movimiento (reglas adaptadas de emilkowalski/skills)

Antes de animar, responde dos preguntas: **¿cuántas veces al día lo verá alguien?** y **¿para
qué anima?** Las únicas razones válidas son consistencia espacial, indicar un estado, dar
respuesta a una acción, explicar algo o evitar un cambio brusco; "se ve bonito" no cuenta.

- **Frecuencia.** Acciones por teclado y las que se repiten decenas de veces al día (moverse
  por listas, abrir o cerrar la barra lateral, el buscador) no se animan o se animan apenas.
  Lo ocasional (modales, cajones, avisos) lleva animación normal; lo que se ve una vez
  (bienvenida, pago exitoso, recibo) puede llevar un detalle de gusto.
- **Curva.** Entradas y salidas con *ease-out* fuerte propio, p. ej.
  `cubic-bezier(0.23, 1, 0.32, 1)`; movimiento dentro de la pantalla con *ease-in-out*; hover y
  color con `ease`. Nunca `ease-in` en la interfaz, y las curvas por defecto de CSS son flojas.
- **Duración.** La interfaz se queda **por debajo de 300 ms**; lo más lento necesita
  justificación.
- **Solo `transform` y `opacity`.** Nada de `transition: all` ni de animar `width`, `height`,
  `margin`, `top` o `left`.
- **Nada nace de `scale(0)`.** Parte de `scale(0.95)` con `opacity: 0`. Los menús y popovers
  crecen desde su disparador (`transform-origin`); los modales siguen centrados.
- **Respuesta al toque.** Todo botón tiene `:active` (por ejemplo `scale(0.97)`); el hover va
  dentro de `@media (hover: hover) and (pointer: fine)` para que no se quede pegado en
  teléfonos.
- **Interrumpible.** Lo que se dispara varias veces seguidas o se arrastra usa transiciones o
  resortes que se reorientan desde el estado actual, no *keyframes* que reinician.
- **Movimiento reducido.** Con `prefers-reduced-motion` se quita el desplazamiento y se
  conservan opacidad y color (ya vale para las mascotas).
- **Lo deliberado es más lento que la respuesta del sistema** (mantener pulsado, confirmar
  algo destructivo), y el movimiento acompaña la personalidad del producto: un panel es nítido,
  no rebota.
- **Revisión.** Al revisar movimiento o interfaz, entrega una tabla `| Antes | Después | Por qué |`
  con una fila por hallazgo, no una lista.

## Datos extremos (antes de dar por buena una lista, tarjeta o formulario)

La interfaz se prueba con el peor caso **realista**, no con datos inventados al azar ni con la
demo que le queda bien al diseño.

- **Cada valor mostrado**: lista qué campos pinta y de dónde salen. El límite sale del
  esquema (reglas `max:` de validación en `barber`, migraciones, tipos de la API); donde no hay
  límite, anótalo como hallazgo.
- **Casos que casi siempre rompen:** nombre larguísimo con acentos
  (`Aleksandra Wiśniewska-Kowalczyk`), nombre de una letra (iniciales mal calculadas), correo
  largo sin puntos de corte, campo opcional vacío (sin renglones huérfanos ni "—" sueltos),
  una etiqueta traducida o más larga, y cifras grandes.
- **Listas:** vacía, con un solo elemento (singular: "1 cita", no "1 citas") y con más de 1000
  si no tiene paginación.
- **Formato:** números y moneda con `Intl.NumberFormat`, cifras que cambian con
  `font-variant-numeric: tabular-nums`, plurales con `Intl.PluralRules`.
- **Dónde mirar:** al ancho real del contenedor, a 320 px, con zoom del navegador al 200 %, y en
  los cuatro temas.
- **Cómo se inyecta:** cambia los datos en el borde (los *mocks* de `e2e/support/api-mock.ts`
  o los *props*), nunca edites el HTML o el CSS para provocar el fallo. El interruptor de datos
  extremos es solo de desarrollo y no se publica.
- **Reporta antes de corregir**: algunos fallos son decisiones de diseño (¿se trunca o se
  parte?). Lista cada uno con su propuesta y detente; corrige cuando lo pidan. La herramienta
  de medición ya existe: `e2e/auditoria-ui.spec.ts` y `docs/AUDITORIA_UI_UX.md`.

| Si ves | Casi siempre es | Arreglo |
| --- | --- | --- |
| Avatar o ícono aplastado | Hijo flex que se encoge | `flex-shrink: 0` |
| Texto que se sale de su caja | Hijo flex o de grid con `min-width: auto` | `min-width: 0` (en grid `minmax(0, 1fr)`) |
| Correo o URL que rebasa el borde | La cadena no tiene dónde cortarse | `overflow-wrap: anywhere` |
| Botón o menú de la derecha empujado fuera | El centro se comió el espacio | `min-width: 0` al centro y `flex-shrink: 0` a la acción |
| Insignia en dos renglones | Se le permite encogerse | `white-space: nowrap; flex-shrink: 0` |
| Imagen rota en el avatar | No hay respaldo si falla | Caer a las iniciales; `object-fit: cover` |

## Sensación de app en el teléfono (PWA)

Solo aplica donde la web se usa instalada o en móvil; cada arreglo se aplica donde aplica su
motivo, no por costumbre.

- Estilos `hover` solo con `@media (hover: hover) and (pointer: fine)`; en táctil el
  feedback es `:active`.
- `-webkit-tap-highlight-color: transparent` en `html` (y entonces cada elemento tocable
  necesita su `:active`).
- Alto de pantalla con `100dvh` en el armazón de la app y `100svh` en portadas; `100vh` solo
  como respaldo.
- Campos de texto con 16 px como mínimo para que iOS no amplíe la página al enfocar. **Nunca
  desactives el zoom** (`user-scalable=no`, `maximum-scale=1`): es una falla de accesibilidad.
- `viewport-fit=cover` con `env(safe-area-inset-*)` para la muesca y la barra inferior.
- Se prueba en el teléfono real (el S25 con Chrome remoto): la emulación del navegador no
  reproduce el hover pegado, la barra de URL, la muesca ni el teclado.
