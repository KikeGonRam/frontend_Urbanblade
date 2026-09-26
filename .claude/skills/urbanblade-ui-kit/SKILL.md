---
name: urbanblade-ui-kit
description: Kit propio de componentes de frontend-urban (interruptor, selector de método de pago, tarjetas de KPI, gráficas, tablas, badges) inspirado en shadcn/ui, Untitled UI y Tremor pero construido sobre los 4 temas y tokens de UrbanBlade. Consultar antes de crear o rediseñar un control, un dashboard, una gráfica o una tabla en la web, para reutilizar el kit en vez de estilos locales y sin cambiar nunca lo que se envía al backend.
---

# Kit de UI de UrbanBlade (web)

Decisión del 26-sep-2026 (usuario): **kit propio**, no librería. Se analizaron shadcn/ui,
Untitled UI, Tremor, Flowbite, daisyUI, uiverse.io, AdminLTE, Creative Tim y los UI kits de
Figma Community. Ninguna se instala:

| Fuente | Por qué no se instala | Qué se toma |
|---|---|---|
| shadcn/ui | React; shadcn-vue actual pide Tailwind 4 (usamos 3.4) | Sobriedad, foco visible, interruptor, tablas, badges |
| Untitled UI | Sistema en Figma/React | Tarjetas KPI, tablas con filtros, "radio cards" para elegir pago |
| Tremor | Solo React | Estilo de gráficas: poca cuadrícula, barras redondeadas, KPI con variación y minigráfica |
| Flowbite / daisyUI | Temas propios que chocan con los nuestros; versiones actuales piden Tailwind 4 | Estructura de toggle, tabs, stepper, tabla |
| uiverse.io | Calidad y accesibilidad dispares | Solo ideas de microanimación |
| AdminLTE / Creative Tim / Figma | Otra identidad y otro stack | Orden de un dashboard |

Complementa a `ui-ux-visual-polish` (límites del pase visual) y a
`urbanblade-brand-mascots` (mascotas). El equivalente en la app es la sección
"Kit de controles" de `urbanblade-mobile-ui-patrones` (UrbanBladeMobile).

## 1. Límites innegociables

- **Contrato con el backend intacto.** Un componente del kit cambia cómo se ve un control,
  nunca el dato: `activo` sigue siendo `1/0` o `true/false` según ya se mandaba;
  `metodo_pago` sigue siendo exactamente `efectivo`, `transferencia` o `tarjeta`; la
  reserva sigue usando `payChoice` (`despues`, `ahora_tarjeta`, `ahora_transferencia`).
  Si un cambio exige tocar un payload, se detiene y se propone aparte.
- **Identidad.** Solo tokens de `app/assets/css/main.css` (`bg-main`, `bg-card`,
  `bg-accent`, `panel`, `line`, `muted`, `ink`, `gold`, `gold-dim`) vía las clases de
  Tailwind ya configuradas. Nada de hex sueltos: cada componente debe verse bien en los
  **4 temas** (Sastrería/oro por defecto, Acero, Salón, Libreta — el único claro).
- Sin dependencias nuevas de UI. Gráficas con **Chart.js + vue-chartjs** (ya instalados).
- Accesibilidad: foco visible con `gold`, objetivos táctiles ≥ 44 px, roles ARIA
  correctos, `prefers-reduced-motion` respetado, contraste revisado en Libreta.
- Los componentes viven en `app/components/ui/` (auto-import `Ui<Nombre>`); los
  composables de apoyo en `app/composables/`.

## 2. Catálogo

| Componente | Estado | Uso |
|---|---|---|
| `UiImageUpload` | Hecho (26-sep) | Elegir imagen del dispositivo con vista previa; devuelve `File` por v-model |
| `UiSwitch` | Hecho (26-sep) | Todo activar/desactivar (reemplaza `input type=checkbox` sueltos) |
| `UiChoiceCards` | Hecho (26-sep) | Elegir una opción entre 2–4 con ícono, título y detalle (método de pago, cuándo pagar) |
| `UiStatCard` | Hecho (26-sep) | KPI: etiqueta, valor, variación (+/−, color por signo), minigráfica opcional |
| `UiChartCard` + `utils/chartTheme.ts` | Hecho (26-sep) | Marco de gráfica (título, periodo, estado vacío). Colores: `goldRgba()`, `goldSeries(n)`, `chartTooltip()`, `chartAxisClean()` leen el tema activo |
| `UiBadge` + `utils/appointmentStatus.ts` | Hecho (26-sep) | Estados con tono semántico; tonos `success/warning/danger/info` son tokens por tema (más oscuros en Libreta) |
| `UiTable` | Fase 3 | Encabezado fijo, filas compactas, acciones al final, vista de tarjetas en celular |
| `UiEmptyState` | Fase 2 | Estado vacío breve; si es pantalla completa usar `BrandStatePanel` |

Al terminar un componente, cambia su estado aquí y en `.agents/skills/urbanblade-ui-kit`.

### UiSwitch

- `defineModel<boolean>()`, `label` (texto visible o `aria-label`), `description`
  opcional, `disabled`.
- `<button role="switch" :aria-checked>`; Espacio/Enter lo cambian; la etiqueta también.
- Encendido: pista `bg-gold`, perilla clara; apagado: pista `bg-accent` con borde `line`.
- Quien lo usa sigue mandando lo mismo que mandaba (`form.activo ? "1" : "0"`, etc.).

### UiChoiceCards

- Genérico (`generic="T extends string"`): `options: ChoiceOption<T>[]` (tipo en
  `app/types/choice.ts`), `defineModel<T>()`, `label`, `hideLabel`, `columns` (1–4).
  Íconos disponibles: `efectivo`, `transferencia`, `tarjeta`, `salon`.
- `role="radiogroup"` y cada tarjeta `role="radio"` con `aria-checked`; flechas mueven la
  selección. Seleccionada: borde `gold`, fondo `gold/10`, marca de verificación.
- Método de pago: íconos de efectivo, transferencia y tarjeta; detalle corto
  ("Se cobra al instante", "Sube tu comprobante", "Paga en el salón"). La tarjeta
  guardada se muestra como "Visa •••• 4242" si ya viene del backend; no se piden datos
  nuevos.

## 3. Dashboards (fase 2)

Orden fijo en los 5 roles: **KPI con variación → gráfica principal → "Requiere tu
atención" → listas**. Una sola gráfica protagonista por dashboard; el resto, minigráficas
o listas. Gráficas: sin cuadrícula vertical, horizontal tenue (`line`), barras con radio,
leyenda abajo, tooltip con `bg-card`, colores de `useChartTheme()` (oro + neutros; verde
/rojo solo para variación). Los datos siguen viniendo de los mismos endpoints
(`/dashboard`, analítica); no se inventan métricas.

## 4. Inventario de lugares (26-sep-2026)

- Casillas a `UiSwitch`: `pages/services/index.vue`, `pages/inventory/products/index.vue`
  (2), `pages/barbers/manage/index.vue`, `pages/barber/schedule.vue`,
  `pages/notifications/index.vue`, `pages/payments/index.vue` (2). `register.vue`
  (aceptar términos) **se queda como casilla**: es consentimiento, no encendido.
- Método de pago a `UiChoiceCards`: `components/booking/Wizard.vue` (cuándo pagar),
  `pages/payments/index.vue` (cobro en caja), `pages/orders/index.vue` (entrega de
  pedido), y revisar `packages`, `gift-cards`, `membership`, `my/appointments`.
- Dashboards: `components/dashboard/{Administrador,Recepcion,Barbero,Cliente,Ingeniero}.vue`
  y `pages/analytics/index.vue`.

## 5. Aplicado en la fase 1 (26-sep-2026)

- `UiSwitch`: servicios, productos (activo y filtro "Solo bajo stock"), barberos, horario
  del barbero, preferencias de notificación y caja (paquete prepagado, premio de rifa).
- `UiChoiceCards`: reserva ("¿Cuándo prefieres pagar?"), caja (método de pago) y entrega de
  pedidos. En pedidos el selector ofrecía "QR", que el backend rechaza (422); ahora solo
  muestra efectivo, transferencia y tarjeta.
- Pruebas: `e2e/ui-kit.spec.ts`; `e2e/payments.spec.ts` busca la tarjeta como `radio`.

## 5b. Fase 2 — dashboards (26-sep-2026)

- Hechos: **Administrador** (KPIs con variación y minigráfica, aviso de stock bajo, "Ingresos
  por semana" y "Servicios más pedidos" a la vista, estados con `UiBadge`; antes
  "confirmada" salía "—") y **Recepción** (6 KPIs que llevan a su pantalla, citas por hora,
  llegadas y pedidos).
- También hechos (26-sep, 2.ª ronda): **Barbero** (aprobar/rechazar, agenda con "Siguiente",
  semana en español: barber manda `Carbon::format('D')` en inglés y la web lo traduce) y
  **Cliente** (próxima cita con su estado, recomendación, 4 KPIs, visitas por mes, lealtad).
- **Decisión del usuario:** nada escondido tras botones. "Analítica avanzada" del admin ya
  no se pliega ("Desempeño y predicciones", siempre visible). Las tarjetas de degradados
  "Prioridades detectadas"/"Insights del análisis" y `AnalyticsCta` se reemplazaron por
  `DashboardAnalyticsInsights` compacto ("Lo que dicen tus datos"): acepta `insights`
  (spark) y `simple` (`titulo/dato/detalle` del admin) y `show-link` a `/analytics`.
- Movimiento: `.ub-rise` (aparición 420 ms, escalonada) y `.ub-collapse` (despliegue
  grid 0fr→1fr) en `main.css`; Chart.js a 650 ms `easeOutQuart`. Solo opacidad/transform;
  todo se apaga con `prefers-reduced-motion`.
- "Citas completadas del mes": el backend arma 12 tramos de 3 días que pasan al mes
  siguiente; la web quita los tramos futuros en vez de dibujarlos en 0.
- Pendientes: Ingeniero, `MembershipCard` (colores por nivel, se dejó a propósito) y la app.
- Títulos fieles al backend: `incomeChart` = 8 semanas; `clientTrends` = citas
  completadas del mes en tramos de 3 días (no "clientes").
- Pruebas: `e2e/dashboard-admin.spec.ts`, `e2e/dashboard-reception.spec.ts`, datos en
  `e2e/support/dashboard-fixtures.ts`. Para abrir el dashboard con `page.route` se entra
  por otra página y se hace clic en el enlace a `/dashboard` (en SSR no aplica el mock).
- `UiStatCard` con enlace: resolver `NuxtLink` en el script; `resolveComponent` dentro de la
  plantilla dejaba la tarjeta sin enlace.

## 6. Validación antes de entregar

```powershell
npx eslint <archivos tocados>
npm run build                # ESLint NO detecta expresiones inválidas en la plantilla
                             # (p. ej. un `if` dentro de @error): solo el build las ve
npx playwright test          # usa build de producción; si el build local pasa de 180 s,
                             # correr con una config temporal que solo suba el timeout
```
- Prueba E2E del componente (teclado + valor enviado) cuando cambia un flujo con API.
- Capturas en los 4 temas y a 375 px de ancho del lugar cambiado.
- Mensaje de commit en español; la IA no hace commit ni push.
