# Auditoría UX/UI de componentes existentes (6 de noviembre de 2026)

Alcance: mejorar lo que ya existe, sin funciones nuevas. Cuatro áreas: gráficas y métricas del administrador,
calendario de recepción, cobro y venta adicional, y las vistas de barbero y cliente. Código evaluado: `main` en
`c92d252`, ya con los cambios de calidez (fases A a E) y de gráficas (Fase D).

## Fuentes y qué se pudo revisar de verdad

| Fuente pedida | Qué se obtuvo | Límite |
| --- | --- | --- |
| AgendaPro | [Software para negocios](https://agendapro.com/es-es/negocios/software-para-negocios) y [blog de inventario](https://agendapro.com/blog/software-para-inventarios/): mínimo de unidades por producto con aviso, descuento de stock al vender, agenda conectada con ocupación, inventario y comisiones | Material comercial; no se vio la vista por profesional ni el bloqueo de horarios |
| Zenoti Barbershop | [POS para barberías](https://www.zenoti.com/barbershop-software/barbershop-pos), [ventas adicionales automáticas](https://www.zenoti.com/platform/automated-upsells) y el [informe Sales - Realtime Recos](https://help.zenoti.com/en/reports/finance/sales/sales-realtime-recos-report.html): recomendaciones en el cobro, atribución del producto al barbero que lo recomendó y comisiones por barbero, servicio y venta | El detalle de comisiones en la app móvil no se pudo confirmar |
| Mobbin | La exploración de pantallas web respondió **403**: requiere cuenta | No se usó como fuente |
| Page Flows | El [índice público](https://pageflows.com/web/flows/) lista flujos («Onboarding», «Deleting your account», «Purchasing & Ordering»); las grabaciones piden cuenta o prueba | Sin acceso a las grabaciones; no hay un flujo de «menú contextual» listado |
| Dribbble y Behance | **No se revisaron.** Son galerías de diseño conceptual, no productos en uso, y no dan medidas verificables | Las cifras de abajo salen de WCAG y de nuestro kit, no de esas galerías |
| Técnica | [FullCalendar `eventConstraint`](https://fullcalendar.io/docs/eventConstraint): los recursos (columnas por barbero) son **función de pago**. Chart.js no trae sombra para el globo de información: hay que dibujarla con un plugin | — |

Lo que no se pudo ver se dice como tal. Ninguna recomendación se presenta como copiada de una pantalla que no
se revisó.

## 1. Gráficas y tarjetas de métricas (administrador)

**Diagnóstico UX.** En sistemas ya construidos las gráficas se diseñan para un tema y fallan en otro: texto de
ejes tenue (bajo 4.5:1), globos negros fijos que en el tema claro parecen un parche y gráficas que no cambian de
color con el tema. En las tarjetas, el número grande compite con la variación y el periodo («vs. mes pasado»)
pesa casi lo mismo que el dato. Ya corregido en la Fase D: tema en caliente, ejes a 0.7 de opacidad y globo con el
fondo del tema.

**Propuesta.** Patrón de [Zenoti](https://www.zenoti.com/barbershop-software/barbershop-pos) y AgendaPro: el dato
primero y el contexto debajo, más pequeño; alertas solo cuando hay algo que decidir. Para el globo, una sombra
suave que lo separe del fondo en los cuatro temas.

**Especificaciones de UI.**

| Elemento | Valor |
| --- | --- |
| Texto de ejes | `inkRgba(0.7)` (ya aplicado), 12 px, peso 600 en lugar de 700 para no competir con los datos |
| Cuadrícula | `inkRgba(0.08)` en temas oscuros, `inkRgba(0.10)` en `libreta` |
| Globo de información | fondo `--bg-card`, borde `1px rgb(var(--gold-rgb) / .30)`, radio 10 px, padding 10 y 12 px; título 12 px peso 800 en `--gold-text`; cuerpo 13 px peso 600 en `--ink` |
| Sombra del globo | plugin `beforeTooltipDraw` con `shadowColor rgba(0,0,0,.35)`, `shadowBlur 18`, `shadowOffsetY 6` en temas oscuros, y `rgba(70,45,20,.18)` en `libreta` |
| Tarjeta de métrica | padding 20 px (24 px desde `lg`); etiqueta 13 px `--muted` peso 600; número 32 px peso 800 con `tabular-nums` y `letter-spacing -.02em`; variación en píldora de 12 px; periodo 12 px `--muted` en una sola línea |
| Hover y foco de tarjeta enlazada | borde `rgb(var(--gold-rgb) / .45)` y `translateY(-1px)`; foco `outline 2px var(--gold)` con `outline-offset 2px`; sin movimiento con «reducir movimiento» |

## 2. Calendario de recepción

**Diagnóstico UX.** El calendario usa FullCalendar en su versión gratuita (mes, semana, día y lista), con filtro por
barbero y colores por estado que llegan del backend como fondo sólido. Lo que suele fallar: fondos sólidos de
muchos colores que saturan la vista, no distinguir lo pendiente de lo confirmado sin leer, no ver los huecos
muertos (fuera de horario o descansos) y no poder arrastrar citas. Las **columnas por barbero** necesitan el plugin
de recursos, que es de pago: hoy no existen.

**Propuesta.** Patrón de agenda conectada de [AgendaPro](https://agendapro.com/es-es/negocios/software-para-negocios):
el estado se lee de un vistazo y lo que no se puede reservar se ve apagado. Sin funciones nuevas: estados con
fondo translúcido y borde izquierdo, y horario no laborable sombreado con `businessHours` del barbero filtrado. El
arrastre y las columnas por barbero quedan fuera hasta decidir la licencia o una vista propia.

**Especificaciones de UI.**

| Estado | Fondo | Borde izquierdo de 3 px | Texto |
| --- | --- | --- | --- |
| Pendiente | `rgb(var(--warning-rgb) / .12)` | `--warning` | `--ink`; en la vista de día, la palabra «Por aprobar» |
| Confirmada | `rgb(var(--info-rgb) / .12)` | `--info` | `--ink` |
| En proceso | `rgb(var(--gold-rgb) / .18)` | `--gold` | `--ink`, peso 700 |
| Completada | `rgb(var(--success-rgb) / .10)` | `--success` | `--muted` |
| Cancelada o no asistió | transparente | `--line` punteado | `--muted` tachado |

- Se aplican con `eventClassNames` (`ub-ev--pendiente`, etc.) en lugar del `backgroundColor` del backend, para
  que cada tema use sus tokens. El color nunca va solo: el estado también va en texto o icono.
- Horario no laborable: `businessHours` del barbero seleccionado y
  `.fc-non-business { background: repeating-linear-gradient(135deg, rgb(var(--ink-rgb) / .04) 0 6px, transparent 6px 12px) }`.
- En semana y día, `slotDuration 00:15` y `slotLabelInterval 01:00`, con 30 min de alto mínimo por cita para que
  el texto no se corte; `nowIndicator` en `--gold`.
- Para recepción, abrir en la vista de **día**: la mayoría de sus decisiones son del día.

## 3. Cobro y venta adicional

**Diagnóstico UX.** Hoy los productos se ofrecen al reservar (complemento de la reserva) y el cobro se hace en
Pagos. Lo típico que falla: ofrecer productos en un momento que interrumpe el cobro, y un resumen que mezcla
servicio, productos, descuentos y propina sin jerarquía.

**Propuesta.** Patrón de [Zenoti](https://www.zenoti.com/platform/automated-upsells) y su informe
[Realtime Recos](https://help.zenoti.com/en/reports/finance/sales/sales-realtime-recos-report.html): la
recomendación aparece en el punto de cobro, se agrega con un toque y se atribuye al barbero. Sin función nueva hoy:
reutilizar los productos que ya existen como complemento y mostrarlos al cobrar como una fila compacta y
descartable, nunca como modal.

**Especificaciones de UI.**

- Fila de sugerencias debajo del resumen, no encima: máximo 3 tarjetas de 160 px, imagen de 48 px con radio 10 px,
  nombre en 13 px y precio con `tabular-nums`; botón «Agregar» de 36 px (44 px con puntero táctil) que cambia a
  «Agregado ✓».
- Botón «Ocultar sugerencias» siempre visible; si se oculta, no reaparece en ese cobro.
- Resumen en tres bloques separados por 1 px de `--line`: **Servicios**, **Productos** y **Ajustes** (descuento,
  propina). Total en 24 px peso 800 alineado a la derecha y un solo botón principal «Cobrar $X».
- Métodos de pago como opciones grandes (tarjeta, efectivo, transferencia) de 56 px con icono; la elegida con
  `border 2px var(--gold)`.

## 4. Barbero (móvil) y cliente

**Diagnóstico UX del barbero.** Cada cita de la agenda tiene hasta cuatro botones del mismo tamaño (Iniciar, No
asistió, Cancelar y Ticket). Ya miden 44 px, pero compiten: con una mano es fácil tocar el equivocado. Las notas
del cliente no están a un toque.

**Propuesta.** Patrón de agenda móvil de Zenoti y AgendaPro: una acción principal por estado, a lo ancho y abajo
de la tarjeta (zona del pulgar), y el resto en el menú ⋯ que ya existe (`UiRowMenu`).

**Especificaciones de UI (barbero).**

- Tarjeta de cita: padding 16 px, hora 18 px peso 800 con `tabular-nums`, cliente 16 px y servicio 13 px en `--muted`.
- Acción principal de 48 px de alto y ancho completo según el estado: Aprobar, luego Iniciar, luego Terminar y al
  final Ticket. «No asistió» y «Cancelar» pasan al menú ⋯ con confirmación.
- Nota del cliente: chip «Nota» de 32 px junto al nombre, que abre una hoja inferior; si hay alergias, el chip va
  en `--warning`.

**Diagnóstico UX del cliente.** La reserva tiene cuatro pasos (Servicio, Barbero, Horario y Confirmar) y avanza sola
al elegir. Fallas típicas: obligar a elegir barbero cuando da igual y no recordar el último.

**Especificaciones de UI (cliente).**

- Paso de barbero: primera tarjeta «El primero disponible» y, si existe, «Tu barbero de siempre» preseleccionado.
- Horarios como chips de 44 px en una cuadrícula de 4 columnas (3 en 320 px), agrupados en mañana, tarde y noche.
- Barra de progreso de 4 pasos con el actual en `--gold-text` y los hechos con ✓, clicables para volver.

## Prioridad recomendada

1. Calendario: estados translúcidos y horario no laborable (bajo riesgo y mucho efecto en recepción).
2. Barbero: una acción principal por estado y el resto en el menú ⋯.
3. Tarjetas de métricas y sombra del globo.
4. Cliente: «El primero disponible» y chips de horario por franja.
5. Cobro: fila de sugerencias descartable (antes hay que decidir cómo se atribuye al barbero).

Las columnas por barbero y el arrastre en el calendario son funciones nuevas o de pago: quedan fuera de esta
auditoría hasta que el equipo lo decida.
