---
name: stripe-and-ops-role-plan
description: Mantener pagos e ingeniero desde el código vigente, sin reejecutar planes cerrados.
---

# Pagos y observabilidad

La arquitectura de pagos y la autorización final pertenecen al backend.
Nuxt usa Stripe.js con clave publicable y solicita operaciones a la API;
nunca acepta el importe del navegador como fuente de verdad.

El backend actual utiliza Customers, Payment Intents y recursos de membresías.
Los planes antiguos que afirmaban ausencia de UI o Billing no son inventario vigente.
Inspeccionar las pantallas y servicios actuales antes de ampliar funciones o permisos.

Ingeniero sigue [ADR-002](../../../docs/ADR-002-OBSERVABILIDAD-INGENIERO.md).
Nunca conceder administrador para consultar estado.
Las cifras antiguas de trabajos fallidos no acreditan el estado de la cola actual.

No crear claves, procesar pagos reales ni reiniciar servicios por una tarea documental.
Consultar [PRUEBAS](../../../docs/PRUEBAS.md); Stripe se simula en E2E.
Mantener copias sincronizadas.
