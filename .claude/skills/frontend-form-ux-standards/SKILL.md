---
name: frontend-form-ux-standards
description: Directrices, patrones de diseño UI/UX y checklist de auditoría de formularios en Nuxt 4 (UrbanBlade). Consultar antes y durante la creación o mejora de formularios, modales de captura, validaciones de campo, feedback de estados y mapeo con FormRequests de Laravel.
---

# Formularios UrbanBlade en Nuxt 4

## Objetivo

Crear o auditar formularios accesibles, coherentes con los cuatro temas de UrbanBlade y fieles al contrato Laravel. Antes de cambiar una pantalla, leer su endpoint, FormRequest/controlador y la implementación actual; la tabla siguiente es una guía y no sustituye al código vigente.

---

## Principios

1. No usar `window.alert()`, `window.confirm()` ni `window.prompt()`. Para confirmar una acción usar `useConfirm()`; el componente global `<UiConfirmModal />` ya está montado en `app/app.vue`. Para resultados no bloqueantes usar el sistema de toast/banner existente.

2. En un HTTP 422 conservar `errors: Record<string, string[]>` y mostrar el primer error debajo del campo correspondiente. Reservar un mensaje general para errores sin campo o conflictos de negocio.

3. **Accesibilidad y foco:**
   - Todo campo debe tener un `<label :for="id">` explícito, nunca solo un `placeholder`.
   - Asociar mensajes de error mediante `aria-describedby` y marcar inputs inválidos con `aria-invalid="true"`.
   - Mantener el tamaño de los objetivos táctiles (touch targets) en al menos 44×44 px en dispositivos móviles.
   - Usar `<form @submit.prevent>` para admitir Enter. Los modales cierran con Escape o backdrop, devuelven el foco al disparador y colocan foco inicial en Cancelar cuando la acción es destructiva.
   - Un diálogo lleva `role="dialog"`, `aria-modal="true"` y nombre accesible mediante `aria-labelledby` cuando sea posible.

4. **Carga y doble envío:**
   - Mientras una mutación asíncrona está en vuelo (`saving.value === true`), todos los botones de acción deben deshabilitarse (`:disabled="saving"`) y mostrar un spinner/texto indicador ("Guardando…", "Publicando…").
   - Proteger contra envíos duplicados por clics múltiples.

5. **Archivos:**
   - En campos de subida de fotos (avatar, portafolio, servicios, productos), generar previsualización inmediata del lado cliente usando `URL.createObjectURL(file)` antes de la subida.
   - Validar MIME y tamaño antes de la petición. Revocar cada URL temporal con `URL.revokeObjectURL()` al reemplazar el archivo o desmontar el componente.

6. **Temas:** usar exclusivamente tokens semánticos (`bg-card`, `text-ink`, `text-muted`, `border-line`, `bg-gold`) y comprobar noir, light, azul y rosa. No fijar fondos blancos/negros salvo overlays.

7. **Contrato y dinero:** enviar solo campos admitidos por Laravel. Nunca calcular ni enviar como autoridad precios, totales o importes; el backend relee esos valores. Para una cita de cliente no enviar `client_id`: se deriva del token.

---

## Contratos frecuentes

| Pantalla Frontend | Endpoint Backend | FormRequest / Validador | Campos Requeridos / Soportados |
| :--- | :--- | :--- | :--- |
| **`pages/profile.vue`** (Perfil de Usuario) | `PUT /api/v1/profile`<br>`PUT /api/v1/profile/password`<br>`DELETE /api/v1/profile` | `ProfileController` | `name`, `email`, `telefono`, `fecha_nacimiento`<br>Contraseña: `current_password`, `password`, `password_confirmation`<br>Eliminar: `password` |
| **`pages/barber/profile.vue`** (Perfil Barbero) | `POST /api/v1/barber/profile` | `UpdateBarberProfileRequest` | `especialidades` (string), `descripcion` (string), `foto` (file max 4MB) |
| **`pages/barber/schedule.vue`** (Horario Barbero) | `PUT /api/v1/barber/schedule` | `UpdateBarberScheduleRequest` | `schedules`: `[{ day_of_week, start_time, end_time, is_active }]` |
| **`pages/barber/portfolio.vue`** (Portafolio Barbero) | `POST /api/v1/barber/works` | `StoreWorkRequest` | `title` (string max 255), `description` (string max 2000), `media[]` (files max 50MB, img/video) |
| **`pages/services/index.vue`** (Catálogo Servicios) | `POST /api/v1/services/manage`<br>`PUT /api/v1/services/manage/{slug}` | `StoreServiceRequest`<br>`UpdateServiceRequest` | `nombre` (max 120), `categoria` (max 100), `precio` (numeric min 0), `duracion_min` (5-600), `descripcion`, `activo` (bool), `imagen` (file max 2MB) |
| **`pages/inventory/products/index.vue`** (Productos) | `POST /api/v1/inventory/products`<br>`PUT /api/v1/inventory/products/{id}` | `StoreProductRequest`<br>`UpdateProductRequest` | `nombre`, `categoria`, `descripcion`, `precio_compra`, `precio_venta`, `stock_actual`, `stock_minimo`, `tipo`, `imagen` (file max 2MB), `activo` (bool) |
| **`pages/inventory/movements/index.vue`** (Movimientos) | `POST /api/v1/inventory/movements` | `StoreInventoryMovementRequest` | `product_id`, `tipo` (entrada/salida), `cantidad` (min 1), `motivo` |
| **`pages/clients/index.vue`** (Gestión Clientes) | `POST /api/v1/admin/clients`<br>`PUT /api/v1/admin/clients/{slug}` | `ClientAdminController` | `name`, `email`, `telefono`, `password` (solo create, min 8), `fecha_nacimiento` |
| **`pages/users/index.vue`** (Gestión Cuentas) | `POST /api/v1/users`<br>`PUT /api/v1/users/{id}` | `StoreUserRequest`<br>`UpdateUserRequest` | `name`, `email`, `role`, `password` (create: required confirmed; edit: optional confirmed) |
| **`pages/settings/index.vue`** (Configuración) | `PUT /api/v1/settings` | `UpdateBarbershopSettingRequest` | `nombre`, `direccion`, `telefono`, `horario_apertura`, `horario_cierre`, `politica_cancelacion`, redes sociales, datos bancarios |
| **`pages/my/appointments/index.vue`** (Reserva cliente) | `POST /api/v1/appointments`<br>`GET /api/v1/availability/slots` | `AppointmentController`<br>`AvailabilityController` | `barber_id`, `service_id`, `fecha`, `hora_inicio`; el cliente sale del token. Las horas seleccionables provienen de disponibilidad. |
| **`pages/appointments/index.vue`** (Cita de staff) | `POST /api/v1/appointments`<br>`GET /api/v1/availability/slots` | `AppointmentController`<br>`AvailabilityController` | Staff puede capturar cliente según el contrato vigente; la disponibilidad es una sugerencia visible y los conflictos definitivos los decide el backend. |

---

## Patrón de implementación

1. **Manejo de Errores de API:**
   ```ts
   const fieldErrors = ref<Record<string, string[]>>({})
   const generalError = ref('')

   try {
     await apiFetch('/...', { method: 'POST', body: form })
   } catch (err: unknown) {
     const data = (err as { data?: { message?: string, errors?: Record<string, string[]> } })?.data
     if (data?.errors) {
       fieldErrors.value = data.errors
     }
     generalError.value = data?.message ?? 'Ocurrió un error inesperado.'
   }
   ```

2. **Renderizado de Campo con Error Asociado:**
   ```html
   <div>
     <label :for="`input-${name}`" class="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">
       {{ label }}
     </label>
     <input
       :id="`input-${name}`"
       v-model="value"
       :class="[
         'ui-input w-full',
         fieldErrors[name] ? 'border-red-500/60 focus:border-red-500' : 'border-line focus:border-gold'
       ]"
       :aria-invalid="!!fieldErrors[name]"
       :aria-describedby="fieldErrors[name] ? `error-${name}` : undefined"
     >
     <p v-if="fieldErrors[name]" :id="`error-${name}`" class="mt-1 text-xs text-red-400">
       {{ fieldErrors[name][0] }}
     </p>
   </div>
   ```

3. **Confirmaciones:**
   ```ts
   const { confirm } = useConfirm()
   const accepted = await confirm({
     title: 'Eliminar elemento',
     message: 'Esta acción no se puede deshacer.',
     confirmText: 'Eliminar',
     isDanger: true,
   })
   if (!accepted) return
   ```

4. **Disponibilidad de citas:** solicitar slots solo cuando existan barbero, servicio y fecha. Durante la carga deshabilitar la hora; si no hay slots, mostrar “Sin horarios libres”. Una respuesta 422 del POST debe conservar el motivo real del backend.

## Verificación antes de entregar

- Buscar usos nuevos o restantes de `alert(`, `confirm(` y `prompt(`; distinguir `useConfirm().confirm` de la API nativa.
- Ejecutar `npm.cmd run lint` y `npm.cmd run build` en Windows.
- Para cambios de recorridos críticos ejecutar las pruebas Playwright pertinentes. Estas usan un mock SSR en `127.0.0.1:8099`; no apuntar el mock al puerto 8000 porque allí puede estar Laravel con datos reales.
- Probar teclado, errores 422, estado de carga, doble clic, móvil y los cuatro temas.
- Revisar `git diff` y no incluir cambios concurrentes ajenos. No hacer commit ni push hasta que las comprobaciones aplicables estén limpias y el usuario lo haya autorizado.
