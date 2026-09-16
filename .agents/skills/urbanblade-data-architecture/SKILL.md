---
name: urbanblade-data-architecture
description: Aplica límites de datos al integrar frontend-urban con barber o al proponer bases, almacenamiento, Docker o analítica de UrbanBlade.
---

# Arquitectura de datos de UrbanBlade

La decisión canónica está en
`../barber/docs/ADR-001-ARQUITECTURA-DE-DATOS.md` y continúa **Propuesta** hasta que el
usuario apruebe una fase.

- Este frontend consume exclusivamente la API de `barber`; no se conecta a MongoDB,
  SQLite ni Redis y no almacena credenciales de base.
- No dupliques la fuente de verdad operativa en el cliente. Estado local, caché web e
  IndexedDB, si se autorizan, son derivados revocables y no sustituyen al servidor.
- Los cambios de contrato se coordinan con `barber` de forma aditiva y se validan de
  extremo a extremo.
- La analítica derivada pertenece a `urbanblade_analytics`; el frontend la recibe ya
  autorizada y agregada desde la API, nunca desde Spark o la base directamente.
- Ninguna IA ejecuta `git commit`, `git push`, merge, rebase ni publica PR. Entrega al
  usuario el resumen, validaciones y mensaje de commit sugerido en español.
