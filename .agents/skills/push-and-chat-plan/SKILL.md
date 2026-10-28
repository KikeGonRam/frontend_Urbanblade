---
name: push-and-chat-plan
description: Mantener notificaciones y asistente existentes con privacidad.
---

# Notificaciones y asistente

Revisar usePush, useChatbot, plugins/push.client.ts, public/sw.js y los componentes
del shell antes de editar. El backend controla entrega, contexto y permisos.

No publicar VAPID_PRIVATE_KEY, tokens, conversaciones ni datos personales.
La suscripción Push requiere permisos del navegador; no solicitarlos en un flujo
que no los necesita. El modo offline no confirma entrega ni reserva.
No afirmar que un proveedor IA está operativo a partir del widget renderizado.

Consultar [ARQUITECTURA](../../../docs/ARQUITECTURA.md) y
[PRUEBAS](../../../docs/PRUEBAS.md). Cambios de contrato requieren coordinación,
no una regeneración ciega ni un despliegue automático. Mantener copias sincronizadas.
