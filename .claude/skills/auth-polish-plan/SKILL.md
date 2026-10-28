---
name: auth-polish-plan
description: Mantener feedback de acceso, rate limit y callback social.
---

# Experiencia de acceso

Revisar usePasswordStrength, useRetryCountdown, useAuthReturn, useAuth y
app/pages/auth/callback.vue. El rate limit efectivo corresponde al backend.

El callback recibe un token en query string y limpia la URL en cliente.
Tratar la URL original como sensible; no pegarla en capturas, logs o documentación.
No afirmar que el proveedor está configurado o inactivo sin comprobar el entorno.

[Arquitectura](../../../docs/ARQUITECTURA.md) y
[pruebas](../../../docs/PRUEBAS.md) describen el diseño actual y sus límites.
No repetir la fase histórica de construcción. Mantener copias sincronizadas.
