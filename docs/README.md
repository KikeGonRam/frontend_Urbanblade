# Documentación del frontend

Este índice enlaza las fuentes de interfaz, pruebas y arquitectura.
Los planes y auditorías conservan su contexto y fecha; no son evidencia
automática del estado actual del producto.

| Necesidad | Fuente |
| --- | --- |
| Presentación e instalación | [README](../README.md) |
| Preparar un cambio | [CONTRIBUTING](../CONTRIBUTING.md) |
| Reportar vulnerabilidades | [SECURITY](../SECURITY.md) |
| Comprobaciones y límites de publicación | [CI/CD](CI_CD.md) |
| Ejecutar Cypress y configurar Cloud | [Cypress Cloud](CYPRESS_CLOUD.md) |
| Auditoría de interfaz y accesibilidad | [Auditoría UI/UX](AUDITORIA_UI_UX.md) |
| Notas de revisión visual | [Design QA](../design-qa.md) |
| Identidad, mascotas y sidebar | [Plan de identidad](IDENTITY_MASCOT_SIDEBAR_PLAN.md) |
| Panel del rol ingeniero | [Plan de observabilidad](ENGINEER_OBSERVABILITY_DASHBOARD_PLAN.md) |
| Contrato versionado | [OpenAPI](../contract/openapi.yaml) |
| Arquitectura de migración e historial | [Plan de migración Nuxt](../.claude/skills/nuxt-migration-plan/SKILL.md) |

El [backend](https://github.com/KikeGonRam/barber) es la fuente del contrato de
API y de las instrucciones de cuentas y permisos. El frontend conserva una
copia versionada del contrato para generar sus tipos.

Para documentar cambios, actualiza primero la fuente responsable; enlázala desde
este índice en vez de mantener copias completas de las mismas instrucciones.
