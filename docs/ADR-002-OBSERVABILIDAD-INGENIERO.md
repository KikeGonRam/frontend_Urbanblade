# ADR-002: observabilidad para ingeniero

Estado: aceptada; revisión estática del diseño el 28 de octubre de 2026.
La decisión original del panel está fechada el 6 de septiembre de 2026.

## Decisión

El ingeniero consume observabilidad de solo lectura: agregados del negocio en
/dashboard, estado técnico en /system y detalles permitidos en reportes/logs.
No obtiene permisos de administración como atajo para consultar salud.

El backend es responsable de autorización y de omitir datos personales.
Mostrar u ocultar un enlace en Nuxt no constituye una barrera suficiente.

## Fuentes y límites

- GET /api/v1/dashboard: indicadores y series agregadas.
- GET /api/v1/admin/system/status: estado de aplicación, conexiones, cola y scheduler.
- Los datos de módulos provienen del payload real; no fabricar valores si falta telemetría.
- Cola/latencia/salud no equivalen a estadísticas financieras.
- El contenido social se observa como agregados; no habilitar mutaciones del muro al ingeniero.

La UI se mantiene en [componentes](../app/components) y
[app/pages/system/index.vue](../app/pages/system/index.vue).
[e2e/dashboard-engineer.spec.ts](../e2e/dashboard-engineer.spec.ts) verifica
el comportamiento con mocks. La disponibilidad actual y los permisos remotos
requieren comprobarse en un entorno autorizado.

## Consecuencias

La navegación por rol y los endpoints deben evolucionar juntos.
La ausencia de datos se presenta como ausencia, no como “todo saludable”.
No publicar logs, nombres, tokens o dumps dentro de documentación o capturas.
