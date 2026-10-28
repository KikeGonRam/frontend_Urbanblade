# Decisiones del frontend

Revisión contra el código: 28 de octubre de 2026.
Las decisiones describen el diseño implementado; no conceden autorización operativa.

| ID | Decisión | Motivo / consecuencia |
| --- | --- | --- |
| F01 | Nuxt/Vue separado del backend. | Reutiliza conocimientos Vue; contrato HTTP como frontera. No hay acceso directo a MongoDB. |
| F02 | SSR híbrido con reglas por ruta. | SEO público y paneles con CSR. Revisar HTML inicial para metadatos, no solo DOM hidratado. |
| F03 | Token Bearer propio en cookie legible por JS. | Compatible con la API existente; requiere cuidado especial frente a XSS. No es una sesión HttpOnly/BFF. |
| F04 | Tipos generados de una copia versionada de OpenAPI. | Evita duplicar interfaces; el drift remoto solo avisa y el tipo no valida JSON en ejecución. |
| F05 | Composables/useState/useCookie para estado. | Comparte sesión y preferencias sin introducir un store ajeno al diseño actual. |
| F06 | Cuatro temas con un modelo de navegación. | Cambiar apariencia no debe cambiar permisos o rutas. |
| F07 | Playwright y Cypress con build/API simulada. | Pruebas repetibles sin datos reales; integración externa requiere otra evidencia. |
| F08 | PWA sin transacciones offline. | Caché de recursos y navegación, nunca fuente de verdad de citas/pagos. Revisar rutas sensibles en caché. |
| F09 | Ingeniero con observabilidad de solo lectura. | Agregados y salud técnica, sin convertirlo en administrador. |
| F10 | CI y despliegue separados. | Servicios externos pueden construir incluso cambios Markdown. |

Las fuentes y los flujos están en [ARQUITECTURA](ARQUITECTURA.md),
[PRUEBAS](PRUEBAS.md), [INTERFAZ](INTERFAZ.md) y [ADR-002](ADR-002-OBSERVABILIDAD-INGENIERO.md).

## Límites conocidos que no se corrigen con documentación

- Callback OAuth con token en query string; limpiar la URL en cliente no elimina
  la exposición previa a infraestructura o registros.
- Cookie de token accesible a JavaScript: evaluar cualquier evolución de sesión como
  cambio coordinado backend/frontend, con pruebas.
- Caché de navegación del service worker sin una exclusión específica por ruta privada.
- CI Node 24 frente a Docker Node 22; npm ci frente a npm install.
- No hay un gate completo dedicado a tipos Vue.
- La auditoría UI histórica mantiene pendientes; esta edición no los marca resueltos.
- Configuración y permisos remotos requieren evidencia actual del proveedor.

## Documentación retirada o consolidada

Los roadmaps de migración y tareas completadas dejan de ser la guía de arquitectura.
El historial de Git conserva sus revisiones; no se reescribe.

| Fuente anterior | Sustitución |
| --- | --- |
| Roadmap urbanblade-completion-roadmap, copias .claude/.agents | Este registro, arquitectura y pruebas. |
| Plan de identidad IDENTITY_MASCOT_SIDEBAR_PLAN.md | INTERFAZ.md. |
| ENGINEER_OBSERVABILITY_DASHBOARD_PLAN.md | ADR-002-OBSERVABILIDAD-INGENIERO.md. |
| design-qa.md con resultado global ambiguo | Registro histórico con alcance y límites explícitos. |
| nuxt-migration-plan extenso | Guía breve de mantenimiento que apunta a arquitectura. |

Se conserva AUDITORIA_UI_UX.md como evidencia fechada con hallazgos abiertos;
no eliminarla solo porque contiene resultados desfavorables.
