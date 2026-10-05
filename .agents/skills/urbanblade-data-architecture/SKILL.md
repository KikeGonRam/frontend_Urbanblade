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
- Git por rama y PR a `main` con el CI en verde, sin borrar la rama; la IA solo hace
  commit, push y PR con la orden del usuario, y fusión y despliegue automáticos si todo sale bien
  (ver `git-commit-conventions`).
