---
name: nuxt-migration-plan
description: Plan y arquitectura para desacoplar el frontend de UrbanBlade de Laravel/Inertia hacia Nuxt 4 como SPA/hybrid separado, consumiendo la API JSON ya existente en el repo barber. Leer antes de tocar cualquier página, layout o llamada a la API en este repo.
---

# Migración de frontend a Nuxt — plan y arquitectura

## Contexto y decisión

El equipo (con recomendación de un profesor de asignatura) decidió desacoplar el
frontend del backend Laravel. El backend (`barber`, repo
`https://github.com/KikeGonRam/barber.git`) acababa de terminar una migración
completa de Blade+Alpine a **Inertia.js + Vue 3** (7 fases, mergeada a `main`,
ver `.claude/skills/inertia-vue-migration/SKILL.md` en ese repo). El usuario
sentía el frontend "demasiado lento" y el equipo, tras evaluar Next.js vs otras
opciones, **decidió Nuxt** — la recomendación dada fue precisamente Nuxt sobre
Next.js porque el equipo ya tiene inversión real en componentes Vue 3
(layouts, dashboards, Calendar.vue, chart-theme.js) de la migración Inertia
recién terminada; reescribir todo eso en React/Next hubiera sido trabajo
duplicado sin necesidad.

Este repo (`frontend-urban`, remoto
`https://github.com/KikeGonRam/frontend_Urbanblade.git`) es un **proyecto
Nuxt 4 completamente separado** del repo `barber`. Laravel deja de servir
vistas: se convierte en API pura. Este repo consume esa API vía HTTP.

**IMPORTANTE — antes de escribir código de páginas/auth**: releer
`app/Http/Controllers/Dashboard/DashboardController.php`,
`app/Http/Controllers/Api/Dashboard/DashboardController.php`,
`app/Services/Dashboard/DashboardService.php`, `routes/api.php`,
`app/Http/Controllers/Api/AuthController.php`, `app/Models/User.php`
(método `issueMobileApiToken`) y
`app/Http/Middleware/AuthenticateMobileApiToken.php` en el repo `barber` —
son la fuente de verdad real, no la memoria de este documento. Este plan
puede quedar desactualizado si el backend cambia después de escribirlo.

## Decisión de auth: reusar el sistema de tokens existente, NO Sanctum

El repo `barber` ya tiene un sistema de auth por Bearer token **propio**
(no Sanctum, no cookies de sesión), construido originalmente para la futura
app nativa Android y ya reusado en producción por el dashboard admin (flujo
de predicciones IA en `Administrador.vue`):

- Tabla `mobile_api_tokens`, tokens hasheados con SHA-256 (nunca en texto
  plano en DB).
- `User::issueMobileApiToken(string $name, ?array $abilities, ?Carbon $expiresAt): array`
  devuelve `['token' => <token en texto plano, solo una vez>, 'token_model' => Token]`.
- Middleware `App\Http\Middleware\AuthenticateMobileApiToken` (alias
  `mobile.auth` en `bootstrap/app.php`) valida el header `Authorization:
  Bearer <token>` y autentica al usuario resuelto sobre el guard `web` para
  el resto del request.
- `routes/api.php` ya expone, **sin requerir sesión previa**:
  `POST auth/login`, `POST auth/register`, `POST auth/logout`,
  `POST auth/refresh-token`, `GET auth/me`, `POST auth/forgot-password`,
  `POST auth/reset-password` — login público, el resto protegido con
  `mobile.auth`.

Esto es exactamente lo que un SPA/Nuxt externo necesita: login público que
devuelve un token, sin depender de cookies de sesión ni CSRF de Laravel.

**Decisión: Nuxt guarda el token en memoria/Pinia + `localStorage` (o
`useCookie` no-httpOnly si se prefiere persistencia entre pestañas) y lo
envía como `Authorization: Bearer <token>` en cada request a la API.** No se
usa el modo "Sanctum SPA" (cookies same-site + CSRF) — evita toda la
complejidad de cookies cross-origin y mantiene una única estrategia de auth
compartida con la futura app Android.

Consecuencia en el lado Laravel: hay que publicar y configurar
`config/cors.php` (no existe aún en `barber` — nunca se publicó) para
permitir el origen de Nuxt (dev: `http://localhost:3000`; prod: dominio
TBD) sobre `api/*`. Como no se usan cookies, `supports_credentials` puede
quedar en `false` — política CORS más simple.

## Brecha detectada: los endpoints de dashboard devuelven datos crudos

`Api/Dashboard/DashboardController::index()` ya reusa los MISMOS métodos de
`DashboardService` (`adminMetrics()`, `barberMetrics($barberId)`,
`receptionistMetrics()`, `clientMetrics($clientId)`) que se usaron para
construir los 4 dashboards Inertia — pero devuelve la salida cruda del
servicio (`{'role': ..., 'data': ...}`), **sin** la curación que sí se hizo
para Inertia: sin flags `isNext`, sin fechas ya formateadas en español, sin
`AnalyticsInsight::toDashboardCardArray()`.

**Decisión (consistente con el principio ya establecido en toda la sesión
de mantener lógica de negocio/presentación en el servidor, no duplicarla en
el cliente): enriquecer los controladores API para que devuelvan los mismos
campos computados que ya arma la versión Inertia**, en vez de recalcularlos
en JS/Nuxt. Esto significa tocar `Api/Dashboard/DashboardController.php` (o
extraer un mapper compartido reusable desde el controlador Inertia) en el
repo `barber` como parte de cada fase de este plan — no es trabajo
exclusivo de este repo.

## Decisión de rendering: híbrido

- Páginas públicas (landing, catálogo de servicios, perfiles de barbero) se
  benefician de SEO → **SSR/SSG** vía `routeRules` de Nuxt
  (`{ prerender: true }` o `{ ssr: true }` según cuánto cambien).
- Área autenticada (los 4 dashboards + calendario + todo lo demás detrás de
  login) no tiene beneficio de SEO y añade complejidad de auth en SSR (el
  token vive en el cliente) → **SPA/CSR** (`{ ssr: false }` en esas rutas).

Esto se decide en fase 1 (nuxt.config.ts) y se puede ajustar; no es
irreversible, pero conviene fijarlo antes de escribir páginas para no
rehacer trabajo.

## Qué se puede reusar tal cual (o casi) de la migración Inertia

Los componentes Vue 3 creados en `barber/resources/js/` durante la
migración Inertia son, en su mayoría, Vue puro — solo dependen de Inertia
para: `usePage()` (props del servidor), `<Link>`/`router.visit` (navegación)
y `route()` de Ziggy (nombres de ruta). Al portar a Nuxt:

| Pieza Inertia | Equivalente Nuxt |
|---|---|
| `usePage().props` | composable propio (`useAuth()`, `useDashboard()`) que hace `$fetch` a la API con el Bearer token |
| `<Link href="...">` | `<NuxtLink to="...">` |
| `router.visit(...)` / `router.post(...)` | `navigateTo(...)` + `$fetch` directo a la API |
| `route('nombre.ruta')` (Ziggy) | constantes de rutas API hardcodeadas o un helper simple (no hay Ziggy sin Blade) |
| middleware `auth`/`verified` de Laravel | `definePageMeta({ middleware: 'auth' })` (middleware de Nuxt que verifica el token) |
| CSRF (`@csrf`, XSRF cookie) | irrelevante — Bearer token en JSON API, sin cookies |

Componentes candidatos a portar casi sin cambios de lógica interna (solo
cambia cómo reciben sus props/datos): `AppLayout.vue`, `DashboardHeader.vue`,
`AnalyticsInsights.vue`, `AnalyticsCta.vue`, `MembershipCard.vue`,
`chart-theme.js`, `Calendar.vue`, y las 4 páginas de dashboard
(`Recepcion.vue`, `Barbero.vue`, `Cliente.vue`, `Administrador.vue`).

## Fases (mismo espíritu incremental que funcionó en la migración Inertia)

0. **Confirmar decisiones de esta sección con el usuario si se desvían**
   (rendering mode, dónde vive el token) — de lo contrario, proceder con los
   defaults documentados arriba.
1. ✅ **DONE** — Scaffold + identidad visual: Nuxt 4 + `@nuxtjs/tailwindcss`,
   4 temas portados 1:1 (`app/assets/css/main.css`, `tailwind.config.ts`),
   `useTheme()` (cookie `ub_theme` + script anti-flash en `nuxt.config.ts`).
   Verificado en vivo: cambio de tema, persistencia, sin flash al recargar.
2. ✅ **DONE** — Auth: `app/composables/useAuth.ts` (login/me/logout contra
   `POST /api/v1/auth/login`, `GET /api/v1/auth/me`, `POST /api/v1/auth/logout`
   — `refresh-token` aún no consumido, queda para cuando haya necesidad real
   de renovar sesión), `app/composables/useApi.ts` (fetch autenticado
   genérico + manejo de 401), middleware `auth`/`guest`
   (`app/middleware/`), `pages/login.vue`, `pages/dashboard/index.vue` (smoke
   test). Token en cookie `ub_token` (no httpOnly — sin BFF que la esconda).
   `config/cors.php` publicado y configurado en `barber`
   (`CORS_ALLOWED_ORIGINS`, default `http://localhost:3000`,
   `supports_credentials: false`). Verificado en vivo end-to-end contra la
   API real: login con cuenta `cliente@urbanblade.mx`, persistencia tras
   reload, logout, guard `auth` (redirige a `/login?redirect=...`
   preservando destino), guard `guest` (ya autenticado → `/dashboard`).
3. ✅ **DONE** — Shell/layout compartido: `app/components/shell/`
   (`AppSidebar` con rail colapsable + acordeón, `MobileTopbar`,
   `MobileBottomNav`, `MobileDrawer`), `useNavigation()` (mismas secciones
   por rol que `NavigationMenu::sections()`, mapeadas a rutas propias de
   este repo — items sin página propia se muestran deshabilitados con
   badge "Próx." en vez de linkear a un 404), `useShellState()`
   (rail/acordeón persistidos en localStorage), `layouts/dashboard.vue`.
   Verificado en vivo: colapso/expansión del rail, acordeón, iconos,
   resaltado de ruta activa, topbar/bottom-nav/drawer móvil, logout desde
   sidebar y desde el drawer. Bug real encontrado y corregido en el camino:
   `NavIcon.vue` vive en `components/shell/`, así que Nuxt lo autorregistra
   como `ShellNavIcon`, no `NavIcon` — usar el nombre corto renderizaba un
   custom element vacío en vez del ícono.
4. ✅ **DONE** — Dashboard Recepcionista: `Api/Dashboard/DashboardController`
   enriquecido en `barber` con el mismo shape curado que la vista Inertia
   (kpis/nextAppointments/pendingOrders/flowChart/sparkHighlights) — cubierto
   por `tests/Feature/DashboardApiTest.php` (la capa API no tenía tests
   antes). `components/dashboard/{DashboardHeader,AnalyticsInsights,
   AnalyticsCta,Recepcion}.vue` + `utils/chartTheme.ts` +
   `plugins/chart.client.ts` (Chart.js, colores leídos de las variables CSS
   del tema en vez de blanco fijo como el original — aquí los 4 temas son
   reales). `pages/dashboard/index.vue` hace `GET /dashboard` y enruta por
   `role`; roles sin fase propia todavía ven un aviso que apunta de vuelta a
   la versión Inertia. Verificado en vivo con la cuenta recepcionista real,
   en tema claro y oscuro — KPIs y estados vacíos correctos (la BD real
   está en cero tras el wipe, así que 0/$0 en todo es el resultado
   esperado, no un bug). Gotcha real encontrado y corregido en el camino:
   la enriquecida rompió Larastan en CI (el mismo patrón de propiedades
   dinámicas de Eloquent+Mongo que ya estaba baseline en la versión Inertia
   de este controlador no lo estaba aquí) — agregadas las 7 entradas
   correspondientes a `phpstan-baseline.neon`.
5. ✅ **DONE** — Dashboard Barbero: mismo tratamiento que recepcionista en
   `Api/Dashboard/DashboardController` (método `barberPayload()`, mismas
   entradas de `phpstan-baseline.neon` ampliadas — no duplicadas, mismo
   archivo). `components/dashboard/Barbero.vue` con Bar+Doughnut de
   Chart.js. Aprobar/Rechazar llaman directo a
   `PATCH /api/v1/appointments/{id}/status` vía `useApi()` — sin CSRF que
   rodear (Bearer auth), más simple que el `<form>` nativo que usaba la
   versión Inertia por necesidad, no una limitación aquí. `kpis.rating`
   sigue hardcodeado a 4.9 en `DashboardService::buildBarberMetrics()` —
   bug preexistente conocido, otra sesión ya lo está arreglando en paralelo
   (ramas `claude/frosty-ptolemy-cc74c6`/`elastic-elion-ec69a1` en
   `barber`); no tocar ese cálculo desde aquí para no pisar ese trabajo.
   Verificado en vivo con la cuenta barbero real, ambos temas — KPIs y
   estados vacíos correctos; el flujo de aprobar/rechazar NO se probó
   clic-a-clic porque `barber_db` no tiene citas reales ahora mismo y crear
   una sintética escribiría en el Atlas compartido real (contra las
   guardrails del proyecto) — sí reutiliza el mismo `apiFetch()` ya probado
   para `/dashboard` y `/auth/me`. Bug real encontrado y corregido:
   `UB_CATEGORICAL` se usaba en `Barbero.vue` pero nunca se exportó desde
   `utils/chartTheme.ts` — rompía toda la página con un error de Vite HMR,
   y como el crash pasaba en la navegación posterior al login, el síntoma
   visible era "el login falla" aunque `POST /auth/login` sí devolvía 200.
6. ✅ **DONE** — Dashboard Cliente: `clientPayload()` en el backend (sin
   cambios de `phpstan-baseline.neon` — `clientMetrics()` ya devolvía
   arrays curados para `next_appointment`, a diferencia de recepción/
   barbero). `components/dashboard/{Cliente,MembershipCard}.vue` —
   `MembershipCard` portado casi verbatim (tilt 3D, flip a QR, contador de
   puntos, confetti al subir de nivel), `member.downloadUrl` siempre
   `null` (la tarjeta PDF vive en una ruta Blade que no existe aquí).
   Verificado en vivo con la cuenta cliente real, ambos temas — QR real
   generado por `MemberCardService`, flip de tarjeta, anillo de progreso.
   Dos bugs reales encontrados y corregidos:
   - El backend nunca mandaba `sparkHighlights` para cliente (igual que la
     versión Inertia, que depende del default de prop de Vue para este rol
     específico) pero la interfaz TS de Nuxt lo declaraba requerido —
     tumbaba la página entera con un 500. Se volvió opcional con
     `?? []` en el template, mismo patrón que se reforzó en
     `AnalyticsInsights.vue` para cualquier consumidor futuro.
   - La grilla de beneficios y el track del anillo de lealtad usaban
     `rgba(255,255,255,...)` fijo del original — invisible en el tema
     claro "libreta". Corregido con `currentColor` + clases Tailwind y
     `inkRgba()` de `utils/chartTheme`.
7. ✅ **DONE** — Dashboard Administrador + `Calendar.vue`:
   - `adminPayload()` en el backend (kpis, 4 gráficas, agenda de hoy,
     actividad reciente, `analysisInsights()` portado tal cual — mismo
     cache key `dashboard_insights` que la versión Inertia, comparten el
     cómputo). Se omiten a propósito `maintenanceMode` y los botones de
     mantenimiento/backup del header (rutas Blade que no existen aquí).
     Las predicciones IA NO pasan por este endpoint: se llaman directo
     desde el frontend a `/api/v1/admin/predictions/*` con el Bearer
     token real que ya trae la sesión — más simple que el puente
     `getWebApiToken` que necesitaba la versión Inertia (esa corre bajo
     sesión web).
   - `components/dashboard/Administrador.vue`: KPIs con sparkline,
     insights de negocio, panel con 3 tabs (actividad/estaciones en
     vivo/top del mes), sección "Analítica avanzada" plegable (4
     gráficas + predicciones IA + telemetría chatbot). Verificado en vivo
     con la cuenta admin real en ambos temas — la pestaña "Estaciones"
     mostró datos reales (0 ocupados, 1 libre, el único barbero real), y
     las 3 llamadas a `/admin/predictions/*` devolvieron 200 con datos
     reales.
   - **Nuevo endpoint backend**: `GET /api/v1/appointments/calendar-data`
     (no existía ni como API antes — solo como ruta web con sesión +
     permiso `citas.gestionar`). Restringido por rol
     administrador/recepcionista vía Bearer token. Cubierto por
     `AppointmentCalendarApiTest`.
   - `pages/appointments/calendar.vue`: FullCalendar 6.1.21 (misma
     versión pinneada que `barber`), filtro por barbero, modal de detalle
     al hacer clic. Nuevo middleware `staff` (admin/recepcionista) que
     hace `fetchMe()` si el usuario aún no cargó — a diferencia de
     `/dashboard`, esta página puede ser el punto de entrada directo.
     El tema de FullCalendar se reescribió con las variables CSS del
     sistema de temas en vez de los hex fijos del original (mismo fix que
     charts/lealtad, aplicado aquí también). `useNavigation.ts` ya marca
     `/appointments/calendar` como `implemented: true`.
   - Bug real encontrado y corregido: `GET /barbers` (para el dropdown de
     filtro) devuelve `{data: [...]}` con el nombre anidado en
     `user.name`, no un array plano con `name` — el dropdown quedaba
     vacío en silencio hasta corregirlo.
   - Esto cierra las fases 1-7 del plan (todo el alcance de dashboards +
     calendario).
8. ✅ **DONE** — ESLint + CI de este repo: `@nuxt/eslint` (config plana
   autogenerada a partir del propio proyecto — ya incluye
   `vue/multi-word-component-names: off` para pages/layouts/componentes
   por convención de Nuxt, confirmado forzando la regla a 'error' y
   viendo que sí marcaba `Administrador.vue`/`Cliente.vue`/etc. antes de
   volver a 'off'). Un solo warning real (`vue/no-v-html` en
   `ShellNavIcon`), silenciado puntualmente con comentario — el `paths`
   viene de literales propios en `useNavigation.ts`, nunca de input de
   usuario. `typescript` fijado a `^5.7` (el install por default trajo
   TS 7.0, que `typescript-eslint` todavía no soporta).
   `.github/workflows/ci.yml`: lint + build + `npm audit
   --audit-level=high`, mismo shape que el job de frontend en `barber`.
   Primer run de CI de este repo confirmado en verde (`gh run view --log`
   revisado línea por línea, no solo el estado "success").
9. **Expansión fuera del scope de los 4 dashboards.** A diferencia de las
   fases 1-7, aquí NO hay una página Inertia/Vue de referencia que portar
   — citas, clientes, pagos, pedidos, inventario, servicios y usuarios
   siguen siendo Blade puro en `barber` (nunca migrados en la fase
   Inertia; confirmado: `resources/views/{appointments,clients,payments}/
   index.blade.php` existen, `resources/views/{Pages/Appointments,
   Pages/Clients}` de Inertia no). Esto es trabajo de diseño/construcción
   más original que las fases anteriores, no solo una traducción Vue→Vue.
   Orden recomendado (de menor a mayor complejidad/riesgo, mismo criterio
   que llevó a hacer recepcionista antes que admin en las fases 4-7):
   - ✅ **DONE — 9.1 Clientes** (admin): `pages/clients/index.vue` — lista
     con búsqueda + filtro de segmento (vip/nuevo/activo/inactivo,
     calculado por `ClientSegmentService` en `barber`), paginación,
     crear/editar (modal) y eliminar. Middleware nuevo `admin` (solo
     administrador — más estricto que `staff`). Las tarjetas de resumen
     usan la segmentación real de la API en vez de los 4 contadores del
     Blade original (total/con_citas/sin_citas/este_mes), que esta API no
     expone. Verificado en vivo con la cuenta admin real, ambos temas:
     crear, editar (200 confirmado por red) y eliminar (verificado por
     curl directo — el `confirm()` nativo viene deshabilitado en el
     navegador sandbox de esta sesión, "returned false to the page").
     **Bug real encontrado y corregido — aplica a TODA la fase 9, no solo
     Clientes**: `Client`, `Barber` y `Service` usan el trait `HasSlug`
     (`app/Traits/HasSlug.php` en `barber`), que sobreescribe
     `getRouteKeyName()` a `'slug'`. Las rutas `PUT`/`DELETE
     .../{client|barber|service}` en `barber` ligan por **slug**, no por
     `id` — aunque el payload de la API incluya ambos campos y `id` sea lo
     más natural de usar a simple vista. Usar `id` para esas URLs da un
     404 real ("No query results for model") incluso con el registro
     recién creado y confirmable por `Model::find($id)` en tinker — la
     inconsistencia está en qué campo usa el *route binding*, no en si el
     registro existe. **Antes de construir cualquier página que edite/
     borre un `Client`, `Barber` o `Service` real, revisar si el modelo
     usa `HasSlug` y armar la URL con `.slug`, no con `.id`.** Otros
     modelos (`Appointment`, `Payment`, `Order`, `Product`, `User`) no
     tienen este trait — para esos, `id` sigue siendo correcto, pero
     conviene grep-ear `use HasSlug` en el modelo antes de asumirlo.
   - ✅ **DONE — 9.2 Citas** (admin/recepción): `pages/appointments/index.vue`
     — lista (hasta 50 más recientes, filtros por estado/barbero vía nuevos
     query params en `GET /api/v1/appointments`), crear (modal con
     buscador de cliente tipo "buscar y seleccionar", selects de
     barbero/servicio, fecha/hora, notas) y editar (mismo modal, incluye
     cambiar `estado` a cualquiera de los 6 valores — `update()` en
     `barber` no impone máquina de estados, a diferencia de
     `PATCH .../status` que sí la tiene). Se omiten a propósito las 4
     tarjetas de resumen del Blade original (Total/Hoy/Pendientes/
     Completadas): la API solo devuelve hasta 50 citas recientes, así que
     un "Total" calculado sobre ese subconjunto sería un número fabricado,
     no un agregado global real — decisión de correctness, no un olvido.
     Nuevo endpoint backend `GET /api/v1/appointments/calendar-data` (fase
     7) ahora tiene destino real: `calendar.vue` agrega un link "Editar
     Cita" a `` `/appointments?edit=${id}` ``, y `appointments/index.vue`
     lee ese query param en `onMounted` para abrir el modal de edición
     pre-rellenado. Middleware `staff` reusado (mismo admin/recepcionista
     que el calendario).
     **Bug real encontrado y corregido — mismo patrón que el de 9.1 pero
     con OTRO trait**: `Appointment` no usa `HasSlug`, usa
     `HasPublicCode` (`app/Traits/HasPublicCode.php` en `barber`), que
     sobreescribe `getRouteKeyName()` a `'code'`. Usar `.id` en las URLs
     de `PUT`/`PATCH .../status` da el mismo 404 fantasma que ya se vio
     con `Client` — confirmado con un test PHPUnit desechable
     (`DebugRouteBindingTest`, creado solo para diagnosticar, borrado tras
     confirmar la causa) que reprodujo el 404 mientras `Appointment::find($id)`
     sí encontraba el registro. Esto además reveló que **`Barbero.vue` de
     la fase 5 llevaba este mismo bug roto en producción desde que se
     escribió** (`setStatus()` usaba `appt.id` para
     `PATCH /appointments/{id}/status`) — nunca se detectó porque en ese
     momento `barber_db` no tenía citas reales con las que probar
     clic-a-clic. Corregido en ambos lugares: `Barbero.vue` (`setStatus()`
     ahora recibe el objeto `BarberPending` completo y usa `.code`,
     `:disabled` sigue comparando por `.id` para el estado de carga) y
     `appointments/index.vue`. Confirmado exhaustivamente por
     `grep -rl getRouteKeyName app/Models app/Traits` en `barber`: **solo
     existen estos dos traits en todo el repo** (`HasSlug` → `Client`,
     `Barber`, `Service`; `HasPublicCode` → solo `Appointment`) — `Payment`,
     `Order`, `Product`, `User` no tienen ninguno, así que `.id` sigue
     siendo correcto para las fases 9.3+ sin necesidad de re-verificar cada
     vez.
     Cambios en `barber`: `barberPayload()` ahora incluye `code` en
     `barberToday`/`barberPending` (antes solo mandaba `id`, inútil para
     el PATCH real); filtros `estado`/`barber_id`/`fecha` agregados a
     `AppointmentController::index()` (100% aditivo, sin params = mismo
     comportamiento que antes); nueva entrada de `phpstan-baseline.neon`
     olvidada en el primer push (`tests/Feature/DashboardApiTest.php`
     accede a `$pendingAppointment->code` directo) — CI la agarró porque
     el Larastan local no la mostraba entre sus ~108 falsos positivos
     preexistentes; corregida y confirmada en verde con una segunda
     corrida completa de `.\test.ps1` + `pint --test` + Larastan local
     antes de repush. Verificado en vivo con la cuenta recepcionista real:
     como `barber_db` no tenía servicios reales (colección vacía tras el
     wipe), se creó un servicio de prueba claramente etiquetado
     (`"TEMP TEST SERVICE (borrar)"`) vía tinker, se usó para probar
     crear → editar (cambio de estado a "Confirmada") → el deep-link
     "Editar Cita" desde el calendario, y se borró junto con la cita de
     prueba inmediatamente después — mismo patrón que la limpieza de datos
     sintéticos de la fase 9.1.
   - ✅ **DONE — 9.3 Pagos** (admin/recepción): `pages/payments/index.vue`
     — historial con filtros (búsqueda + método + barbero + rango de
     fecha), tarjetas de stats (hoy/mes/total/por método) y el flujo
     "Nuevo Cobro" completo: selector de citas cobrables (nuevo
     `GET /appointments/chargeable`, puerto de la consulta que usaba
     `Payment\AppointmentController::create()`, web) con preview de
     descuento de nivel + canje de puntos + premio de rifa
     (`utils/loyaltyCharge.ts`, puerto directo de
     `resources/js/loyalty-charge.js`), tres métodos de pago (efectivo/
     transferencia/tarjeta beta vía Stripe Elements). `pages/payments/
     pending.vue` — revisión de comprobantes de transferencia
     (aprobar/rechazar), antes solo alcanzable como vista Blade con
     sesión. **El monto nunca se calcula en el frontend para cobrar**:
     el preview de lealtad es solo para que el staff vea el desglose —
     lo que se manda a `POST /payments` es el precio base de la cita
     (igual que el input readonly del Blade original), y
     `PaymentService::create()` en `barber` vuelve a calcular todo del
     lado servidor (guardrail #13 de ese repo), igual que ya hacía el
     intento de Stripe.
     Nuevos endpoints en `barber`: `GET /appointments/chargeable`,
     `GET /payments/pending`, `POST /payments/{id}/approve|reject`;
     `GET /payments` ganó filtros (`q`/`barbero_id`/`fecha_desde`/
     `fecha_hasta`, aditivo) y `stats`/`pending_count` en `meta`.
     Cubierto por `tests/Feature/AppointmentChargeableApiTest.php` y
     `tests/Feature/PaymentApiTest.php`.
     **Bug real encontrado y corregido — nueva categoría, no la del
     route-key**: `Payment::$monto`/`$propina` usan el cast `decimal:2`
     de Laravel, que **siempre serializa como string** (`"225.00"`) para
     no perder precisión — sumar dos de esos campos con el operador `+`
     de JS concatena en vez de sumar (`"225.00" + "0.00"` →
     `"225.000.00"`), y `Number(...)` de esa cadena da `NaN`. La tabla
     de historial mostraba literalmente "$NaN" como total hasta
     corregirlo envolviendo con `Number()` antes de sumar y tipando esos
     campos como `string` en las interfaces TS (no `number`) para que no
     vuelva a colarse. **Cualquier campo de un modelo de `barber` con
     cast `decimal:2` (buscar `'campo' => 'decimal:2'` en el modelo) hay
     que tratarlo como string en Nuxt** — `fmtMoney()`/mostrarlo solo
     funciona porque `Number()` internamente lo parsea bien; el peligro
     es la aritmética directa entre dos de esos campos.
     Verificado en vivo con la cuenta recepcionista real: como
     `barber_db` no tenía citas cobrables ni servicios reales, se creó
     un cliente+servicio+cita+premio de rifa temporales claramente
     etiquetados ("TEMP TEST ... (borrar)") vía tinker para ejercer el
     flujo completo (selección, descuento VIP 10%, canje de 20 puntos,
     toggle de premio de rifa a $0, cobro real en efectivo → aparece en
     el historial con stats actualizadas), y se borraron todos los
     registros temporales inmediatamente después — mismo patrón que
     9.1/9.2. El cobro con tarjeta (Stripe) se dejó construido para
     paridad con el Blade original pero **no se pudo verificar en vivo**:
     tanto `barber/.env` como el nuevo `frontend-urban/.env` solo tienen
     la clave pública placeholder (`pk_test_REEMPLAZAR_...`), igual que
     ya pasaba en el formulario Blade equivalente — no es una regresión
     de esta fase.
     Gotcha de entorno (no de código) encontrado en el camino: el
     servidor `nuxt dev` de este repo llevaba corriendo desde el inicio
     de la sesión (varias horas, sobrevivió la compactación de contexto)
     y entró en un estado corrupto de Vite (503s + "does not provide an
     export named" en módulos ya arreglados hace fases) justo después de
     `npm install @stripe/stripe-js` — instalar una dependencia nueva con
     el dev server corriendo invalida su cache de `optimizeDeps`. Se
     resolvió matando el proceso node en el puerto 3000 y arrancando
     `npm run dev` de nuevo; un `npm run build` limpio (sin errores)
     confirmó que el código en sí nunca estuvo roto, solo el estado del
     servidor de desarrollo.
   - **9.4 Pedidos** (bandeja de recepción + tienda/carrito del cliente):
     subsistema más grande, evaluar partir en sub-fases si crece mucho
     (recepción ve/gestiona pedidos; el cliente compra — catálogo, carrito,
     checkout).
   - **9.5 Inventario** (productos + movimientos, admin).
   - **9.6 Servicios + Usuarios** (admin) — CRUD ya con los patrones
     asentados de 9.1-9.5.
   - **9.7 "Mi Espacio" de barbero** (Mi Agenda, Mi Portafolio, Mi
     Horario, Mi Perfil).
   - **9.8 Autoservicio de cliente** (Mis Citas, Tienda, Carrito, Mis
     Pedidos, Nuestros Barberos, Mis Facturas) — el flujo de compra/reserva
     desde el punto de vista del cliente, subsistema propio.
   - **9.9 Reportes, Campañas, Sorteos, Logs, Configuración** (admin,
     menor frecuencia de uso) — al final.
   - **Analítica**: bloqueada por ahora — `resources/views/analytics/
     index.blade.php` en `barber` tampoco tiene versión Inertia/API propia
     todavía; retomar solo si `barber` construye esa base primero.
   Cada sub-fase sigue el mismo ciclo que 1-8: leer el Blade + el
   controlador API real de `barber` (nunca asumir el shape), enriquecer el
   endpoint API si expone modelos crudos en vez de campos ya formateados,
   escribir el test de API correspondiente, verificar en vivo con una
   cuenta real, actualizar este SKILL con lo aprendido.
10. **Retiro de las páginas Inertia** en `barber` — solo cuando Nuxt alcance
    paridad funcional confirmada; mientras tanto ambas pueden coexistir
    (Inertia como fallback) sin romper nada, ya que son rutas distintas.

## Guardrails específicos de esta migración

- **No mover tokens/contraseñas reales a este repo.** Las credenciales
  demo/reales de UrbanBlade viven solo en `barber/docs/ACCESOS.md`.
- **No asumir que `Api/Dashboard/DashboardController` sigue como se
  describe aquí** — este documento es un snapshot; verificar el archivo
  real antes de integrarlo.
- **CORS y cualquier cambio de forma de respuesta en `routes/api.php` /
  `Api/Controllers/**` afectan un contrato externo real** (ya usado o
  planeado por la futura app Android nativa) — cambios ahí deben ser
  aditivos, coordinados, y mantener `knuckleswtf/scribe` (`php artisan
  scribe:generate`) sincronizado, igual que ya aplica en `barber/CLAUDE.md`.
- **Node**: el entorno de desarrollo tiene Node v22.12.0, por debajo del
  mínimo que pide Nuxt 4.5.2 (`^22.19.0 || ^24.11.0 || >=26.0.0`) — produce
  warnings `EBADENGINE` pero el dev server funciona (verificado). Si algo
  falla de forma rara más adelante, revisar si es por esto antes de asumir
  otra causa.
- **`npm install` en este repo puede necesitar `--legacy-peer-deps`** por un
  bug conocido de npm 10.9.0 con el grafo de peer-dependencies de Nuxt 4
  (`Cannot read properties of null (reading 'edgesOut')` en arborist).
- Antes de cada push a este repo: `nuxt build` limpio (no hay PHPUnit/Pint
  aquí, es un repo JS puro). **`eslint` todavía no tiene config en este
  repo** (`npx eslint .` falla con "couldn't find eslint.config.js") —
  agregarlo es trabajo pendiente, no asumir que ya corre en CI de este repo
  porque tampoco existe todavía un workflow aquí (ver fase 8).
- Nunca commitear `.env`/`.env.*` (ya excluidos en `.gitignore`) — la URL
  base de la API (`NUXT_PUBLIC_API_BASE`) y cualquier clave van ahí.
- Cambios que tocan `barber` (CORS, enriquecer `Api/Dashboard/DashboardController`,
  etc.) siguen las reglas de ESE repo: `.\test.ps1` limpio antes de push
  (nunca `php artisan test` directo), Pint, confirmar CI real vía `gh run
  list`/`gh run view` — nunca asumir que pasó.
- **Enriquecer un método del `Api/Dashboard/DashboardController` que ya
  tenía su versión Inertia probablemente necesita entradas nuevas en
  `phpstan-baseline.neon`**: el patrón de propiedades dinámicas de
  Eloquent+MongoDB (`appt->client->user->name`, `appt->service->nombre`,
  campos de `Order`) ya está baseline para `Dashboard/DashboardController`
  (la versión Inertia) pero NO se propaga automáticamente al mismo código
  copiado a `Api/Dashboard/DashboardController` — ya causó un fallo real de
  CI en la fase 4 (commit `0758d25` → arreglado en `d854520`). Copiar las
  entradas de baseline análogas (mismo mensaje, mismo `identifier`, mismo
  `count`, solo cambia el `path`) en vez de regenerar el baseline completo
  localmente (`docker exec ... phpstan --generate-baseline` mete ruido de
  falsos positivos locales que no están en CI, per
  `feedback_local_phpstan_unreliable` en memoria).
- **Nuevos tests de `barber` que crean `User`/`MobileApiToken` con
  email/token fijos necesitan `tearDown()`**: `mongo-test` es un contenedor
  persistente en local (a diferencia del `mongo:7` efímero de CI) — sin
  limpieza, correr la misma prueba dos veces deja tokens con el mismo
  `token_hash` apuntando a usuarios distintos, y la prueba empieza a fallar
  con 401 de forma intermitente. Copiar el patrón de `tearDown()` de
  `ClientBarberReviewTest`/`DashboardApiTest`, no solo el de `setUp()`.
- **Un export faltante en un `.ts` compartido (`utils/chartTheme.ts`, etc.)
  no siempre truena donde se usa** — puede manifestarse como un error de
  Vite HMR en OTRA página (aquí: la navegación post-login a `/dashboard`
  crasheó, y el síntoma visible fue "el login no funciona" aunque el
  `POST /auth/login` real devolvía 200). Si un flujo falla de forma que no
  cuadra con el código que se tocó, revisar la consola del navegador antes
  de asumir que el bug está en el archivo que se acaba de editar.
- **Cada dashboard Inertia porteado puede tener campos que el controlador
  NUNCA envía para ese rol específico** (el prop se llena solo por el
  default de Vue) — no asumir que porque `defineProps` del original lo
  marca sin default explícito, el backend siempre lo manda. Revisar el
  controlador PHP real, no solo el `defineProps` del `.vue` original, y
  declarar esos campos opcionales (`campo?: Tipo`) en la interfaz TS de
  Nuxt en vez de requeridos — un campo requerido-pero-ausente no da error
  de TypeScript en runtime, tumba la página con un 500 real.
- **Cualquier color fijo tipo `rgba(255,255,255,...)`/blanco copiado de un
  componente original de barber es sospechoso aquí** — ese código asumía
  fondo siempre oscuro; con los 4 temas reales (uno de ellos claro,
  "libreta") un blanco a baja opacidad puede quedar invisible. Cambiar por
  `currentColor` + una clase Tailwind (`text-ink/25`, `text-gold`, etc.) o
  por `inkRgba()`/`goldHex()` de `utils/chartTheme.ts` en vez de copiar el
  valor literal. Ya pasó dos veces (charts en fase 1, tarjeta de lealtad en
  fase 6) — revisar visualmente en AMBOS extremos del set de temas (uno
  oscuro, "libreta"), no solo el default.
- **Nombres de componentes = ruta del archivo bajo `app/components/`**: un
  componente en `components/shell/NavIcon.vue` se autorregistra como
  `<ShellNavIcon>`, no `<NavIcon>` — usar el nombre corto no da error de
  build, solo un warning de Vue en consola ("Failed to resolve component")
  y renderiza un custom element vacío. Ya pasó una vez (fase 3); revisar la
  consola del navegador, no solo que compile, al agregar componentes en
  subcarpetas.
- Cuando el usuario pide explícitamente dejar el dev server corriendo para
  probar él mismo, no se corre `nuxt build` antes de ese push (`nuxt dev` y
  `nuxt build` comparten `.nuxt/` como scratch y pueden pisarse) — la
  verificación en vivo contra el dev server real sustituye al build check
  ese turno; correrlo en el siguiente push normal si no se hizo.
- **Cualquier campo de un modelo de `barber` con cast `decimal:2`
  (`Payment::$monto`/`$propina`/`ocr_monto_detectado`, y probablemente
  `Order`/`Product` en fases futuras — grep `'decimal:2'` en
  `app/Models/*.php` antes de asumir un tipo) llega a Nuxt como **string**
  en el JSON, no como number, por diseño de Laravel (preserva precisión).
  Mostrarlo solo (`fmtMoney()`/interpolación) funciona porque `Number()`
  lo parsea bien, pero sumarlo/restarlo directo con otro campo así usando
  `+`/`-` de JS es peligroso: `+` concatena strings en vez de sumar
  (`"225.00" + "0.00"` → `"225.000.00"`, un NaN disfrazado). Tipar estos
  campos como `string` en la interfaz TS (no `number`) y envolver con
  `Number(...)` antes de cualquier aritmética — no solo antes de mostrar.
  Encontrado en fase 9.3 (la columna "Total" del historial de pagos
  mostraba "$NaN").
- **Un `nuxt dev` que lleva corriendo muchas horas (sobrevive incluso la
  compactación de contexto de la sesión) puede entrar en un estado
  corrupto de Vite** (503 en assets, "does not provide an export named
  X" en módulos que ya funcionaban hace fases) — especialmente después de
  `npm install <paquete-nuevo>` con el servidor todavía corriendo, que
  invalida su cache de `optimizeDeps`. Antes de diagnosticar el código
  como roto, correr `npm run build` limpio: si compila sin errores, el
  problema es el estado del dev server, no el código — matar el proceso
  node en el puerto (`Get-NetTCPConnection -LocalPort 3000` +
  `Stop-Process`) y volver a correr `npm run dev` lo resuelve. Pasó en
  fase 9.3 justo después de instalar `@stripe/stripe-js`.

## Estado actual (ver también commits de este repo)

- **Fases 1-8 completas** — identidad visual, auth, shell/layout, los 4
  dashboards por rol, el calendario de citas, y ESLint+CI de este repo.
  Ver detalle de cada una en la lista de fases arriba. Todas verificadas
  de verdad (en vivo en el navegador para 1-7, log de CI línea por línea
  para la 8) — no solo "el estado dice success"/build local.
- `barber`: `config/cors.php` publicado y configurado; endpoint de
  dashboard enriquecido para los 4 roles; nuevo endpoint de calendario
  (`GET /api/v1/appointments/calendar-data`); tests de cobertura nuevos
  (`DashboardApiTest`, `AppointmentCalendarApiTest`, ambos con
  `tearDown()`). CI confirmado en verde en cada push (un fallo real de
  Larastan en el camino, corregido con entradas de baseline). Scribe
  regenerado tras el nuevo endpoint.
- `frontend-urban` ya tiene su propio CI (lint+build+audit) — primer run
  confirmado en verde.
- Fase 9 en curso — planificada en 9.1-9.9 (ver arriba). **9.1 Clientes**,
  **9.2 Citas** y **9.3 Pagos** completos y verificados en vivo. 9.2
  además cerró el botón "Editar Cita" del calendario (fase 7) y corrigió
  un bug de route-binding que llevaba roto desde la fase 5
  (`Barbero.vue`); 9.3 agregó el flujo completo de cobro con preview de
  lealtad/rifa y descubrió que los campos `decimal:2` de `barber`
  serializan como string (ver detalle de cada una arriba). Pendiente:
  9.4 (Pedidos) en adelante.
  `nuxt build`/`eslint` de este repo ya corren en CI en cada push, ya no
  hace falta correrlos manualmente antes de cada commit (aunque seguir
  haciéndolo local antes de push, como ya es costumbre, sigue siendo
  buena idea).
