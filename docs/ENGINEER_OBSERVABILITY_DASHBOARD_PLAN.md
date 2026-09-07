# ADR-001: Dashboard de observabilidad para ingeniero

**Estado:** Aceptado  
**Fecha:** 2026-09-06

## Decisión

El rol `ingeniero` tendrá un centro de observabilidad de solo lectura, no un panel administrativo. Se compone de dos superficies:

```text
Dashboard (/dashboard)          Estado del servidor (/system)
modulos y tendencias            salud tecnica y tareas
        |                                 |
        +---------- Reportes / Logs ------+
```

`DashboardIngeniero.vue` comunica comportamiento agregado de Citas, Ingresos, Servicios, Barberos, Clientes y Chatbot. No muestra nombres ni listas de clientes. `/system` muestra conectividad de MongoDB y Redis, trabajos en cola, tareas programadas y versiones de la app.

## Contratos actuales

| Vista | Fuente | Datos actuales |
|---|---|---|
| `/dashboard` | `GET /api/v1/dashboard` | KPIs y gráficas agregadas por módulo |
| `/system` | `GET /api/v1/admin/system/status` | App, MongoDB, Redis, cola y scheduler |
| `/reports`, `/logs` | Endpoints existentes de solo lectura | Detalle y evidencia histórica |

No se necesita un endpoint nuevo para la primera fase: los dos contratos ya cubren el resumen funcional y el estado técnico.

## Cobertura por módulo

| Módulo | Estado actual para ingeniero | Fuente |
|---|---|---|
| Citas, ingresos, servicios, barberos, clientes y chatbot | KPI o gráfica agregada | `/dashboard` |
| Inventario | Productos con stock bajo | `/dashboard` |
| Infraestructura, cola y scheduler | Salud y detalle técnico | `/admin/system/status` |
| Pagos, pedidos, campañas, sorteos y muro | Conteos y montos agregados por ventana | `moduleTelemetry` en `/dashboard` |

El muro no se muestra a ingeniero. Si se requiere observabilidad social, el backend debe exponer únicamente totales y tendencias agregadas (publicaciones, reacciones, comentarios y errores), nunca el feed ni sus mutaciones.

## Fases

1. **Base y permisos — completada.** Rol de solo lectura, navegación limitada y dashboard agregado por módulo.
2. **Estado técnico — completada.** Endpoint `system/status`, página `/system` y tareas programadas.
3. **Experiencia de monitor — completada en frontend.** Resumen de salud, incidentes visibles, rutas al detalle y estados vacíos honestos; no se fabrican series ni telemetría.
4. **Cobertura transversal — completada.** `moduleTelemetry` añade pagos, pedidos, campañas, sorteos y actividad social al mismo payload del dashboard. Sus valores son agregados con ventana mensual explícita; la cola, fallos y latencia siguen en `system/status`. Las rutas operativas no se abren al rol.

## Criterios de aceptación

- Ingeniero no ve Gestión ni puede mutar negocio.
- Un fallo de MongoDB, Redis, cola o scheduler es visible sin entrar a otra pantalla.
- Las gráficas y tarjetas usan datos reales o declaran que aún no hay datos.
- La experiencia funciona en los cuatro temas, con foco visible y movimiento reducido.
