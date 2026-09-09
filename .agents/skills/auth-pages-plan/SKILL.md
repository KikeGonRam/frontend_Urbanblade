---
name: auth-pages-plan
description: CERRADO (2026-09-06) — histórico de cómo se llevó login/register/forgot-password/reset-password en Nuxt a paridad con las páginas Blade de barber, usando las mascotas de UrbanBlade (Nava/Bladebot/Bruno) en vez de una foto de stock. Leer antes de tocar app/pages/login.vue, register.vue, forgot-password.vue, reset-password.vue, app/components/auth/Shell.vue, useAuth.ts, o AuthController::register()/forgotPassword()/resetPassword() en barber.
---

# Páginas de autenticación (login/register/forgot/reset) — plan

## Contexto

Pedido del dueño del proyecto (2026-09-06): el login actual en Nuxt es "muy básico"
y quiere que las pantallas de acceso queden como en "el proyecto anterior" — es
decir, al nivel visual/funcional de las páginas Blade de `barber`
(`resources/views/auth/*.blade.php` + `layouts/guest.blade.php`), que siguen
vivas como fallback mientras Nuxt no alcanza paridad total (ver guardrail #18 de
`barber`). No se refiere a `mobil` (Expo, descontinuado — fuera de alcance).

**Hallazgo de la investigación (2026-09-06)**: no es solo un tema visual.
`frontend-urban` hoy **no tiene página de registro, ni de recuperar/restablecer
contraseña, ni funciones para eso en `useAuth.ts`** — el login es la única
pantalla de auth que existe. El backend ya soporta las 4 (login/register/forgot/
reset) vía API desde hace tiempo, simplemente nunca se consumieron desde Nuxt.

**IMPORTANTE — antes de escribir código**: releer directamente los archivos
citados en cada fase (líneas exactas) — mismo criterio que los planes anteriores
(`push-and-chat-plan`, `nuxt-migration-plan`, `stripe-and-ops-role-plan`).

---

## Qué existe hoy (auditoría 2026-09-06)

### Nuxt (`frontend-urban`)
- `app/pages/login.vue` (81 líneas): tarjeta centrada genérica, sin layout de dos
  columnas, sin "recordarme", sin link a "olvidé mi contraseña", sin link a
  registro, sin imaginería de marca más allá del `<BrandBrandMark>`.
- **No existe** `register.vue`, `forgot-password.vue` ni `reset-password.vue` en
  `app/pages/`. Confirmado por listado completo del directorio.
- `app/composables/useAuth.ts` (98 líneas): expone `token, user, isAuthenticated,
  hasRole, login, fetchMe, logout`. **No tiene `register()` ni ninguna función de
  recuperación de contraseña.**
- `app/pages/index.vue`: página de verificación de temas, sin identidad de marca
  reutilizable para esto.

### Blade (`barber`) — la referencia visual pedida
- `resources/views/layouts/guest.blade.php` (148 líneas): layout de dos columnas.
  Izquierda (oculta en móvil): imagen de fondo de barbería (Unsplash) con overlay
  degradado + grid sutil, glows dorados decorativos, logo (`x-brand-mark` +
  "Urban**Blade**" / "Elite Grooming Studio"), headline "Donde el **estilo** toma
  vida" con acento serif dorado, fila de 3 stats (500+ clientes, 10+ años, 4.9
  calificación), tarjeta de testimonio con 5 estrellas. Derecha: logo móvil,
  tarjeta de cristal oscuro (`guest-form-card`, shimmer superior) que envuelve el
  `$slot` del formulario, footer de copyright.
- `resources/views/auth/login.blade.php`: email + password, checkbox "Recordarme
  en este equipo", link "¿Olvidaste tu contraseña?", link a registro al final.
- `resources/views/auth/register.blade.php`: nombre, email, password,
  password_confirmation. Sin checkbox de términos, sin medidor de fuerza de
  contraseña. Link a login al final.
- `resources/views/auth/forgot-password.blade.php`: solo email, copy explicativo,
  link "&larr; Volver al inicio de sesión".
- `resources/views/auth/reset-password.blade.php`: token oculto, email
  (precargado, readonly), password + password_confirmation.
- Todas comparten clases utilitarias `.ui-input`/`.ui-label`/`.ui-btn`, iconos SVG
  dorados por campo, microcopy en mayúsculas con tracking amplio.
- **Deliberadamente fuera de alcance**: `verify-email.blade.php` (código de 6
  dígitos) y `confirm-password.blade.php` no tienen equivalente en la API
  (`routes/api.php` solo expone login/register/forgot/reset) — el registro vía
  API ya auto-verifica el correo (`AuthController::register()` línea 123:
  `$user->markEmailAsVerified()`), así que no hace falta portar esa pantalla.

### Contrato de la API (`barber/app/Http/Controllers/Api/Auth/AuthController.php`)
- `POST auth/register` (líneas 104-168): valida `name` (required,string,max:255),
  `email` (required,email,max:255,unique), `password` (required,min:8,confirmed),
  `device_name` (nullable). Crea el `User`, auto-verifica el email, asigna rol
  `cliente` + crea `Client` (o `administrador` si es el primer usuario del
  sistema y `FIRST_USER_ADMIN_ENABLED=true`), y **devuelve token + user
  inmediatamente** (201) — mismo shape que `LoginResponse`, no hace falta un paso
  de login aparte tras registrarse.
- `POST auth/forgot-password` (líneas 327-344): valida `email`. Usa
  `Password::sendResetLink()`. Responde `{message}` en éxito o 400 en fallo.
- `POST auth/reset-password` (líneas 365-395): valida `token, email, password
  (confirmed)`. Usa `Password::reset()`. Responde `{message}` en éxito o 400 si
  el token es inválido/expiró.
- Las 3 rutas están montadas con `throttle:6,1` (`routes/api.php` líneas 54-57) —
  ya protegidas contra fuerza bruta, no hace falta agregar nada ahí.

### Gap real encontrado que también hay que resolver en backend
`Password::sendResetLink()` usa la notificación `ResetPassword` **por defecto**
de Laravel (no hay ninguna override en `app/Notifications` ni en
`AuthServiceProvider|EventServiceProvider`) — ese default arma la URL con
`route('password.reset', [...])`, es decir, **apunta a la página Blade
`reset-password.blade.php`, no a Nuxt**, sin importar que el usuario haya pedido
el reset desde el frontend nuevo. Ya existe `config('app.frontend_url')` (via
`FRONTEND_URL` en `.env`) usado para este mismo propósito en otras rutas
retiradas — hay que reusar ese patrón aquí con una notificación `ResetPassword`
propia.

---

## Fases — todas ✅ DONE (2026-09-06)

0. ✅ **Decisión tomada**: el checkbox "Recordarme" se omitió por completo — no
   corresponde a nada real en el modelo de Bearer token + cookie de 6 meses de
   Nuxt (a diferencia del guard de sesión `web` de Blade, donde sí controla algo).
   El usuario pidió "comencemos" delegando esta decisión, y también pidió
   explícitamente reemplazar la imagen de stock por las mascotas de UrbanBlade
   para dar más identidad de marca — eso se volvió el criterio central de la
   Fase 3 (ver abajo), no solo un detalle visual menor.
1. ✅ **Backend — notificación de reset apuntando a Nuxt** (barber `e878695`):
   `ResetPassword::createUrlUsing()` en `AppServiceProvider::boot()` (el patrón
   oficial de Laravel, sin necesidad de una clase de notificación propia) arma la
   URL como `{frontend_url}/reset-password?token={token}&email={email}`. Nuevo
   `AuthApiTest` (7 tests) cubre `register()` (crea `cliente` + `Client`,
   auto-verifica email, rechaza email duplicado/confirmación no coincidente),
   `forgotPassword()` (asertando sobre `ResetPassword::toMail()->actionUrl` que
   apunta a `frontend_url`, no a la ruta Blade) y `resetPassword()` (token válido
   actualiza la contraseña; token inválido se rechaza).
2. ✅ **Nuxt — `useAuth.ts`**: `register()`, `forgotPassword()`, `resetPassword()`
   agregados exactamente como se planeó.
3. ✅ **Nuxt — `<AuthShell>` compartido** (`app/components/auth/Shell.vue`):
   layout de dos columnas con el mismo copy/stats que `guest.blade.php`, pero
   **la foto de stock de Unsplash se reemplazó por las mascotas de UrbanBlade**
   (pedido explícito del usuario, "para darle más identidad") — una mascota
   distinta por página, reusando la personalidad que cada una ya tiene en
   `error.vue`: Nava en login ("bienvenido de nuevo"), Bladebot en register
   ("únete a la élite"), Bruno en forgot/reset-password ("aquí para ayudarte").
   Estilos en un `<style scoped>` propio del componente (no se tocó el
   `main.css` global ni las clases `.ub-error-*` ya usadas por `error.vue`).
4. ✅ **Nuxt — `login.vue`** rediseñado con `<AuthShell>`, más los links a
   `/forgot-password` y `/register`.
5. ✅ **Nuxt — `register.vue`** (nueva): nombre, email, password,
   password_confirmation; valida que las contraseñas coincidan en el cliente
   antes de pegarle a la API; llama a `register()` y redirige directo a
   `/dashboard` (ya viene logueado).
6. ✅ **Nuxt — `forgot-password.vue`** (nueva): solo email, muestra el mensaje
   del backend, link de vuelta a `/login`.
7. ✅ **Nuxt — `reset-password.vue`** (nueva): lee `token`/`email` de
   `route.query`, valida confirmación de contraseña en el cliente, llama a
   `resetPassword()`, redirige a `/login`.
8. ✅ **Verificación** — hecha de punta a punta en vivo, no solo con tests
   automatizados: registro de un cliente real con auto-login confirmado,
   logout, "olvidé mi contraseña", **correo real inspeccionado en Mailpit**
   (`http://localhost:8025`, vía su API `/api/v1/message/{id}`) confirmando que
   el link generado apunta a `http://localhost:3000/reset-password?token=...
   &email=...` — la ruta Nuxt, no la de Blade — luego completar el reset y
   volver a loguear con la contraseña nueva, éxito confirmado. `.\test.ps1` x2
   verde (333 tests, +7 sobre la fase anterior), Pint/Larastan en frío limpios,
   `npm run lint`/`npm run build` verdes. Todo dato de prueba limpiado al
   terminar.
9. ✅ **Cierre**: CI verde en ambos repos — barber `e878695`, frontend-urban
   `7109586`.

## Guardrails específicos de este plan

- No tocar `verify-email.blade.php`/`confirm-password.blade.php` ni sus rutas —
  no tienen equivalente en la API hoy y no fueron pedidos; si en el futuro se
  necesita verificación de correo real (no auto-verificado) para registros vía
  Nuxt, es una decisión de producto aparte, no asumirla aquí.
- El checkbox "Recordarme" del Blade es específico de sesión de servidor
  (guard `web`) — no tiene un equivalente real en el modelo de token Bearer +
  cookie de Nuxt; no portarlo como si hiciera algo, o portarlo pero dejar claro
  en el código que es solo estético si el usuario insiste en incluirlo.
- La notificación de reset de contraseña **debe** apuntar a `frontend_url`
  (Nuxt), nunca a la ruta Blade `password.reset` — de lo contrario el usuario
  registrado vía Nuxt terminaría en una pantalla que ya no es su experiencia
  principal.
- Mismo criterio de guardrail #13 de `barber`: ningún campo de las nuevas
  páginas debe permitir que el cliente le diga al servidor qué rol asignarse o
  qué cuenta manipular — el registro siempre crea `cliente` (o `administrador`
  solo en el bootstrap del primer usuario, ya resuelto server-side, no tocar
  esa lógica).
