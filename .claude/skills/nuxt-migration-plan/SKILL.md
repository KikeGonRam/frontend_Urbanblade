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
5. **Dashboard Barbero**.
6. **Dashboard Cliente**.
7. **Dashboard Administrador** + `Calendar.vue` (el más grande, dejarlo para
   el final como se hizo en Inertia).
8. **CORS hardening + CI de este repo** (ESLint + `nuxt build`, sin PHP
   aquí — workflow propio en `.github/workflows/` de `frontend-urban`).
9. **Expansión fuera del scope de los 4 dashboards**: `routes/api.php` ya
   cubre citas, pagos, clientes, inventario, servicios, usuarios, reportes,
   configuración, notificaciones, social, chatbot — evaluar cuáles migrar
   después de que los dashboards estén en paridad.
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

## Estado actual (ver también commits de este repo)

- Fases 1 (identidad visual), 2 (auth), 3 (shell/layout) y 4 (dashboard
  recepcionista) completas — ver detalle en cada punto de la lista de fases
  arriba. Las cuatro verificadas en vivo en el navegador (no solo
  build/typecheck) contra la API real de `barber`.
- `barber`: `config/cors.php` publicado y configurado; endpoint de
  dashboard enriquecido para recepcionista con test de cobertura nuevo;
  ambos con CI confirmado en verde (el segundo tras un primer fallo real de
  Larastan, corregido con una entrada de baseline).
- Pendiente: eslint en este repo, dashboards de barbero/cliente/admin +
  calendario (fases 5-7), y todo lo posterior. `nuxt build` de fases 3 y 4
  quedó sin correr por pedido explícito del usuario de dejar el dev server
  activo — correrlo antes o junto con el próximo push.
