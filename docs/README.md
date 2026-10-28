# Documentación del frontend

Revisión documental: 28 de octubre de 2026.
El código describe la implementación; las guías explican responsabilidades,
decisiones y comprobaciones. La evidencia histórica conserva su fecha y alcance.

| Necesidad | Fuente canónica |
| --- | --- |
| Presentación e instalación local | [README](../README.md) |
| Arquitectura, SSR, sesión, datos y PWA | [ARQUITECTURA](ARQUITECTURA.md) |
| Decisiones y pendientes técnicos | [DECISIONES](DECISIONES.md) |
| Pruebas, dependencias y límites | [PRUEBAS](PRUEBAS.md) |
| Workflows y publicación | [CI/CD](CI_CD.md) |
| Publicar la imagen, verificar y revertir en AWS | [Despliegue](DESPLIEGUE.md) |
| Interfaz, temas y mascotas | [INTERFAZ](INTERFAZ.md) |
| Observabilidad del ingeniero | [ADR-002](ADR-002-OBSERVABILIDAD-INGENIERO.md) |
| Cypress y registro opcional en Cloud | [Cypress Cloud](CYPRESS_CLOUD.md) |
| Revisión de secretos y límites | [Seguridad documental](SEGURIDAD_DOCUMENTACION.md) |
| Preparar cambios | [CONTRIBUTING](../CONTRIBUTING.md) |
| Reportar vulnerabilidades | [SECURITY](../SECURITY.md) |
| Contrato versionado de API | [OpenAPI](../contract/openapi.yaml) |
| Auditoría fechada con hallazgos | [Auditoría UI/UX](AUDITORIA_UI_UX.md) |
| Contexto histórico del sidebar | [Design QA](../design-qa.md) |

Las guías .claude/.agents apoyan el mantenimiento; no sustituyen este índice ni
conceden autorizaciones para publicar o desplegar. Los planes cerrados se consolidan
en guías breves y las revisiones anteriores siguen en Git.

El [backend](https://github.com/KikeGonRam/barber) es dueño del contrato real,
la persistencia y la autorización. No copiar credenciales o inventarios privados
en la documentación del frontend.

## Políticas del proyecto

[Seguridad](../SECURITY.md) · [Código de conducta](../CODE_OF_CONDUCT.md) ·
[Contribución](../CONTRIBUTING.md) · [Licencia GPL-3.0-only](../LICENSE) ·
[Alcance de la licencia](../LICENSING.md).
