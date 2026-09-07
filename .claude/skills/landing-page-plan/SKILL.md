---
name: landing-page-plan
description: CERRADO (2026-09-06) — histórico de cómo se construyó la landing pública (/) en Nuxt, puerto de barber/resources/views/welcome.blade.php (antes solo existía como página de verificación de temas). Leer antes de tocar app/pages/index.vue o el CSS de `.reveal`/`.ui-btn`/`.hero-*` en app/assets/css/main.css.
---

# Landing pública (`/`) — plan

## Contexto

`app/pages/index.vue` era una página de verificación de temas ("Frontend Nuxt
— verificación"), no la landing real. El dueño del proyecto pidió construir
la landing pública como estaba en el proyecto anterior (Blade,
`barber/resources/views/welcome.blade.php`), mejorándola con lo que ya existe
en Nuxt en vez de reinventar el diseño desde cero.

## Auditoría (2026-09-06)

- `welcome.blade.php`: navbar + hero + stats + servicios + cómo-funciona +
  equipo + testimonios + contacto (mapa embed) + CTA final + footer +
  chatbot flotante. Todo hardcoded en negro (`#0a0a0a`/`#0d0d0d`/...), sin
  relación con el sistema de temas (ese repo no lo tenía).
- `CatalogController::services()`/`barbers()` (`GET /services`, `GET
  /barbers`) ya son **públicas, sin token** — confirmado leyendo
  `routes/api.php` de barber (no están dentro del grupo
  `Route::middleware('mobile.auth')`). Se pudieron reusar tal cual, sin
  cambios de backend.
- `barbers/{barber}` (perfil detallado) y `/services/manage` (que usa
  `app/pages/services/index.vue`) sí exigen sesión/rol admin — no hay
  todavía una página pública de detalle de servicio/barbero en Nuxt (el
  catálogo público de Blade -- `/servicios`, `/equipo/{barber}` -- sigue
  vivo ahí para eso, ver guardrail #18 de `urbanblade-guardrails`). Por eso
  todo CTA de "ver más"/"ver perfil" de esta landing manda a `/register` en
  vez de a una ruta que no existe o que exige rol.
- Ya existían `<BrandMascotCompanion />` (antes solo en el layout
  `dashboard`) y las clases `.ui-card-premium` en `main.css` — reusadas tal
  cual en vez de duplicar.

## Decisiones de diseño (mejora deliberada sobre el original)

- **Theme-aware, no hardcoded**: toda la página usa los tokens
  `bg-main`/`bg-panel`/`text-ink`/`text-muted`/`border-line`/`text-gold` en
  vez de hex fijos -- respeta los 4 temas del selector (`useTheme()`) en vez
  de quedar siempre en negro como el original. Los overlays del hero
  (`.hero-scrim`) usan `color-mix(in srgb, var(--bg-main) X%, transparent)`
  porque los tokens `main`/`card`/`panel`/etc. son hex planos, no
  `rgb(var(..) / <alpha-value>)` como `gold`/`ink` -- Tailwind no puede
  aplicarles opacidad vía `bg-main/70`, así que el blend se hace en CSS
  puro con `color-mix()`, no con utilidades de Tailwind.
- Componentes `.ui-btn`/`.ui-btn-secondary`/`.ui-badge`/`.ui-title-serif`/
  `.text-gradient-gold`/`.gold-glow-hover`/`.animate-float` portados 1:1
  desde `barber/resources/css/app.css` a `main.css` (bajo `@layer
  components`), reusables por cualquier página futura, no solo la landing.
- `/services` y `/barbers` se llaman con `useAsyncData(..., { server:
  false })` **a propósito**: el backend de barber corre en
  `127.0.0.1:8000` local del dueño del proyecto, no es alcanzable desde el
  entorno serverless de Vercel en producción (ver guardrail de
  `frontend-urban` sobre el bloqueo de red privada, documentado en la
  sesión de `auth-polish-plan`/Vercel). Si el fetch corriera en SSR,
  Vercel intentaría conectar a una IP que no existe desde su red y
  colgaría/fallaría el render completo de la página. Con `server: false`
  el fetch solo corre en el navegador del visitante, que si tiene acceso a
  la API (dev local, o cuando exista un túnel real) sí la resuelve.

## Bug real encontrado y arreglado en la verificación en vivo

**Reveal-on-scroll con querySelectorAll único en `onMounted` nunca
mostraba las tarjetas cargadas por `useAsyncData`.** El patrón original de
Blade (`document.querySelectorAll('.reveal').forEach(el =>
observer.observe(el))`, corrido una sola vez) asume que todos los `.reveal`
ya existen en el DOM al momento de `onMounted`. En Nuxt, las tarjetas de
servicios/barberos se agregan al DOM **después** de que `useAsyncData`
resuelve (un tick async posterior a `onMounted`), así que el barrido único
las encontraba con `opacity: 0` para siempre -- confirmado en vivo con
`getComputedStyle(el).opacity === "0"` y la tarjeta del barbero real
(`Barbero UrbanBlade`, la única cuenta real que existe hoy) invisible pese a
estar en el DOM.

**Fix**: un directive local `v-reveal` (`{ mounted(el) { revealObserver
?.observe(el) } }`) en vez del `querySelectorAll` -- el hook `mounted()` de
un directive se dispara para cada elemento en el momento real en que entra
al DOM, sin importar si eso pasa en el mount inicial de la página o después
de un fetch async. Verificado en vivo tras el fix: la tarjeta del barbero
pasa a `opacity: 1` con la clase `is-visible` una vez visible en viewport.

También se cambió el bloque `pending`/`empty`/grid de servicios y barberos a
vivir dentro de `<ClientOnly>`: sin eso, `useAsyncData(..., { server: false
})` producía `pending: false` en el render de servidor (el fetch nunca
corrió ahí) contra `pending: true` en el cliente (a punto de correr) --
"Hydration text content mismatch" real, confirmado en la consola del
navegador (`rendered on server: "El catálogo estará disponible muy
pronto." / expected on client: "Cargando catálogo premium…"`).
`<ClientOnly>` evita el problema de raíz: no intenta renderizar ese bloque
en el servidor en absoluto.

## Estado (2026-09-06)

✅ **DONE** -- `app/pages/index.vue` reescrito por completo (navbar sticky +
menú móvil, hero con parallax/partículas/scroll hint, stats, servicios
(datos reales de `/services`), cómo funciona, equipo (datos reales de
`/barbers`), testimonios, contacto con mapa embed, CTA final, footer,
mascota flotante). `main.css` extendido con las clases UI portadas de
barber. Verificado en vivo en el Browser pane: escritorio, mobile (375px,
menú hamburguesa abre/cierra), reveal-on-scroll con datos reales, sin
errores de hidratación ni de consola. `npm run lint` y `npm run build`
verdes.

**Nota para el usuario**: el catálogo de servicios y el resto del equipo de
barberos aparecen vacíos/con solo 1 barbero en este momento porque
`barber_db` fue reseteada el 2026-09-04 (ver guardrail #12 de
`urbanblade-guardrails` en el repo `barber`) y hoy solo existen las 4
cuentas demo, sin servicios ni productos reales cargados todavía -- no es
un bug de esta página, se llenará solo en cuanto haya datos reales.
