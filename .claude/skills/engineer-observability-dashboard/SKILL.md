---
name: engineer-observability-dashboard
description: Diseña o evoluciona el dashboard informativo del rol ingeniero de UrbanBlade sin ampliar permisos ni exponer datos operativos de clientes.
---

# Observabilidad para ingeniero

Usa esta skill al trabajar en `DashboardIngeniero.vue`, `/system`, la navegación de ingeniero o su contrato de métricas.

## Rol y límites

`ingeniero` es estrictamente de solo lectura. Puede ver comportamiento agregado de módulos, Reportes, Logs y Estado del Servidor; nunca recibe `*.gestionar`, listas operativas de clientes ni acciones de negocio.

No copies un template. Adapta solamente patrones útiles: resumen de salud, jerarquía de métricas, series temporales, estados críticos y navegación hacia el detalle. Usa los tokens y componentes de UrbanBlade, incluidos sus cuatro temas.

## Fuentes de datos

- `/dashboard` entrega el resumen agregado para `DashboardIngeniero.vue`.
- `/admin/system/status` alimenta `/system` con app, MongoDB, Redis, cola y tareas programadas.

No crees otro endpoint para datos ya incluidos. Si una métrica futura necesita una serie temporal, tasa o fuente no disponible, documenta su contrato mínimo en el plan y solicita el cambio en `barber` por separado. No inventes datos en el frontend.

## Validación

Comprueba que administrador e ingeniero conservan el acceso permitido y que los demás roles no obtienen nuevas rutas. Verifica `npm run lint` y `npm run build`; en backend, cualquier futuro cambio debe usar `barber\\test.ps1`, no `php artisan test` directo.
