---
name: stripe-and-ops-role-plan
description: Plan y arquitectura para dos iniciativas nuevas — robustecer la integración de Stripe (y más adelante, autopago del cliente), y un nuevo rol "ingeniero" de solo lectura (dashboards/analítica/reportes/estado del servidor, sin gestionar nada de negocio) con Laravel Pulse. Leer antes de tocar StripeWebhookController, PaymentController::stripeIntent(), RolePermissionSeeder, o cualquier página nueva de sistema/ops.
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
   técnico (estado del servidor, colas, errores) y el comportamiento de
   cada módulo (dashboards, analítica, reportes) — pero **sin capacidad de
   gestionar nada de negocio** (nada de crear/editar/eliminar usuarios,
   clientes, servicios, barberos, configuración; sí puede sacar reportes).
   Corregido el 2026-09-06 después de una primera versión de este plan que
   lo planteaba como superset de `administrador` — el usuario fue
   explícito en que eso no debía pasar, precisamente para no ampliar la
   superficie de riesgo si esta cuenta se compromete. Decisión tomada:
   usar **Laravel Pulse** (paquete oficial) como base del monitoreo, en
   vez de construir todo a medida.

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

## Parte 2: Rol "ingeniero" (técnico + solo lectura de negocio — CORREGIDO 2026-09-06)

**Corrección importante del usuario, después de la primera versión de este
plan**: NO es un superset de `administrador` con las mismas 11
`*.gestionar`. El usuario fue explícito: *"no va a poder la realización de
crear usuarios, etc. — todo lo que tenga que ver para que no se comprometa
este rol es para el dashboard de cada módulo de comportamiento, pero sí
debe sacar reportes"*. Es decir: **ingeniero ve el comportamiento/las
métricas de cada módulo (dashboards, analítica, reportes) y el estado del
servidor, pero cero capacidad de gestionar (crear/editar/eliminar) nada de
negocio** — ni usuarios, ni clientes, ni servicios, ni barberos, ni
configuración, ni inventario. Menos superficie de permisos = menos riesgo
si esta cuenta se ve comprometida, que fue exactamente el razonamiento del
usuario.

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
2. Nueva permission `sistema.ver` en `RolePermissionSeeder.php`, junto a
   las 11 ya existentes.
3. Rol `ingeniero`: **solo `reportes.ver`, `logs.ver`, y el nuevo
   `sistema.ver`** — NADA de los permisos `*.gestionar` (citas, pagos,
   inventario, clientes, servicios, usuarios, barberos, configuración).
   No hereda de `administrador`; es un rol independiente y deliberadamente
   angosto: ve comportamiento/métricas de cada módulo (dashboard,
   analítica, reportes) y el estado del servidor, pero no puede crear,
   editar ni eliminar nada de negocio. Menos superficie de permisos si
   esta cuenta se ve comprometida — razón explícita del usuario.
4. **Auditoría por RUTA, no por rol en bloque** — más fina que "agregar
   ingeniero donde esté administrador": revisar `routes/api.php` y
   agregar `ingeniero` únicamente a las rutas de **solo lectura** que
   correspondan a dashboard/analítica/reportes/logs (p. ej.
   `Api\Dashboard\DashboardController`, `Api\Analytics\AnalyticsController`,
   `Api\Report\ReportController`/`Api\Admin\Report\ReportAdminController`,
   `Api\Log\LogController`, y el nuevo `Api\Admin\System\SystemController`).
   **Nunca** agregarlo a rutas de creación/edición/eliminación
   (`Api\Admin\User\*`, `Api\Admin\Client\*`, `Api\Admin\Barber\*` de
   escritura, `Api\Service\ServiceManagementController` de escritura,
   `Api\Setting\SettingController` de escritura, `Api\Admin\Inventory\*`
   de escritura) — esas se quedan exclusivas de `administrador`. Si una
   ruta ya mezcla lectura y escritura en el mismo controlador con
   middleware a nivel de clase (no por método), puede hacer falta separar
   el middleware por método en vez de por controlador completo.
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
8. `useNavigation.ts`: nuevo booleano `isEngineer` (`hasRole('ingeniero')`).
   Nueva sección "Sistema" visible solo para `ingeniero`. La sección
   "Análisis" (Analítica, Reportes, y — si ya existiera — Logs) se muestra
   también a `isEngineer`, igual que a `isAdmin`. La sección **"Gestión"
   (Barberos, Reseñas, Usuarios, Servicios, Productos, Configuración) NO
   se le muestra a `ingeniero`** — son pantallas de creación/edición, fuera
   de su alcance por diseño.
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
1. ✅ **DONE (barber commit `d2dfa9a`)** — **Stripe Fase A**: tests + webhook
   ampliado + `.env.example`. `StripeWebhookController` ahora maneja 4 tipos
   de evento (antes solo `payment_intent.succeeded` de verdad procesaba
   algo, el resto ni se leía): `payment_intent.succeeded` (sin cambios de
   fondo, ya enrutaba por `PaymentService::create()`), `payment_intent.
   payment_failed` (antes solo loggeaba, ahora también avisa a
   staff vía `AppointmentNotifier::sendStaff()`, subject "Pago con tarjeta
   fallido"), `charge.refunded` (nuevo — busca el `Payment` local por
   `stripe_payment_id`, si existe avisa a staff con el monto reembolsado;
   si no hay match local, no-op silencioso, sin reversión automática de
   puntos/cita — eso queda para cuando se definan esas reglas de negocio) y
   `charge.dispute.created` (nuevo — mismo patrón de solo avisar). Monto
   sigue calculándose 100% server-side desde `precio_cobrado`/`service.
   precio` (guardrail #13), nunca del payload de Stripe — cubierto
   explícitamente en test con un monto absurdo (999999) en el payload que
   el webhook debe ignorar. `.env.example` documentado con las 3 claves de
   Stripe y qué rompe si falta cada una. Tests nuevos:
   `StripeWebhookControllerTest` (8 casos: firma inválida, monto
   server-computed, idempotencia en reintentos de Stripe, fallido+aviso,
   reembolso sin match, reembolso con match+aviso, disputa sin match,
   evento no manejado = no-op) y 3 casos nuevos en `PaymentApiTest` para
   `stripeIntent()` (gate solo-staff, monto con descuento de lealtad
   calculado server-side vía mock de `StripePaymentService`, tope de
   canje de puntos rechazado con 422). `.\test.ps1` x2 en verde (313 tests),
   `pint --test` limpio, CI verde confirmado (`gh run view` → `success`).
2. ✅ **DONE (barber commit `0c5301d`)** — **Rol ingeniero —
   infraestructura**: `Dockerfile` ahora instala `pdo_sqlite`/`sqlite3`
   (Pulse no soporta MongoDB, la conexión por defecto de este proyecto).
   Nueva conexión `'sqlite'` en `config/database.php` apuntando a
   `database/pulse.sqlite` (archivo local, fuera de Atlas, no compartido
   con `spark/` — Pulse solo guarda métricas efímeras de requests/jobs/
   excepciones, no datos de negocio). `laravel/pulse` instalado vía
   Composer, config/migración publicadas
   (`database/migrations/2026_09_06_142509_create_pulse_tables.php`), y
   ya migrado (tablas `pulse_values`/`pulse_entries`/`pulse_aggregates`
   creadas en el sqlite local). El archivo `pulse.sqlite` no existe solo
   en esta versión de Laravel (`touch` agregado a `.docker/entrypoint.sh`
   y a los jobs `backend`/`smoke` de CI, antes de cualquier `migrate`).
   `/pulse` (la ruta que el propio paquete auto-registra) queda protegida
   por un `Gate::define('viewPulse', ...)` explícito en
   `AppServiceProvider::boot()` — administrador o ingeniero solamente —
   en vez de depender del default-deny silencioso de Pulse por ability no
   definida (verificado con `curl` sin sesión → 403).
   `RolePermissionSeeder` siembra el permiso nuevo `sistema.ver` y el rol
   `ingeniero` con **exactamente** `reportes.ver` + `logs.ver` +
   `sistema.ver` — nada de `*.gestionar`, deliberadamente NO superset de
   administrador (la corrección que el usuario pidió sobre la primera
   versión de este plan). Nuevo test `RolePermissionSeederTest` fija esa
   invariante con dos aserciones: la lista exacta de permisos de
   ingeniero, y que sea subconjunto estricto de administrador — para que
   un futuro cambio que copie mal la lista de permisos (el error que
   motivó la corrección) truene en CI en vez de llegar a producción.
   `.\test.ps1` en verde (315 tests, +2 sobre la fase anterior), `pint
   --test` limpio, Larastan sin errores nuevos, CI verde confirmado (los
   3 jobs — backend con el step nuevo "Create Pulse SQLite database",
   smoke con `migrate --seed` corriendo también la migración de Pulse sin
   problema, y frontend/security sin cambios).
   Aún sin rutas ni páginas para el rol — eso es la fase 3 (backend) y 4
   (frontend) de abajo.
3. ✅ **DONE (barber commit `97609c6`)** — **Rol ingeniero — backend**:
   nuevo `GET /api/v1/admin/system/status` (`SystemController`): ping real
   de Mongo Atlas y Redis con latencia (no solo "la conexión existe"),
   tamaño de la cola y total de jobs fallidos, y última corrida
   (éxito/fallo/cuándo/cuánto tardó) de cada una de las 12 tareas de
   `routes/console.php` — vía `ScheduledTaskMonitor`
   (`App\Services\System`), que escucha los eventos
   `ScheduledTaskFinished`/`ScheduledTaskFailed` que el propio scheduler
   de Laravel ya dispara en cada corrida de `schedule:run`, sin tener que
   instrumentar cada `Schedule::command()` a mano (solo se les agregó
   `->description()` para un nombre limpio). Truco necesario: `routes/
   console.php` solo se carga en contexto de consola
   (`bootstrap/app.php`), así que en una petición HTTP normal el
   `Schedule` del contenedor llega vacío — `SystemController` lo detecta y
   hace `require_once` del archivo él mismo, seguro porque cada request de
   php-fpm arranca una `Application` nueva.
   Auditoría ruta por ruta de `role.custom:administrador` en
   `routes/api.php`: se agregó `,ingeniero` **solo** a los endpoints de
   solo lectura (dashboards, reportes, predicciones, logs, el nuevo
   `system/status`) más `permission.custom:reportes.ver` / `logs.ver` /
   `sistema.ver` como defensa en profundidad — nunca a rutas de gestión
   (usuarios, clientes, barberos, servicios, inventario, configuración,
   campañas, sorteos, reseñas siguen siendo solo administrador).
   Hallazgo a mitad de esta fase: 5 controladores (`DashboardAdminController`,
   `ReportAdminController`, `PredictionController`, `ReportController`,
   `LogController`) tenían además su propio guard interno
   (`authorizeAdmin()`/`abort_if` con `hasRole('administrador')` fijo a
   ese único rol) que habría bloqueado a ingeniero con 403 incluso
   después de pasar el middleware de la ruta — verificado en vivo con
   `curl` antes de asumir que el middleware solo bastaba. Los 5 se
   actualizaron para aceptar también `hasRole('ingeniero')`.
   Nuevo test `EngineerRoleAuthorizationTest` prueba el límite completo de
   punta a punta (HTTP + Bearer token real, no solo el middleware en
   aislamiento): ingeniero llega a los 7 endpoints de solo lectura y
   recibe 403 en los 12 endpoints de gestión que motivaron la corrección
   original del alcance de este rol. `SystemControllerTest` cubre la
   forma de la respuesta y que `ScheduledTaskMonitor` registre
   éxito/fallo correctamente (con un `Event` real de
   `Illuminate\Console\Scheduling`, no un mock — Larastan marcaba tipos
   incompatibles con Mockery en los eventos tipados). `.\test.ps1` x2 en
   verde (321 tests, +6 sobre la fase anterior), `pint --test` limpio,
   Larastan sin errores nuevos (sí hubo que resolver un
   `method.notFound` real en `getMongoDB()` con un `@var` de tipo, no un
   baseline), Scribe regenerado, CI verde confirmado.
   **Hallazgo aparte, reportado al usuario, no tocado en este commit**:
   el propio `system/status` reveló en producción real 4,171 jobs
   fallidos en la cola (`AppointmentNotification`, causa raíz: límite
   diario de envíos de Gmail SMTP excedido, viene fallando desde mediados
   de julio) — exactamente el tipo de problema que este dashboard existe
   para exponer. Pendiente de decisión del usuario (cambiar proveedor de
   correo, purgar los fallidos, etc.), no es responsabilidad de esta fase
   de infraestructura arreglarlo.
4. ⏳ **Rol ingeniero — frontend**: nav, página de sistema, `isEngineer` en
   las secciones que ya existen.
5. ⏳ **Stripe Fase B**: alcance a definir con el usuario cuando se llegue
   aquí (autopago del cliente).
6. ⏳ **Cierre**: reporte final, CI verde en ambos repos.

## Guardrails específicos de este plan

- Nunca tocar el monto de un `PaymentIntent`/webhook a partir de lo que
  manda el cliente o Stripe — sigue siendo la regla del guardrail #13 en
  `barber`, y ya se respeta hoy; no romperla al ampliar el webhook.
- El rol `ingeniero` es de solo lectura por diseño (`reportes.ver`,
  `logs.ver`, `sistema.ver`) — nunca agregarlo a una ruta de
  creación/edición/eliminación aunque parezca conveniente o "más simple"
  en el momento. Si una futura ruta nueva de solo lectura (otro reporte,
  otro dashboard) tiene sentido para este rol, agregarla explícitamente
  ruta por ruta, no dándole `administrador` completo como atajo.
- Pulse usa su propia conexión de BD (SQLite dedicada) — nunca apuntarlo a
  la conexión `mongodb` por defecto ni a `mongo-test`, y nunca dejar que
  sus migraciones corran contra la base compartida con `spark/`.
- Seguir el patrón de verificación de todo este proyecto: Pint + Larastan
  en frío + `.\test.ps1` x2 (backend), ESLint + `npm run build` +
  verificación en vivo en el Browser pane (frontend), antes de dar
  cualquier fase por cerrada.
