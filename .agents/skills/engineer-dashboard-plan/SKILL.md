---
name: engineer-dashboard-plan
description: CERRADO (2026-09-06) — dashboard real para el rol ingeniero ("dashboard de cada módulo", solo lectura), rediseño de /system, y pulido visual del sidebar (AppSidebar.vue). Leer antes de tocar DashboardController::ingenieroPayload() en barber, app/components/dashboard/Ingeniero.vue, app/pages/system/index.vue o app/components/shell/AppSidebar.vue en frontend-urban.
---

# Dashboard del rol ingeniero + pulido de sidebar — plan

## Contexto

El dueño del proyecto pidió (2026-09-06) inspirarse en un template de
referencia (Spike Admin, Nuxt/Vuetify) para el sidebar y, sobre todo,
para el panel del rol `ingeniero` — que quería como "un dashboard de
cada módulo", a diferencia de los demás roles que tienen "módulos con
funciones" (pantallas operativas de CRUD).

**Aclaración importante que costó dos rondas de pregunta**: "ingeniero"
no era un rol nuevo por crear — ya existía por completo (backend +
`/system`), construido en `stripe-and-ops-role-plan` (ver ese SKILL.md
en este mismo repo). Lo que faltaba era su `/dashboard`: `DashboardController::index()`
no tenía ninguna rama para `ingeniero` y caía al catch-all
`'role' => 'guest', 'data' => []`, así que el frontend mostraba el
mensaje genérico de "rol no migrado".

## Auditoría (2026-09-06)

- El sidebar (`AppSidebar.vue`) ya tenía la misma *estructura* que Spike
  (secciones colapsables, ítem activo resaltado, tarjeta de usuario con
  logout abajo) — no hacía falta rehacerlo, solo pulirlo.
- Los otros 4 roles (Admin, Recepcionista, Barbero, Cliente) **ya tienen
  gráficas** en su dashboard (`vue-chartjs` + `app/utils/chartTheme.ts`,
  theme-aware por los 4 temas) — no era un hueco vacío.
- `/system/index.vue` (única página real de `ingeniero` antes de este
  plan) eran KPIs planos + una tabla, sin una sola gráfica, a pesar de
  que la infraestructura de charts ya existía y se usa mucho en
  `Administrador.vue`.

## Decisión de alcance: reusar datos, no PII operativa

`ingenieroPayload()` (nuevo, en `DashboardController.php`) reusa
`DashboardService::adminMetrics()` — el mismo dato que ya usa Admin,
cacheado — pero **a propósito omite** `todayAppointments`/
`recentAppointments`, que exponen nombres de clientes individuales. Esto
sigue el mismo criterio que ya se aplicó al backend/rutas de este rol
(guardrail #24 en `urbanblade-guardrails`, `barber`): módulo/comportamiento
agregado sí, datos operativos de clientes no. `barberPerformance`/
`top_barber_name` sí se incluyen — son nombres de personal, no de
clientes, y ya son visibles vía Reportes de todos modos. Test nuevo
(`DashboardApiTest::test_ingeniero_gets_the_module_dashboard_payload_without_client_pii`)
fija esta invariante con `assertJsonMissingPath`.

## Qué se construyó

1. **Backend** (`barber`): rama `ingeniero` en `DashboardController::index()`
   + método `ingenieroPayload()`. Sin cambios de rutas/permisos — `/dashboard`
   ya era accesible para cualquier rol autenticado.
2. **`DashboardIngeniero.vue`** (nuevo, `app/components/dashboard/Ingeniero.vue`):
   una tarjeta por módulo (Citas, Ingresos, Servicios, Barberos, Clientes,
   Chatbot), cada una con su KPI + una mini-gráfica (Line/Bar/Doughnut,
   mismos componentes que Admin), badge "Solo lectura" en el header, y
   enlaces a Reportes/Logs/Estado del Servidor en vez de acciones de
   gestión. Deliberadamente sin lista de citas ni botones de acción —
   distinto en estructura informativa a `Administrador.vue`, no una copia.
3. **`/system` rediseñado**: las tarjetas de Mongo/Redis pasan de texto
   plano a un indicador circular con pulso (verde activo/rojo caído,
   `animate-ping`), tarjetas con el mismo `rounded-2xl border-ink/[0.06]
   bg-card` que el resto del nuevo dashboard. La tabla de tareas
   programadas se queda igual (ya funcionaba bien).
4. **Sidebar pulido** (`AppSidebar.vue`, afecta a los 5 roles por igual):
   ítem activo ahora con barra de acento dorada a la izquierda +
   `rounded-xl` (antes `rounded-lg` liso), tarjeta de usuario del pie con
   su propio borde/fondo `bg-panel` en vez de flotar sobre el fondo del
   sidebar. **Deliberadamente NO se copió el blanco de Spike** — seguimos
   con los 4 temas propios (oro sobre negro por defecto), solo se tomó la
   estructura/pulido visual de la referencia.

## Verificación (2026-09-06)

Backend: `.\test.ps1` en verde (340 tests, +1), `pint --test` limpio.
Frontend: `npm run lint` y `npm run build` verdes. Verificado en vivo en
un **build de producción real** (mismo criterio que `landing-page-plan`,
tras el bug de reveal-on-scroll encontrado ahí) con una cuenta
`ingeniero` real creada para la prueba (login real, token Bearer real):
sidebar muestra exactamente Principal/Análisis(Reportes+Logs)/Sistema
— nada de Operación/Gestión —, el dashboard nuevo renderiza los
módulos con datos reales donde existen (chatbot: 32 eventos reales) y
estado vacío elegante donde no, `/system` muestra Mongo/Redis con el
nuevo indicador de pulso. Cuenta de prueba **eliminada** después de
verificar (no se dejó en la base real) — si el usuario quiere una cuenta
`ingeniero` permanente para pruebas futuras, pedirla explícitamente y
documentarla en `docs/ACCESOS.md` como las otras 4. Confirmado también
que el dashboard de Admin sigue sin regresiones (mismo `adminPayload()`,
sin tocar).

## Fase 5 — cerrada (2026-09-06, misma sesión, tras feedback del usuario)

- **Sidebar**: el primer pase (barra de acento + tarjeta de usuario en
  caja) fue señalado como insuficiente ("te falta lo del sidebar") —
  se hizo un segundo pase más decidido: ítem activo como píldora sólida
  completa (`bg-gold/15` + texto dorado en negritas, sin borde
  izquierdo), encabezados de sección más chicos/tenues, más aire en
  general, tarjeta de usuario simplificada a un simple hover en vez de
  caja con borde. Commit `324b725`.
- **Anillo de progreso (Cliente)**: ya existía (`conic-gradient` de
  nivel de lealtad en `Cliente.vue`, línea ~314) — no se duplicó.
- **Barras cápsula (Recepción)**: `Recepcion.vue` era el único dashboard
  sin variedad de gráficas (solo una Line) — "Flujo Operativo" pasó de
  `<Line>` a `<Bar>` con `borderRadius: 999` y grosor fijo, mismo
  patrón visual que la tarjeta de pagos del template de referencia.
  Commit `6794eed`.

Con esto, las 4 fases + la fase 5 del plan original quedan completas.
