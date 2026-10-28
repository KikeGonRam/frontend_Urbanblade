---
name: engineer-dashboard-plan
description: Mantener observabilidad de ingeniero sin ampliar permisos.
---

# Panel del ingeniero

La decisión canónica es [ADR-002](../../../docs/ADR-002-OBSERVABILIDAD-INGENIERO.md).
Consultar app/components/dashboard/Ingeniero.vue, app/pages/system/index.vue y
useNavigation. El panel ya existe; no repetir la fase de construcción.

Ingeniero consulta agregados y salud; no obtiene CRUD de negocio.
No fabricar series, ocultar fallos como datos vacíos o exponer nombres y logs
sensibles. Mocks de dashboard-engineer.spec.ts no prueban permisos remotos.
Mantener copias sincronizadas.
