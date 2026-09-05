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
1. **Scaffold + identidad visual** (en progreso / hecho el scaffold base):
   Nuxt 4 + `@nuxtjs/tailwindcss` (o Tailwind manual), portar tokens de
   color/tipografía del tema negro/dorado de `barber`, `nuxt.config.ts` con
   `routeRules` híbridos.
2. **Auth**: página de login, composable/store de auth (Pinia), guardado del
   token, middleware de ruta `auth`, llamadas a `POST /api/v1/auth/login`,
   `GET /api/v1/auth/me`, `POST /api/v1/auth/logout`,
   `POST /api/v1/auth/refresh-token`. Requiere `config/cors.php` en `barber`
   ya configurado para `http://localhost:3000`.
3. **Shell/layout compartido**: portar `AppLayout.vue` + `DashboardHeader.vue`
   + navegación por rol.
4. **Dashboard Recepcionista** (mismo orden que Inertia: fue el primero ahí
   también) — consumir `GET /api/dashboard`, enriquecer el controlador API
   en `barber` con los mismos campos computados que ya tiene la vista
   Inertia equivalente.
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
- Antes de cada push a este repo: `eslint` + `nuxt build` limpios (no hay
  PHPUnit/Pint aquí, es un repo JS puro).
- Nunca commitear `.env`/`.env.*` (ya excluidos en `.gitignore`) — la URL
  base de la API (`NUXT_PUBLIC_API_BASE`) y cualquier clave van ahí.

## Estado actual (ver también commits de este repo)

Scaffold Nuxt 4.5.2 creado, dependencias instaladas, remoto `origin`
configurado y confirmado vacío antes del primer push. Ninguna fase de la
lista de arriba está empezada todavía más allá del scaffold base.
