---
name: auth-polish-plan
description: CERRADO (2026-09-06) — histórico de cómo se implementaron las 4 mejoras recomendadas tras auth-pages-plan: medidor de fuerza de contraseña, transición entre páginas, feedback visible de rate-limit, y login social con Google (código completo pero inerte hasta que el usuario ponga credenciales reales). Leer antes de tocar register.vue, reset-password.vue, login.vue, useAuth.ts, useRetryCountdown.ts, usePasswordStrength.ts, pages/auth/callback.vue, o SocialAuthController/AppServiceProvider en barber.
---

# Mejoras de auth (fuerza de contraseña, transiciones, rate-limit, social login) — plan

## Contexto

Después de cerrar `auth-pages-plan` (login/register/forgot/reset con mascotas +
animaciones), el dueño del proyecto pidió implementar las 4 recomendaciones que
salieron de esa fase (2026-09-06): medidor de fuerza de contraseña, transición
entre páginas, feedback visible de rate-limit, y login social.

**IMPORTANTE — antes de escribir código**: releer directamente los archivos
citados en cada fase — mismo criterio que los planes anteriores.

---

## Auditoría (2026-09-06)

- **Rate limiting ya existe y funciona** (`routes/api.php` líneas 54-57):
  `auth/login` usa el limiter nombrado `login` (`AppServiceProvider::boot()`,
  `Limit::perMinute(5)->by($request->email.$request->ip())`); `auth/register`,
  `auth/forgot-password`, `auth/reset-password` usan `throttle:6,1` (6 por
  minuto, por IP). Cuando se agota, Laravel's `ThrottleRequests` responde 429
  con headers `Retry-After` (segundos) y `X-RateLimit-Remaining`, y body
  `{"message": "Too Many Attempts."}`. **El frontend hoy no distingue este caso
  de cualquier otro error** — cae en el mensaje genérico "No se pudo iniciar
  sesión. Intenta de nuevo." sin decirle al usuario cuánto debe esperar.
- **Laravel Socialite no está instalado** (`composer.json` sin
  `laravel/socialite`). No hay ninguna ruta ni controlador de OAuth hoy.
- **`useAuth.ts`** no tiene noción de "intentos restantes" ni de proveedores
  sociales.

---

## Fases — todas ✅ DONE (2026-09-06)

1. ✅ **Medidor de fuerza de contraseña** (frontend-urban `729b066`):
   `usePasswordStrength.ts` (4 criterios: longitud≥8, mayúsculas+minúsculas,
   dígito, símbolo u longitud≥12), `<AuthPasswordStrength>` (barra de 4
   segmentos + label) en `register.vue`/`reset-password.vue`. **Bug real
   encontrado probando en vivo**: `score 0` era ambiguo entre "campo vacío" y
   "no cumple ningún criterio" (p.ej. escribir solo "abc" no mostraba ninguna
   barra ni label, como si el campo siguiera vacío) — se agregó
   `displayScore` con piso de 1 en cuanto hay cualquier texto, para que una
   contraseña real (aunque mala) siempre muestre algo.
2. ✅ **Transición entre páginas**: `pageTransition: { name: 'auth', mode:
   'out-in' }` en las 4 páginas + `.auth-enter-active`/`.auth-leave-active`
   en `main.css` (confirmado necesario vivir en CSS global, no en el
   `<style scoped>` de `<AuthShell>` — Vue Router aplica esas clases
   directo sobre `<NuxtPage>`).
3. ✅ **Feedback visible de rate-limit**: `useRetryCountdown.ts` lee el header
   `Retry-After` de un 429 (confirmado que sí llega en `error.response.headers`
   vía ofetch, sin necesidad de cambios en el backend) y muestra una cuenta
   regresiva real, botón deshabilitado mientras tanto. **Verificado forzando
   el throttle real**: 7 llamadas seguidas a `forgot-password` desde curl (el
   límite es 6/min) → la 7ª dio 429, y la UI mostró "Espera 56s" bajando en
   vivo hasta 46s antes de continuar la prueba.
4. ✅ **Login social (Google)** — alcance recortado a Google únicamente
   (Apple Sign-In sigue fuera de alcance, requiere cuenta de pago):
   - Backend (barber `99af874`): `laravel/socialite` instalado (esto bajó
     `guzzlehttp/guzzle` de 8.1.0 a 7.15.5 -- ningún release de Socialite
     soporta Guzzle 8 todavía; el downgrade cae dentro del rango que
     `laravel/framework`/`laravel/boost` ya aceptaban, `composer audit`
     limpio, suite completa verde después). Nuevo `SocialAuthController`
     (`redirect()`/`callback()`), rutas `GET auth/google/redirect` y
     `.../callback` (`throttle:10,1`). `callback()` espeja exactamente la
     asignación de rol de `register()` — siempre `cliente`, nunca algo que
     el propio flujo de OAuth pueda elegir.
   - Frontend (frontend-urban `729b066`): botón "Continuar con Google" (logo
     real multicolor) en login/register; nueva `pages/auth/callback.vue` que
     lee el token de la URL, lo guarda, y limpia la URL con
     `history.replaceState` antes de redirigir a `/dashboard` (nunca deja el
     token visible en el historial).
   - **Bloqueador real, no evitable, confirmado tal cual se anticipó**: sin
     `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` reales (el usuario debe
     generarlos en Google Cloud Console — pasos documentados en
     `.env.example`), `redirect()` responde 503 en vez de romper — verificado
     en vivo con `curl` (`503` confirmado). Todo lo demás sí se verificó de
     punta a punta con `Socialite::fake()` en tests, y en el navegador: la
     URL del botón apunta al endpoint correcto, y la página de callback
     muestra su estado de error correctamente cuando no hay token en la URL.
5. ✅ **Verificación**: `.\test.ps1` verde (338 tests, +5 sobre la fase
   anterior: `SocialAuthApiTest`), Pint/Larastan en frío limpios (2 errores
   de tipo nuevos por `stateless()` no estar en el contrato `Provider` de
   Socialite, resueltos con `@var AbstractProvider`, no baseline), Scribe
   regenerado (2 rutas nuevas documentadas). `npm run lint`/`npm run build`
   verdes. Todo verificado en vivo en el Browser pane, no solo con tests
   automatizados (medidor de fuerza en las 3 franjas, transición sin errores
   de consola, rate-limit real forzado y contado en vivo, botón/página de
   Google).
6. ✅ **Cierre**: CI verde en ambos repos — barber `99af874`, frontend-urban
   `729b066`.

**Nota para el usuario, no resuelta aquí**: el login con Google está
completo pero no funcionará hasta que generes tus propias credenciales en
[Google Cloud Console](https://console.cloud.google.com/apis/credentials)
(gratis) y las pongas en `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` de tu
`.env` real — los pasos exactos están comentados en `.env.example`.

## Guardrails específicos de este plan

- El login social **nunca** debe asignar un rol distinto de `cliente` por
  defecto (mismo criterio que `register()` — sin excepciones vía OAuth).
- El token emitido tras el callback de OAuth viaja en la URL de redirect al
  frontend (`{frontend_url}/auth/callback?token=...`) — es lo mismo que ya
  hace `getWebApiToken()`/el patrón de `ResetPassword`, pero un token en la URL
  queda en el historial del navegador; la página de callback debe limpiar la
  URL (`history.replaceState` o `navigateTo` sin el query) inmediatamente
  después de leer el token, no dejarlo visible.
- No inventar ni usar credenciales de prueba/placeholder de Google como si
  fueran reales — dejar `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` vacíos en
  `.env.example` y sin valor en el `.env` real hasta que el usuario los
  proporcione.
