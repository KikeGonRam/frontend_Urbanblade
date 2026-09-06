---
name: stripe-and-ops-role-plan
description: Plan y arquitectura para dos iniciativas nuevas — robustecer la integración de Stripe (y más adelante, autopago del cliente), y un nuevo rol "ingeniero" con panel de estado del servidor (Laravel Pulse) + todo lo que ve administrador. Leer antes de tocar StripeWebhookController, PaymentController::stripeIntent(), RolePermissionSeeder, o cualquier página nueva de sistema/ops.
---

# Stripe (robustecer + autopago futuro) y rol "ingeniero" — plan y arquitectura

## Contexto

Pedido del dueño del proyecto (2026-09-06), después de cerrar push-and-chat-plan:
1. Stripe ya tiene claves configuradas y el flujo de cobro por staff funciona
   — quiere que quede "bien integrado". Decisión tomada con el usuario:
   **ambas cosas, en fases separadas** — primero robustecer lo que ya existe
   (Fase A), luego evaluar el autopago del cliente como fase aparte (Fase B,
   alcance a definir cuando se aborde).
2. Un rol nuevo, **"ingeniero"**, para alguien de sistemas: ve todo lo
   técnico (estado del servidor, colas, errores, analítica avanzada) **y
   además todo lo que ve `administrador`** hoy (citas, pagos, clientes,
   etc.) — no es un rol aparte y limitado, es un superset de administrador.
   Decisión tomada: usar **Laravel Pulse** (paquete oficial) como base del
   monitoreo, en vez de construir todo a medida.

**IMPORTANTE — antes de escribir código**: releer directamente en `barber`
los archivos citados en cada sección (líneas exactas) — este plan puede
quedar desactualizado si el backend cambia después de escribirlo, mismo
criterio que `push-and-chat-plan`/`nuxt-migration-plan`.

---

## Parte 1: Stripe

### Qué existe hoy (auditoría 2026-09-06) — más completo de lo esperado

El flujo de cobro por staff con Stripe **ya funciona de verdad**, no es solo
plomería:
- `PaymentController::stripeIntent()` (`app/Http/Controllers/Api/Payment/
  PaymentController.php:213-260`) — solo admin/recepción, monto
  **100% recalculado en servidor** (`precio_cobrado`/`service->precio` +
  descuento de lealtad + canje de puntos, nunca del cliente), delega a
  `StripePaymentService::createPaymentIntent()`.
- `StripePaymentService` (`app/Services/Payment/StripePaymentService.php`) —
  wrapper delgado del SDK, instanciación perezosa del `StripeClient` para
  que un entorno sin `STRIPE_SECRET` (como CI) no truene en otras acciones
  del mismo controlador.
- Frontend: `frontend-urban/app/pages/payments/index.vue` (líneas ~239-304)
  tiene una implementación **real y completa** de Stripe Elements
  (`loadStripe()`, `elements()`, card Element montado,
  `confirmCardPayment()`), gateada por `stripeConfigured =
  Boolean(config.public.stripeKey)`. No es un stub.
- `StripeWebhookController` (`app/Http/Controllers/Api/Payment/
  StripeWebhookController.php`) es la **red de seguridad**, no el camino
  principal: si el formulario del cliente ya registró el pago, el webhook
  intenta lo mismo, `PaymentService::create()` lanza `PaymentException`
  ("cita ya tiene un pago registrado"), y eso se captura como caso esperado
  (idempotente), no como error.
- Todo converge en `PaymentService::completeCharge()` — Stripe recibe el
  mismo tratamiento que efectivo/transferencia (marca cita completada,
  otorga puntos, genera PDF, notifica), sin código especial.

### Gaps reales encontrados

- **Cero cobertura de tests** en todo el flujo de Stripe (`grep -rli
  stripe tests/` no devuelve nada) — para algo que mueve dinero real, esto
  es el hueco más importante a cerrar antes de "está bien integrado".
- `StripeWebhookController::handle()` solo maneja 2 tipos de evento
  (`payment_intent.succeeded`/`payment_intent.payment_failed`) — nada de
  `charge.refunded`, `charge.dispute.created`, etc. Un reembolso o
  contracargo hecho desde el dashboard de Stripe hoy no se refleja en
  absoluto en `barber`.
- `onFailed()` (líneas 107-116) solo registra un log — no notifica a nadie
  (ni cliente ni staff) que el cobro falló.
- `.env.example` **no tiene ninguna sección de Stripe** (ni siquiera
  placeholders vacíos), a diferencia de VAPID/Sentry que sí documentan sus
  variables — inconsistente con el resto del repo.

### Fase A: robustecer lo existente (alcance de esta fase, ya acordado)

1. **Tests** (el gap más importante):
   - `StripeWebhookControllerTest`: firma inválida → 400; `onSucceeded()`
     crea el `Payment` con el monto recalculado en servidor (no el que
     venga en el payload de Stripe); pago duplicado (cita ya cobrada) no
     truena, se ignora limpiamente; `onFailed()` no crea ningún registro.
   - `PaymentController::stripeIntentTest`: gate de rol (solo
     admin/recepción), monto ignora cualquier valor enviado por el cliente
     y recalcula descuento/puntos igual que el resto de flujos de cobro.
   - Mockear el SDK de Stripe en vez de pegarle a la API real: inyectar un
     `StripePaymentService`/`StripeClient` fake en el contenedor de
     servicios para los tests (el SDK de Stripe usa cURL directo, no la
     fachada `Http`, así que `Http::fake()` no sirve aquí).
2. **Webhook más completo**: agregar manejo de `charge.refunded` (revertir
   puntos otorgados / marcar el `Payment` como reembolsado — definir el
   campo/estado exacto revisando `app/Models/Payment.php` primero) y
   `charge.dispute.created` (al menos notificar a admin, sin lógica
   automática de reversión todavía).
3. **`onFailed()` notifica**: usar el mismo patrón de
   `AppointmentNotification`/`BusinessEventService` ya establecido en el
   resto del proyecto en vez de solo loggear.
4. **`.env.example`**: agregar la sección de Stripe (mismo estilo de
   comentario que el bloque de VAPID que ya existe), sin valores reales.
5. Verificar con Pint + Larastan en frío + `.\test.ps1` x2, como cada fase
   anterior de este proyecto.

### Fase B: autopago del cliente (alcance a definir, deliberadamente NO detallado aquí todavía)

Hoy **nadie fuera de staff puede pagar con tarjeta** — no existe ningún
flujo donde el cliente use su propia tarjeta (ni para citas, ni para la
tienda/carrito). Antes de construir esto hace falta decidir con el usuario:
¿aplica a pagar una cita directamente, al checkout de la tienda/carrito, a
la membresía, o a varias de esas cosas? Cada una tiene su propio modelo de
datos (`Appointment`, `Order`, algo de membresía) y probablemente necesita
su propio `PaymentIntent` con metadata distinta. **No asumir el alcance —
confirmar con el usuario cuando se aborde esta fase**, siguiendo el mismo
criterio que el resto de este proyecto (nunca inventar alcance de negocio
sin confirmar).

---

## Parte 2: Rol "ingeniero" (técnico + superset de administrador)

### Decisión: Laravel Pulse como base del monitoreo — con un matiz técnico real

Laravel Pulse guarda sus métricas (colas, jobs, excepciones, queries
lentas, uso) en tablas relacionales propias vía Eloquent, con operaciones
(upserts, agregaciones) pensadas para MySQL/SQLite/Postgres — **no para
MongoDB**, que es la conexión por defecto de este proyecto. Esto no bloquea
la decisión (Pulse soporta explícitamente usar una conexión de BD distinta
a la de la app vía `PULSE_DB_CONNECTION`, exactamente para este caso), pero
sí implica trabajo de infraestructura antes de instalarlo:

- El `Dockerfile` de `barber` solo instala `pdo` (genérico) — **no**
  `pdo_sqlite` ni `pdo_mysql`. Ninguno de los dos está disponible hoy en el
  contenedor `app`.
- **Recomendado**: agregar `pdo_sqlite`/`sqlite3` al Dockerfile y usar un
  archivo SQLite dedicado (`storage/pulse.sqlite` o similar) para la
  conexión de Pulse — más liviano que levantar un servicio MySQL nuevo en
  `docker-compose.yml` solo para esto, y Pulse soporta SQLite
  explícitamente para instalaciones pequeñas/medianas como esta.
- Alternativa (más pesada, no recomendada salvo que el usuario prefiera
  MySQL real): nuevo servicio `mysql` en `docker-compose.yml` +
  `pdo_mysql` en el Dockerfile.

### Piezas a construir

**Backend (`barber`)**:
1. `composer require laravel/pulse`, publicar config/migraciones, correr
   las migraciones de Pulse **contra la conexión SQLite dedicada**, no
   contra `mongodb` (default) ni contra `mongo-test` (los tests).
2. Nueva variable `sistema.ver` en `RolePermissionSeeder.php` (nueva
   permission, junto a las 11 ya existentes).
3. Rol `ingeniero`: **mismo set de permisos que `administrador` (los 11) +
   `sistema.ver`** — no es un rol aparte con su propio subconjunto, es
   administrador más una cosa. Al seedearlo, construir su lista de
   permisos como `array_merge($administradorPermisos, ['sistema.ver'])`
   en vez de copiar la lista a mano, para que nunca se desincronicen si
   `administrador` gana un permiso nuevo más adelante.
4. **Auditoría necesaria, no opcional**: todo lugar que hoy dice
   `role.custom:administrador` (en `routes/api.php` y `routes/web.php`)
   necesita agregar `,ingeniero` para que el rol nuevo de verdad vea "todo
   lo que ve administrador" — es un cambio mecánico pero amplio, hay que
   revisarlo ruta por ruta, no asumir que hay un atajo (`EnsureUserHasRole`
   ya compara contra una lista explícita de roles permitidos por ruta, no
   hay herencia de roles en el middleware actual).
5. Nuevo controlador `Api\Admin\System\SystemController` (o similar):
   expone una vista curada de lo que Pulse ya recolecta (throughput de
   colas, jobs fallidos, excepciones recientes, tiempo de respuesta) más
   chequeos propios que Pulse no cubre: ping a Mongo (`DB::connection('mongodb')
   ->getDatabase()->command(['ping' => 1])` o equivalente), ping a Redis
   (para el estado real de la cola, ya confirmado Redis-backed vía
   `QUEUE_CONNECTION=redis`), y última ejecución de cada comando programado
   de `routes/console.php` (13 comandos hoy — necesita que cada uno
   registre su propio "última vez que corrí" en cache/Mongo, Pulse no lo
   sabe de forma nativa).
6. Ruta nueva `GET /api/v1/admin/system/status`, gateada por
   `role.custom:administrador,ingeniero` + `permission.custom:sistema.ver`
   (igual de estricta que el resto del panel admin).
7. Scribe (`php artisan scribe:generate`) para documentar el endpoint
   nuevo — contrato externo, guardrail #11.

**Frontend (`frontend-urban`)**:
8. `useNavigation.ts`: nueva sección "Sistema" (o el nombre que se prefiera)
   visible solo para `ingeniero`, con el link al nuevo dashboard. Además,
   **las secciones "Gestión"/"Análisis" que hoy solo se muestran a
   `isAdmin` deben mostrarse también a `isEngineer`** (mismo criterio que
   el backend: ingeniero ve todo lo que ve administrador). Se necesita un
   nuevo booleano `isEngineer` junto a `isAdmin`/`isReception`/etc., y
   cambiar cada `if (isAdmin.value)` relevante a `if (isAdmin.value ||
   isEngineer.value)`.
9. Página nueva `pages/system/index.vue`: tarjetas de estado (colas,
   jobs fallidos, excepciones recientes, ping Mongo/Redis, última
   ejecución de comandos programados), reusando el patrón visual ya
   establecido (`ui-card`, mismos componentes de KPI que el dashboard
   admin).
10. Ampliar `AuthUser`/`useAuth()` si hace falta para que `hasRole('ingeniero')`
    funcione igual que los demás roles (ya debería, es genérico).
11. `routeRules` en `nuxt.config.ts`: `'/system': { ssr: false }` (mismo
    patrón que el resto del panel autenticado).

### Gotchas ya anticipados

- El middleware de roles actual (`EnsureUserHasRole`) no tiene concepto de
  jerarquía/herencia — cada ruta lista explícitamente qué roles puede ver.
  No hay atajo para "ingeniero hereda todo de administrador" a nivel
  código; hay que tocar cada ruta relevante. Vale la pena, al hacerlo,
  documentar en el propio `RolePermissionSeeder.php` por qué la lista de
  permisos de `ingeniero` se construye a partir de la de `administrador`
  en vez de copiarse aparte (para que quien lo lea después entienda la
  intención).
- Pulse necesita correr su propio `pulse:check` (o el driver de captura
  automática vía middleware, que Pulse instala por defecto) — confirmar
  que el contenedor `worker`/`scheduler` ya existentes en
  `docker-compose.yml` puedan correrlo sin agregar un proceso nuevo.
- Ping a Mongo/Redis debe tener timeout corto y no bloquear el endpoint si
  alguno está caído — el propósito del dashboard es justamente detectar
  eso, así que debe degradar con gracia (mostrar "caído", no tronar la
  petición completa).

## Fases (mismo espíritu incremental que los planes anteriores)

0. **Confirmar con el usuario, antes de programar**: nombre final de la
   sección de navegación del nuevo rol si "Sistema" no convence, y si el
   ping de Mongo/Redis + últimas ejecuciones de comandos es suficiente
   "estado del servidor" para la v1, o si además quiere métricas de
   CPU/memoria del host (eso requiere el binario `pulse:check` corriendo
   con acceso al sistema, más contenedor Docker friction).
1. ⏳ **Stripe Fase A**: tests + webhook ampliado + `.env.example`.
2. ⏳ **Rol ingeniero — infraestructura**: Dockerfile (sqlite), Pulse
   instalado y migrado, permission/rol seedeados.
3. ⏳ **Rol ingeniero — backend**: `SystemController`, ruta, auditoría de
   `role.custom:administrador` → agregar `,ingeniero` en todo el repo,
   Scribe.
4. ⏳ **Rol ingeniero — frontend**: nav, página de sistema, `isEngineer` en
   las secciones que ya existen.
5. ⏳ **Stripe Fase B**: alcance a definir con el usuario cuando se llegue
   aquí (autopago del cliente).
6. ⏳ **Cierre**: reporte final, CI verde en ambos repos.

## Guardrails específicos de este plan

- Nunca tocar el monto de un `PaymentIntent`/webhook a partir de lo que
  manda el cliente o Stripe — sigue siendo la regla del guardrail #13 en
  `barber`, y ya se respeta hoy; no romperla al ampliar el webhook.
- El rol `ingeniero` es un superset de `administrador`, no un reemplazo —
  cualquier ruta nueva que se agregue a `administrador` en el futuro
  también debería considerarse para `ingeniero` (por eso el
  `array_merge` en el seeder en vez de una lista copiada a mano).
- Pulse usa su propia conexión de BD (SQLite dedicada) — nunca apuntarlo a
  la conexión `mongodb` por defecto ni a `mongo-test`, y nunca dejar que
  sus migraciones corran contra la base compartida con `spark/`.
- Seguir el patrón de verificación de todo este proyecto: Pint + Larastan
  en frío + `.\test.ps1` x2 (backend), ESLint + `npm run build` +
  verificación en vivo en el Browser pane (frontend), antes de dar
  cualquier fase por cerrada.
