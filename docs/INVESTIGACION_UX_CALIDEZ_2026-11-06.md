# Investigación de UX: una web más cálida, unificada y accesible

Revisión: 6 de noviembre de 2026. Código evaluado: `746903a` de `main`.

## Método y límites

Se revisaron fuentes públicas sobre diseño emocional y microcopy, patrones de estados vacíos de Stripe,
diseño de paneles por rol, WCAG 2.2 y sistemas de diseño de productos de consumo. Se contrastó con el código de
UrbanBlade y con las capturas de los cinco paneles. La investigación de reserva y pago de los competidores de
barbería (Fresha, Booksy y Square) ya está hecha en la
`COMPARATIVA_UX_PLATAFORMAS_2026-11-04.md` del repositorio móvil y no se repite aquí.

Límites, dichos por delante:

- Casi todas las fuentes son blogs de agencias, documentación de producto o resúmenes de terceros. **No son
  investigación con usuarios** ni demuestran que un patrón aumente reservas o satisfacción.
- No se probaron cuentas de competidores ni se hicieron entrevistas. No se midieron tiempos ni abandono.
- Las descripciones de Airbnb, Starbucks y Duolingo vienen de resúmenes informales, algunos generados; sirven como
  dirección de diseño, no como especificación. Los valores exactos hay que tomarlos de sus guías oficiales.
- Una búsqueda sobre el panel de Fresha, Booksy y Square no devolvió ninguna revisión de diseño del calendario del
  personal; solo comparativas de directorios. Esa parte queda sin evidencia externa.

## Qué dicen las fuentes y cómo se aplica

| Fuente | Idea | Aplicación en UrbanBlade |
| --- | --- | --- |
| [Mockplus: diseño emocional](https://www.mockplus.com/blog/post/emotional-design-principles) y [Figr](https://figr.design/blog/emotional-design-product-ui-ux) | El tono lo llevan el color, el microcopy y la disposición; una paleta cálida transmite cercanía y una fría, calma. | Calidez por color, forma y voz, sin perder la identidad negro y dorado |
| [uxdesign.cc: guía de microcopy](https://uxdesign.cc/a-mini-guide-to-microcopy-55496469f03b) y [besthub: estados vacíos](https://besthub.dev/articles/how-microcopy-transforms-empty-ui-scenes-a-design-playbook-88d346de7647) | Un error útil dice qué no se guardó y qué hacer; un vacío invita a una acción. | Guía de voz y barrido de textos (ver Fase A) |
| [Stripe: estado vacío](https://docs.stripe.com/stripe-apps/patterns/empty-state) | Explicar por qué está vacío, dar el siguiente paso, escribir «Aún no hay…» en lugar de un «No hay…» seco y distinguirlo de un error. | Plantilla única de estado vacío con acción |
| [Hyperbots: paneles por rol](https://www.hyperbots.com/glossary/role-based-dashboards), [uxpilot](https://uxpilot.ai/blogs/dashboard-design-principles) y [Appian](https://docs.appian.com/suite/help/26.6/sail/ux-progressive-disclosure.html) | Partir de las decisiones de cada rol, no de las métricas; divulgación progresiva; deshabilitar en lugar de ocultar lo no disponible. | Revisión de cada panel contra «qué decide esta persona hoy» |
| [Deque: WCAG 2.2](https://dequeuniversity.com/resources/wcag-2.2) y [Somerset: novedades](https://playbook.somerset.gov.uk/accessibility/whats-new-in-wcag-2-2) | Nuevos criterios: tamaño de objetivo, foco no oculto, ayuda consistente, autenticación accesible, no repetir datos, alternativa al arrastre. | Lista de verificación de la Fase E |
| [Airbnb (resumen)](https://superdesign.dev/blog/airbnb-design-system), [Duolingo](https://www.webdesignhot.com/design.md/duolingo/) y [Starbucks](https://kombai.com/examples/design-systems/starbucks-kombai) | Geometría redondeada, tipografía amable, texto casi negro en lugar de negro puro, bordes y sombras suaves. | Escala de radios y neutros cálidos (con salvedad de las fuentes) |

## Lo que encontramos en la web de UrbanBlade

- **Ya ayuda a la calidez:** la tipografía es Figtree (redondeada y amable), hay mascotas con estados, el tema `libreta`
  es cálido y los paneles tienen jerarquía clara. Las capturas del 6 de noviembre no mostraron paneles recargados.
- **Voz fría en los estados vacíos:** unas 69 cadenas empiezan con «Sin…» (por ejemplo «Sin registros que mostrar»,
  «Sin pedidos que mostrar»), frente a unas pocas que sí invitan («Todavía no hay trabajos publicados»).
- **Errores impersonales:** unas 112 cadenas dicen «No se pudo…» sin decir qué hacer a continuación.
- **Los temas oscuros son fríos:** el tema por defecto usa `#0a0a0a` y texto `#f2f2f2`, negro y blanco casi puros. El
  tema `libreta` ya muestra que la calidez es posible dentro del kit.
- **Un tema por rol no existe:** los cinco paneles comparten el mismo lenguaje, lo cual unifica, pero el saludo y el
  tono no cambian entre cliente, barbero, recepción, administrador e ingeniero.

Los conteos son búsquedas de texto en `app/`, no una auditoría de cada pantalla.

## Qué significa «más cálido» aquí

1. **Voz:** hablar en «tú», directo y concreto; la acción siguiente siempre a la vista.
2. **Color:** neutros con un matiz cálido en los temas oscuros y texto que no sea blanco puro, sin bajar de AA.
3. **Forma:** una escala de radios (12, 16 y 20 px) y sombras más suaves; botones principales con más aire.
4. **Momentos:** saludo según la hora, confirmaciones breves y amables, mascotas de forma consistente y movimiento
   sutil que respete «reducir movimiento».
5. **Calma:** menos cifras a la vez, con contexto («vs. mes pasado») y alertas solo cuando hay algo que decidir.

## Plan por fases

| Fase | Contenido | Riesgo |
| --- | --- | --- |
| A · Voz y tono | Guía de voz, plantilla única de estado vacío y de error, barrido de las ~180 cadenas | Bajo |
| B · Color y forma | Neutros cálidos en `noir`, `acero` y `salon`, escala de radios, sombras, pruebas de contraste | Medio: toca la identidad |
| C · Momentos | Saludo por hora, confirmaciones, avance de nivel de lealtad, primer ingreso | Bajo |
| D · Por rol | Mejoras de la tabla siguiente | Medio |
| E · Accesibilidad 2.2 | Foco no oculto, ayuda consistente, autenticación, no repetir datos, alternativa al arrastre, densidad cómoda o compacta | Bajo |
| F · Verificación | Repetir la auditoría de 4 temas, 8 páginas y 4 anchos y probar con personas reales | Bajo |

## Mejoras propuestas por rol

| Rol | Pregunta que debe responder el panel | Mejoras |
| --- | --- | --- |
| Cliente | ¿Cuándo es mi próxima cita y qué hago ahora? | Una acción principal por estado, repetir la última reserva, política de cancelación visible antes de confirmar, avance de lealtad con tono cálido |
| Barbero | ¿Qué sigue en mi turno? | Próxima cita con cuenta regresiva, aprobar o rechazar sin salir del panel, botones grandes, «no asistió» a un toque |
| Recepción | ¿Quién llega y qué falta cobrar? | Cola de llegadas, cobro rápido, atajos de teclado, corte de caja explicado paso a paso |
| Administrador | ¿Qué requiere mi decisión hoy? | Alertas primero, menos tarjetas con más contexto, destructivas con confirmación y plazo claro, vacíos con la acción siguiente |
| Ingeniero | ¿Está sano el sistema y qué puedo ver? | Lenguaje llano en estados técnicos, etiqueta clara de solo lectura, sin jerga sin explicar |
| Público | ¿Puedo confiar y reservar rápido? | Fotos reales, reservar siempre visible, horarios y políticas a la vista |

## Lista de verificación de accesibilidad (WCAG 2.2)

| Criterio | Estado en UrbanBlade |
| --- | --- |
| 2.5.8 Tamaño de objetivo (AA) | Barra y menú a 44 px desde la Fase 0; falta medir los enlaces de tablas |
| 2.4.11 Foco no oculto (AA) | Sin comprobar: la barra superior fija puede tapar el elemento enfocado; añadir `scroll-padding-top` |
| 3.2.6 Ayuda consistente (A) | El asistente flotante está en el mismo lugar en los paneles; falta comprobarlo en el sitio público |
| 3.3.8 Autenticación accesible (AA) | Sin comprobar: permitir pegar y gestores de contraseñas en el acceso |
| 3.3.7 Entrada redundante (A) | Sin comprobar en la reserva por pasos |
| 2.5.7 Movimientos de arrastre (AA) | Sin comprobar en el calendario |

## Lo que este informe no hace

No cambia código ni colores, no declara ninguna conformidad con WCAG y no sustituye pruebas con personas. Las
decisiones de la Fase B (cambiar el matiz de los temas oscuros) tocan la identidad visual y requieren la
aprobación del equipo.
