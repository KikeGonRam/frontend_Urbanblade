---
name: urbanblade-profile-security
description: "Fase 2 del roadmap UrbanBlade para perfiles y seguridad de cuenta en Nuxt. Usar antes de tocar páginas de perfil, avatar, preferencias, notificaciones o middleware de rol; coordinar siempre con barber."
---

# Fase 2: perfiles y seguridad de cuenta

## Alcance

Auditar y completar las pantallas Nuxt de perfil, avatar, preferencias y notificaciones usando el contrato de `../barber`.

## Reglas

- No confiar en IDs o roles enviados por el navegador.
- Mantener el token Bearer y limpiar cualquier token OAuth de la URL.
- No mostrar iconos de fallback cuando exista una foto válida; usar iniciales solo si la imagen falla.
- No exponer perfiles de otros usuarios en rutas propias.
- Cada cambio debe pasar `npm run lint`, `npm run build` y pruebas backend relacionadas.

## Criterios de aceptación

- Formularios muestran y guardan solo campos permitidos por el backend.
- Errores de validación se muestran por campo sin perder el mensaje general.
- Avatar nuevo, reemplazo y fallback funcionan.
- Middleware de rol y logout no dejan sesiones inconsistentes.
- Publicar commit Nuxt separado del commit Laravel.
