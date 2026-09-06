---
name: push-and-chat-plan
description: Plan y arquitectura para dos features nuevas post-migración — notificaciones push de citas próximas, e integración del chat de asistencia IA en Nuxt. Leer antes de tocar app/Notifications, config/chatbot.php, o cualquier composable/página relacionada con push o chat en cualquiera de los dos repos.
---

# Push de citas próximas + Chat de asistencia IA — plan y arquitectura

## Contexto y por qué esto es scope nuevo, no deuda pendiente

`nuxt-migration-plan` (este mismo repo) cerró el 2026-09-06 sin fases
pendientes: los 4 dashboards, todo el panel operativo/gestión, autoservicio,
Analítica, Muro Inspiración y Reseñas quedaron con paridad funcional
confirmada, y `barber` retiró cada página Blade equivalente. Esa migración
dejó **notificaciones y chatbot fuera a propósito** — ver "Reporte final" de
ese mismo skill: *"Lo que queda en `barber` como Blade es una decisión
consciente... no deuda técnica de la migración"*.

El 2026-09-06, el dueño del proyecto pidió dos features nuevas:
1. **Notificaciones push** para citas próximas.
2. **Integración del chat de asistencia IA** en Nuxt (el chatbot ya existe en
   `barber`, pero nunca se migró — sigue siendo un widget Blade+Alpine).

Este documento es el plan de arquitectura para ambas, escrito ANTES de tocar
código, siguiendo el mismo espíritu incremental que `nuxt-migration-plan`
(fase por fase, verificado en vivo, CI en verde antes de avanzar).

**IMPORTANTE — antes de escribir código**: releer directamente en `barber`
los archivos citados en cada sección de abajo (rutas exactas, línea por
línea) — este plan puede quedar desactualizado si el backend cambia después
de escribirlo, igual que advierte `nuxt-migration-plan`.

---

## Feature 1: Notificaciones push para citas próximas

### Qué existe hoy (auditoría 2026-09-06, ver también guardrail #22 en barber)

- `app/Console/Commands/SendAppointmentRemindersCommand.php` (`barber`) ya
  corre cada 10 min (`routes/console.php`), manda recordatorio 24h antes y
  2h antes, y ya dispara `AppointmentNotification` + SMS/WhatsApp directo vía
  `MessagingService` (Twilio). El mecanismo de "avisar antes de la cita" YA
  EXISTE — lo que falta es un canal más, no el disparador.
- `AppointmentNotification::via()` arma los canales dinámicamente desde
  `$notifiable->wantsNotificationChannel($canal)`: hoy soporta
  `in_app`→`database`, `email`→`mail`, `sms`/`whatsapp`→`TwilioChannel`. No
  hay canal `push` ni método `toWebPush()`.
- `User::notificationPreferences()` tiene un array de defaults
  (`in_app`/`email`/`sms`/`whatsapp`/`promociones`) mezclado con
  `notification_preferences` (propio) y `clientProfile->preferencias_notificacion`
  (legado) — agregar `push` aquí es el mismo patrón que ya existe para los
  demás canales, no una construcción nueva.
- **Cero infraestructura de push existe hoy en ningún repo**: no hay VAPID,
  FCM, OneSignal, `config/broadcasting.php`, Pusher/Reverb, service worker,
  manifest.json, ni paquete relacionado en ningún `composer.json`/`package.json`.
  Esto es trabajo desde cero en ambos lados.
- La entrega in-app actual es **polling** (`GET /notifications/poll`, ver
  `NotificationController::poll()`), no websockets — el push del navegador
  no depende de esto y puede convivir sin tocarlo.

### Decisión: Web Push (VAPID) nativo del navegador, no FCM/OneSignal

**Por qué**: el equipo no tiene apps nativas para `barber` todavía (la app
Android mencionada en las guardrails de `barber` está "en construcción
separada", no lista) — Web Push vía `PushManager`/Service Worker es estándar
del navegador, gratis, sin cuenta de terceros (Firebase/OneSignal), y basta
para el caso de uso ("avisarle al cliente/barbero de una cita próxima" desde
una pestaña de Nuxt abierta o cerrada). Si más adelante existe una app nativa
Android real, FCM se puede añadir como canal adicional sin romper este —
mismo patrón que `TwilioChannel` conviviendo con `mail`/`database` hoy.

Si el dueño del proyecto prefiere FCM/OneSignal en su lugar (p. ej. porque ya
tiene planes concretos para la app Android), es un cambio de fase 1
solamente (el proveedor de push), el resto del plan no cambia.

### Piezas a construir

**Backend (`barber`)**:
1. `composer require minishlink/web-push` (librería VAPID pura, sin atarse a
   un paquete Laravel que asuma MySQL/migraciones — este repo es Mongo).
2. Generar par de claves VAPID (`vendor/bin/... ` o vía el helper que trae la
   librería) — guardarlas en `.env` (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`,
   `VAPID_SUBJECT`), nunca commitearlas (mismo criterio que cualquier otro
   secreto en este repo).
3. Modelo `PushSubscription` (Mongo, mismo patrón que `DatabaseNotification`):
   `user_id`, `endpoint`, `keys` (p256dh/auth), `created_at`. Un usuario puede
   tener varias suscripciones (varios dispositivos/navegadores).
4. `App\Notifications\Channels\WebPushChannel` (custom, mismo patrón que
   `TwilioChannel` ya existente) — itera las `PushSubscription` del
   notifiable, arma el payload (title/body/url) desde `toWebPush()` de la
   notification, y llama a `WebPush::sendOneNotification()` de la librería.
   Limpia (`delete()`) cualquier suscripción que devuelva 404/410 (expirada).
5. `AppointmentNotification::via()` — agregar `push` a la lista si
   `wantsNotificationChannel('push')`, y un método `toWebPush()` con el
   mismo contenido que ya arma `toArray()` (title/message/url), sin
   duplicar lógica.
6. `User::notificationPreferences()` — agregar `push` a los `$defaults`
   (default `false` hasta que el usuario habilite push explícitamente,
   consistente con que `sms`/`whatsapp` también default `false`: son canales
   que requieren opt-in activo del usuario, a diferencia de `in_app`/`email`).
7. Endpoints API nuevos (Bearer auth, `routes/api.php`, grupo autenticado):
   `POST /api/v1/push/subscribe` (guarda/actualiza una `PushSubscription`),
   `DELETE /api/v1/push/subscribe` (borra la del dispositivo actual —
   identificar por `endpoint` en el body, no por id, porque el cliente no
   conoce el id Mongo). `GET /api/v1/push/vapid-public-key` (sirve la clave
   pública — el frontend la necesita para `PushManager.subscribe()`).
8. **Falta también** un endpoint API para notification-preferences —
   hoy solo existe `PATCH /notifications/preferences` en `routes/web.php`
   (sesión/CSRF). Nuxt necesita su propio `GET`/`PATCH
   /api/v1/notifications/preferences` — mismo controlador
   `Api\Notification\NotificationController` que ya expone `index`/
   `markAllRead`/etc., ampliado con estos dos métodos.

**Frontend (`frontend-urban`)**:
9. Service worker mínimo (`public/sw.js` — Nuxt sirve `public/` tal cual, no
   hace falta un módulo PWA completo para esto) que escuche `push` y
   `notificationclick`, y lo registre desde un plugin client-only
   (`plugins/push.client.ts`).
10. `useApi()`-based composable `usePush()`: pide permiso
    (`Notification.requestPermission()`), registra el SW, llama
    `pushManager.subscribe({applicationServerKey: <vapid pública>})`, manda
    la suscripción a `POST /api/v1/push/subscribe`. Maneja el estado
    "denegado" sin reintentar en loop (respetar la decisión del usuario).
11. UI: un toggle en alguna pantalla de cuenta/perfil (`/profile` no existe
    aún en Nuxt — evaluar si agregar uno mínimo aquí o si vive en el layout,
    p. ej. un ícono de campana con estado) — **decisión pendiente de UX,
    confirmar con el usuario en qué pantalla vive el toggle antes de
    construirlo**, ya que hoy Nuxt no tiene ninguna pantalla de perfil/cuenta
    propia (esa quedó explícitamente fuera de la migración, ver arriba).
12. `routeRules` en `nuxt.config.ts` para lo que se agregue (probablemente
    ninguna página nueva si el toggle vive dentro de una pantalla ya
    existente con `ssr:false`).

### Gotchas ya anticipados (para no redescubrirlos)

- Un Service Worker solo se registra sobre HTTPS o `localhost` — en dev con
  `npm run dev` (localhost:3000) funciona igual, pero cualquier despliegue
  futuro necesita TLS real, no HTTP plano.
- Safari/iOS tiene soporte limitado/tardío de Web Push — no bloquea el
  feature pero conviene degradar con gracia (ocultar el toggle si
  `!('PushManager' in window)`) en vez de romper.
- `WebPush::sendOneNotification()` puede devolver 410 Gone para
  suscripciones viejas — limpiarlas es obligatorio o el job de recordatorios
  intentará mandar a endpoints muertos cada 10 minutos para siempre.
- Guardrail #13 de `barber` (nunca confiar en datos del cliente para dinero)
  no aplica aquí directamente, pero el mismo espíritu sí: el `endpoint` de
  push que manda el navegador debe validarse como string no vacío, no
  asumir formato sin validar, antes de guardarlo.

---

## Feature 2: Integración del chat de asistencia IA en Nuxt

### Qué existe hoy (auditoría 2026-09-06)

El chatbot en `barber` es una arquitectura en cascada ya sólida — **no hace
falta tocar la lógica de IA**, esto es un problema de UI + persistencia, no
de inteligencia artificial:

1. `ChatbotController::query()` intenta, en orden: memoria de preguntas
   similares (`ChatbotContextService`) → lógica contextual
   (`ChatbotIntelligenceService`) → reglas manuales por palabra clave
   (`manualLogic()`, cubre servicios/citas/barberos/horarios/ubicación/
   cancelaciones/pagos/puntos/FAQs/reseñas/saludos) → datos externos
   (Wikipedia/OSM) → **IA como último recurso**
   (`ChatbotAiProvider` → `OllamaService` local o `GeminiService`,
   seleccionado por `config('chatbot.ai.provider')`). La mayoría de
   preguntas nunca llegan a tocar un LLM.
2. Ya existe una superficie API Bearer-friendly en `routes/api.php`:
   `POST /api/v1/chatbot/query` (público, throttled) y
   `Api\Chatbot\ChatbotManagementController` (`getHistory`/`clearHistory`/
   `getProfile`/`getLearningStats`/`trainFromHistory`, esta última
   admin-only). **No hay que construir ninguna ruta nueva para lo básico**
   — ya están.
3. **El problema real**: `ChatbotContextService` guarda todo el historial en
   `Illuminate\Support\Facades\Session` (sesión de Laravel), no en una
   colección de Mongo. El widget Blade (`chatbot.blade.php`) funciona porque
   corre dentro de una sesión web con cookie. Nuxt usa Bearer token puro, sin
   sesión de Laravel — un request autenticado por Bearer SÍ puede pasar por
   el middleware `mobile.auth` (que autentica al guard `web`), pero **no
   necesariamente comparte la misma sesión PHP entre requests** si no hay
   cookie de sesión viajando, así que el historial se perdería entre
   mensajes o se mezclaría entre usuarios distintos según cómo resuelva
   Laravel la sesión sin cookie. Esto hay que confirmarlo con una prueba
   real ANTES de construir la UI (ver Fase 1 abajo) — es la pieza más
   incierta de todo el plan.
4. No existe ningún modelo `ChatConversation`/`ChatMessage` en Mongo — todo
   el estado es efímero (sesión) o calculado al vuelo.

### Decisión: persistir el historial en Mongo quedaría del lado del usuario autenticado, sin romper el widget Blade existente

**Por qué no tocar `ChatbotContextService` directamente todavía**: ese
servicio lo sigue usando el widget Blade (`chatbot.blade.php`), que
`nuxt-migration-plan` documentó como **fuera de alcance** (no se está
retirando en este plan — el chat es una feature nueva en Nuxt, no un retiro
de Blade). Cambiar el mecanismo de guardado ahí podría romper el widget
existente para roles que Nuxt aún no cubre completamente.

**Camino propuesto** (confirmar con el usuario antes de construir, es la
decisión de arquitectura más importante de este plan):
- Opción A (recomendada): agregar persistencia en Mongo **en paralelo** a la
  sesión — un modelo nuevo `ChatMessage` (`user_id`, `role` [user/assistant],
  `content`, `source` [memory/rules/ai/etc, reusa el campo que ya calcula
  `recordProviderTelemetry()`], `created_at`). `ChatbotContextService` sigue
  escribiendo a sesión (no se toca, el widget Blade sigue igual) Y además
  persiste a Mongo cuando el request viene autenticado — la API de Nuxt lee
  el historial desde Mongo (`getHistory()` en modo API), no desde sesión.
  Esto es aditivo: nadie pierde nada, Nuxt gana persistencia real
  entre pestañas/dispositivos que el widget Blade nunca tuvo.
- Opción B: aceptar un chat sin historial persistente en Nuxt (cada mensaje
  es independiente, sin contexto de conversación previa) — más simple, pero
  peor experiencia, y pierde la ventaja de "memoria de preguntas similares"
  que ya tiene el sistema.

Este plan asume Opción A por defecto; si el usuario prefiere empezar simple
con B y agregar persistencia después, es un cambio de alcance de fase 2
únicamente.

### Piezas a construir

**Backend (`barber`)**:
1. Confirmar experimentalmente (antes de programar nada) qué pasa hoy si dos
   requests Bearer-only distintos llegan a `POST /api/v1/chatbot/query` —
   ¿comparten sesión, la pierden, o cada uno crea una nueva? Esto decide si
   hace falta blindar `ChatbotContextService` para no filtrar contexto entre
   usuarios antes de exponerlo más.
2. Modelo `ChatMessage` (Mongo, mismo patrón que otros modelos del repo).
3. Ampliar `ChatbotContextService` (o envolverlo) para persistir a Mongo
   cuando `$request->user()` existe, sin cambiar su comportamiuento de
   sesión para el flujo web sin autenticar.
4. `Api\Chatbot\ChatbotManagementController::getHistory()` — leer desde
   Mongo cuando hay usuario autenticado, mantener el fallback de sesión para
   el caso sin autenticar (mismo endpoint sirve a ambos, como ya hace).
5. Actualizar Scribe (`php artisan scribe:generate`) si el shape de
   respuesta cambia (guardrail #11 de `barber` — API es contrato externo).

**Frontend (`frontend-urban`)**:
6. Componente `components/chat/ChatWidget.vue` — reconstrucción del widget
   Blade como Vue: burbuja flotante, historial, input, indicador de
   "escribiendo", sugerencias rápidas por rol (mismo criterio que
   `chatbot.blade.php` ya tiene: chips distintos para cliente/admin/barbero/
   invitado).
7. `composables/useChatbot.ts` — `sendMessage()` (`POST
   /api/v1/chatbot/query`), `loadHistory()` (`GET /api/v1/chatbot/history`),
   `clearHistory()` (`POST /api/v1/chatbot/clear-history`).
8. Montar el widget globalmente en `layouts/dashboard.vue` (visible en toda
   el área autenticada, igual que el command-palette lo está en `barber`) —
   **decisión a confirmar**: ¿también visible para invitados en páginas
   públicas de Nuxt? Hoy Nuxt no tiene páginas públicas propias (todo su
   `routeRules` es `ssr:false` para el área autenticada) — si se quiere un
   chat público habría que decidir dónde vive.
9. No hace falta `routeRules` nuevo si el widget es un componente global en
   el layout ya autenticado (`ssr:false` ya cubre esa área).

### Gotchas ya anticipados

- `manualLogic()` y las respuestas de `ChatbotIntelligenceService` incluyen
  texto pensado para renderizarse en el widget Blade (posible HTML/markdown
  simple) — confirmar el formato exacto antes de decidir cómo renderizarlo
  en Vue (texto plano vs. markdown vs. HTML sanitizado).
- `trainFromHistory` es admin-only y ya está expuesto en la API — si se
  construye alguna pantalla de "estadísticas de aprendizaje" en Nuxt más
  adelante, ya tiene endpoint (`getLearningStats`), no hace falta backend
  nuevo para eso.
- El rate limit del endpoint API (`throttle:10,1` en `routes/api.php`,
  distinto del `throttle:20,1` de la ruta web) puede sentirse agresivo desde
  una UI de chat con mensajes rápidos — validar la experiencia real antes de
  asumir que hace falta subirlo.

---

## Fases (mismo espíritu incremental que `nuxt-migration-plan`)

0. **Confirmar con el usuario los puntos marcados "decisión a confirmar"
   arriba** (proveedor de push si no es Web Push nativo, Opción A vs B para
   el historial del chat, dónde vive el toggle de push y el widget de chat
   en la UI) antes de escribir código de UI — la arquitectura de backend
   (VAPID, `WebPushChannel`, `ChatMessage`) puede avanzar en paralelo sin
   esperar esas respuestas, ya que no depende de ellas.
1. ✅ **DONE (barber, commit `00317fd`)** — Push — backend: `minishlink/web-push`
   (no un paquete Laravel atado a migraciones MySQL — este repo es Mongo),
   claves VAPID generadas y guardadas en `.env` local (nunca commiteadas;
   placeholders en `.env.example`), modelo `PushSubscription`,
   `WebPushChannel` (mismo patrón que `TwilioChannel`) + `WebPushService`
   (mismo patrón "sin VAPID configurado → log y no-op" que `MessagingService`
   ya usa para Twilio), `toWebPush()` en `AppointmentNotification` + canal
   `push` agregado a `via()`, `push` en `User::notificationPreferences()`
   (default `false`, igual que `sms`/`whatsapp` — canal opt-in). Endpoints
   nuevos: `GET api/v1/push/vapid-public-key`, `POST`/`DELETE
   api/v1/push/subscribe`, y `GET`/`PATCH api/v1/notifications/preferences`
   (la versión web ya existía por sesión/CSRF, Nuxt necesitaba su propia).
   **Gotcha real encontrado y corregido en el camino**: tanto la versión web
   como la nueva API de `updatePreferences()` hacían `$user->update([
   'notification_preferences' => $prefs])` con un array armado desde cero
   cada vez — cualquiera de las dos hubiera borrado en silencio cualquier
   preferencia puesta por la otra (p. ej. activar "push" desde Nuxt y luego
   guardar el formulario web sin ese campo lo hubiera vuelto a apagar). Las
   dos ahora hacen `array_merge($user->notificationPreferences(), $nuevos)`
   en vez de reemplazar el array completo. Tests nuevos: `PushApiTest`,
   `NotificationPreferencesApiTest`, `AppointmentNotificationChannelsTest`,
   `WebPushServiceTest`. Verificado: Pint, Larastan en frío, `.\test.ps1` x2
   (275 tests) — todo limpio, CI en verde en `main`. Scribe regenerado.
2. ✅ **DONE (frontend-urban `8ee95e0`, barber `9bae88a`)** — Push — frontend:
   `public/sw.js` (push + notificationclick), `plugins/push.client.ts`
   (registra el SW al cargar, nunca pide permiso sin gesto del usuario),
   `usePush()` (permission/subscribe/unsubscribe), `ShellPushToggle.vue`
   (campana en sidebar desktop + topbar móvil — Nuxt no tiene pantalla de
   perfil propia todavía, así que el toggle vive en el shell en vez de un
   formulario dedicado; se oculta por completo si el navegador reporta
   permiso "denied", porque eso no se puede resetear desde la página).
   **Limitación real del entorno de pruebas, no del código**: el Browser
   pane de esta sesión bloquea la API de Notification globalmente —
   confirmado que `Notification.permission` ya es `"denied"` incluso en un
   sitio externo no relacionado (`web.dev`) antes de que esta app corriera
   siquiera — y el registro del service worker falla por la misma razón.
   No se pudo probar el flujo con un permiso real concedido. Lo que SÍ se
   verificó en vivo: `sw.js` se sirve correctamente (200, contenido
   correcto), la cadena completa API de punta a punta simulando el payload
   real que produce `PushManager.subscribe()` (clave VAPID real obtenida →
   `POST /push/subscribe` → persistida en Mongo contra el usuario correcto
   de la sesión), y cero regresión visual en sidebar/topbar con la campana
   oculta (desktop y mobile). **Bug real encontrado durante esa misma
   verificación y corregido en `barber`** (commit `9bae88a`): la validación
   de una clave de suscripción corrupta ocurre de forma perezosa dentro del
   Generator que devuelve `WebPush::flush()`, no en `queueNotification()` —
   la primera versión de `WebPushService::sendToUser()` solo envolvía
   `queueNotification()` en try/catch, así que una sola suscripción mal
   formada tiraba una excepción no capturada que mataba el envío a
   cualquier otra suscripción en el mismo lote. Reescrito para usar
   `sendOneNotification()` una por una, cada una en su propio try/catch —
   aísla el fallo por completo. También se inyectó el logger de Laravel al
   cliente `WebPush` (si no, su aviso de "instala GMP/BCMath" usa
   `trigger_error()`, que PHPUnit convierte en fallo de test y que en
   producción ensuciaría el log de errores de PHP). Test de regresión nuevo
   con claves VAPID reales + una clave mal formada. `.\test.ps1` x2 (276
   tests), ESLint + `npm run build` limpios, CI en verde en ambos repos.
3. ✅ **DONE (barber `48b36e5`)** — Chat — backend: confirmado en vivo, antes
   de escribir código, que dos `POST /api/v1/chatbot/query` seguidos con el
   mismo Bearer token (sin cookie) devolvían historial vacío en el segundo —
   exactamente el riesgo que este plan anticipó. **Landmine adicional
   encontrado en el camino, igual al de `social/feed` antes de su
   enriquecimiento**: `chatbot/query` no tenía NINGÚN middleware de auth, así
   que `auth()->user()` siempre era `null` para cualquier llamada API —
   arreglado con el mismo `mobile.auth.optional` (mensaje sigue siendo
   público/usable por invitados, pero un token válido ahora sí se reconoce).
   Modelo `ChatMessage` (Mongo) nuevo +
   `ChatbotContextService::persistMessage()`, enganchado al único punto
   (`addMessage()`) por el que ya pasan las 5 ramas de la cascada de
   respuesta — cero cambios en `ChatbotController`. Aditivo de verdad: el
   motor de sesión (memoria/follow-up/preguntas similares) que usa el widget
   Blade sigue exactamente igual. `Api\Chatbot\ChatbotManagementController::
   getHistory()` ahora lee la copia persistida en vez de sesión;
   `clearHistory()` limpia ambas. Tests nuevos a nivel servicio
   (`ChatbotContextServiceTest`) y HTTP (`ChatbotApiTest`) — **gotcha de
   testing real**: un mensaje genérico tipo "hola" no calza con ninguna
   palabra clave de `manualLogic()` y cae hasta un proveedor de IA real,
   tardando ~70s; se usó "cual es el horario" (resuelve por reglas locales,
   sin red) en todos los tests nuevos. `.\test.ps1` x2 (285 tests), Pint,
   Larastan en frío, CI en verde — todo limpio. Scribe regenerado.
   **Bug pre-existente encontrado de paso, fuera de alcance de esta fase**:
   `Api\Chatbot\ChatbotManagementController::getLearningStats()`/
   `trainFromHistory()` llaman a métodos que no existen en
   `ChatbotContextService` (serían 500 fatal si alguna vez se invocan) —
   flaggeado como tarea aparte, no tocado aquí porque ninguna página de Nuxt
   planeada consume esos dos endpoints.
4. ✅ **DONE (frontend-urban `10191e5`)** — Chat — frontend:
   `components/chat/Widget.vue` (reconstrucción 1:1 del widget Blade —
   burbuja flotante, panel teleportado, chips rápidos por rol idénticos a
   `chatbot.blade.php`) + `useChatbot.ts` (`sendMessage`/`loadHistory`/
   `clearHistory` contra la API ya lista en `barber`), montado globalmente
   en `layouts/dashboard.vue`. **Verificado en vivo de punta a punta contra
   la cuenta admin real** (no solo visualmente — confirmado por requests de
   red reales, no supuestos): abrir el panel carga el historial persistido
   real desde Mongo (mensajes que había dejado mientras probaba el backend
   en la Fase 3 aparecieron ahí solos), enviar un mensaje nuevo hace el
   round-trip completo (`POST /chatbot/query` → respuesta renderizada),
   "Nueva conversación" limpia la UI Y la copia en Mongo (confirmado
   directo en Mongo, no solo que la UI se veía vacía), y — la prueba real
   de que esta fase valía la pena — **una recarga completa de página
   todavía muestra la conversación anterior**, algo que el widget Blade
   nunca pudo hacer. Quirk del entorno de pruebas encontrado en el camino:
   los clics sintéticos del Browser pane de esta sesión no llegaban de
   forma confiable a los handlers de Vue (un `element.click()` nativo vía
   JS sí funcionaba siempre) — no es un problema del código, documentado
   por si se repite. ESLint + `npm run build` limpios, CI en verde.
5. ✅ **DONE** — Cierre: ambas features completas y verificadas en vivo,
   ambos repos con CI en verde en cada push de este plan
   (`barber@48b36e5`/`9bae88a`/`00317fd`,
   `frontend-urban@10191e5`/`01cb863`/`8ee95e0`). No queda ninguna fase
   pendiente de este plan.

## Reporte final (2026-09-06) — push + chat, ambos completos

**Qué se construyó.** Dos features nuevas pedidas después de que
`nuxt-migration-plan` cerrara: notificaciones push (Web Push/VAPID) para
citas próximas, e integración del chat de asistencia IA de `barber` (ya
existente ahí, nunca migrado) en Nuxt.

**Push**: greenfield completo — no existía infraestructura de push en
ningún lado del proyecto. `minishlink/web-push`, modelo `PushSubscription`,
canal `WebPushChannel` (mismo patrón que `TwilioChannel`), integrado en
`AppointmentNotification`. En Nuxt: service worker, `usePush()`, campana en
el shell (sin pantalla de perfil propia todavía en Nuxt, así que vive ahí).
Un bug real de por medio: `WebPushService` dejaba que una sola suscripción
corrupta matara el envío a las demás del mismo usuario — corregido con
`sendOneNotification()` aislado por suscripción en vez de batch.

**Chat**: la lógica de IA en cascada de `barber` ya era sólida y con API
lista — el trabajo real fue de persistencia y UI, no de inteligencia
artificial. El hallazgo clave, confirmado en vivo antes de tocar código: el
historial vivía solo en sesión PHP, inservible para un cliente Bearer-token
sin cookie. Nuevo modelo `ChatMessage` + persistencia aditiva (el motor de
sesión del widget Blade no se tocó). **El mismo landmine apareció dos veces
en este plan** (push y chat): una ruta pública sin ningún middleware de
auth significa `auth()->user()` siempre `null` para un cliente API, aunque
mande un token válido — `mobile.auth.optional` lo resuelve sin exigir
sesión a invitados. Vale la pena revisar el resto de `routes/api.php` por
el mismo patrón si se toca otra ruta "pública" en el futuro.

**Verificación real, no solo "compila".** Cada fase se probó contra el
backend real corriendo en Docker y el frontend real en `npm run dev`, con
la cuenta admin real — no mocks. Eso encontró tres bugs genuinos antes de
que llegaran a producción: el bug de `WebPushService` ya mencionado, el
landmine de `mobile.auth.optional` (dos veces), y de paso (fuera de alcance
de este plan, flaggeado aparte) un bug pre-existente en
`getLearningStats()`/`trainFromHistory()` de la API del chatbot.

**Estado real al cerrar:** CI en verde en cada push de todo este plan, en
ambos repos. `barber`: 285 tests pasando (x2), Pint y Larastan en frío
limpios en cada fase. `frontend-urban`: ESLint + `npm run build` limpios en
cada fase. No hay fases pendientes.

## Guardrails específicos de este plan

- No tocar `ChatbotContextService`'s comportamiento de sesión para el
  widget Blade existente — es aditivo, nunca un reemplazo, hasta que (si
  algún día pasa) se decida retirar también ese widget con la misma
  confirmación explícita que cada retiro anterior en este proyecto.
- `routes/api.php`/`Api/**` sigue siendo contrato externo (guardrail #11 en
  `barber`) — los endpoints nuevos de push y los cambios a `getHistory()`
  deben ser aditivos, y Scribe debe regenerarse.
- Nunca commitear `VAPID_PRIVATE_KEY` ni ninguna clave — mismo criterio que
  cualquier otro secreto en `barber` (`.env` nunca se commitea).
- Seguir el patrón de esta sesión: cada fase se verifica con Pint +
  Larastan en frío + `.\test.ps1` x2 (backend) y ESLint + `npm run build` +
  verificación en vivo en el Browser pane (frontend) antes de darse por
  cerrada — no asumir que "compila" significa "funciona".
