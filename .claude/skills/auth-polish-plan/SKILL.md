---
name: auth-polish-plan
description: Plan para las 4 mejoras recomendadas tras auth-pages-plan — medidor de fuerza de contraseña, transición entre páginas de auth, feedback visible de rate-limit, y login social (Google). Leer antes de tocar register.vue, reset-password.vue, login.vue, useAuth.ts, AppServiceProvider (rate limiters), o AuthController en barber.
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

## Fases

1. ⏳ **Medidor de fuerza de contraseña** (solo frontend): heurística propia
   ligera en `register.vue`/`reset-password.vue` (longitud, mayúsculas,
   números, símbolos — sin traer una librería como `zxcvbn`, que pesa ~800KB
   minified y es overkill para un formulario de 2 campos). Barra de 4 segmentos
   con los colores del tema (rojo→ámbar→dorado→verde esmeralda), label
   ("Débil"/"Aceptable"/"Buena"/"Excelente"). Nuevo composable
   `usePasswordStrength(password: Ref<string>)` en
   `app/composables/usePasswordStrength.ts`, reusado por ambas páginas.
2. ⏳ **Transición entre páginas de auth**: `definePageMeta({ pageTransition:
   { name: 'auth', mode: 'out-in' } })` en las 4 páginas + clases CSS globales
   `.auth-enter-active/.auth-leave-active` (fade + slight scale) en
   `main.css` — Nuxt/Vue Router requieren que las clases de transición vivan en
   CSS global, no en un componente con `<style scoped>` (el `<AuthShell>` no
   puede definirlas él solo).
3. ⏳ **Feedback visible de rate-limit**: en `login.vue`/`register.vue`/
   `forgot-password.vue`/`reset-password.vue`, detectar status 429 en el catch
   y leer el header `Retry-After` (via `error.response.headers` -- confirmar
   que `$fetch`/`ofetch` expone headers en el objeto de error antes de asumirlo,
   revisar en la implementación) para mostrar "Demasiados intentos. Espera
   {n} segundos." con una cuenta regresiva simple (`setInterval`) en vez del
   mensaje genérico.
4. ⏳ **Login social (Google)** — **alcance recortado a Google únicamente**:
   Apple Sign-In requiere una cuenta de Apple Developer de pago ($99/año) más
   verificación de dominio y generación de un client secret firmado con JWT —
   fuera de lo que tiene sentido implementar sin que el usuario ya tenga esa
   cuenta. Google OAuth es gratis de configurar (Google Cloud Console).
   - Backend: `composer require laravel/socialite`. Nuevo
     `Api\Auth\SocialAuthController` con `redirect()` (arma la URL de Google)
     y `callback()` (recibe el código, busca/crea el `User` por email, asigna
     rol `cliente` igual que `register()`, emite token, redirige al frontend
     con el token en la URL — mismo patrón que `ResetPassword::createUrlUsing()`
     usa `frontend_url`). Nuevas env vars `GOOGLE_CLIENT_ID`,
     `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`.
   - Frontend: botón "Continuar con Google" en login.vue/register.vue que
     navega a `{apiBase}/auth/google/redirect`; nueva página
     `pages/auth/callback.vue` que lee el token de la URL, lo guarda (mismo
     `useAuth()`) y redirige a `/dashboard`.
   - **Bloqueador real, no evitable**: esta fase quedará con el código
     completo pero **inerte hasta que el usuario cree su propio proyecto en
     Google Cloud Console** (OAuth consent screen + credenciales) y pegue
     `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` reales en `.env` — no es algo
     que se pueda generar ni probar de verdad sin esas credenciales. Se deja
     documentado paso a paso en `.env.example` qué hacer, y se verifica todo
     lo demás (rutas, redirect building, manejo de errores) sin poder
     completar un login real de punta a punta.
5. ⏳ **Verificación**: `.\test.ps1` x2 + Pint + Larastan en frío (backend,
   fases 3-4); `npm run lint` + `npm run build` (frontend, todas las fases); en
   vivo en el Browser pane — medidor de fuerza reaccionando al escribir,
   transición visible entre login↔register, forzar un 429 real (6+ intentos
   seguidos) y confirmar el mensaje de espera, y el flujo de Google hasta donde
   se pueda probar sin credenciales reales (ruta de redirect se arma bien,
   callback maneja un código inválido con un error claro).
6. ⏳ **Cierre**: reporte final, CI verde en ambos repos, y una nota clara al
   usuario de qué le falta poner (las credenciales de Google) para que el login
   social funcione de verdad.

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
