---
name: urbanblade-completion-roadmap
description: "Roadmap coordinado para completar frontend-urban junto con barber. Usar antes de tocar composables API/auth, páginas de perfil, citas, pagos, notificaciones, contratos JSON o pruebas E2E; cada fase se valida y publica junto con el backend correspondiente."
---

# UrbanBlade frontend completion roadmap

## Alcance

Este repositorio Nuxt consume el contrato Laravel de `../barber`. Las fases deben coordinarse con la skill homónima del backend y nunca asumir que una pantalla terminada implica que su API está completa.

## Fases coordinadas

1. Contrato API y autenticación: tipar respuestas, normalizar errores, revisar OAuth Google, perfil incompleto, avatar, tokens, CORS y configuración de Vercel.
2. Perfil y permisos: completar datos por rol, foto propia, preferencias y estados de sesión.
3. Citas: disponibilidad, calendario, conflictos, estados y feedback de errores.
4. Pagos, pedidos e inventario: estados, recibos, Stripe, stock y confirmaciones.
5. Notificaciones y operación: preferencias, push, estados de cola y observabilidad.
6. E2E y producción: flujos críticos en build productivo, variables de Vercel y regresiones visuales.

## Reglas frontend

- No hardcodear localhost en producción; `NUXT_PUBLIC_API_BASE` debe venir de Vercel.
- No guardar secretos en el bundle ni en `.env` versionado.
- Mantener Bearer token, limpieza inmediata del token OAuth en la URL y fallback de avatar sin iconos cuando exista una foto válida.
- Preferir cambios aditivos en el contrato y actualizar tipos TypeScript junto con los recursos Laravel.
- Cada fase debe pasar `npm run lint` y `npm run build`, además de las pruebas backend relacionadas.
- Publicar un commit frontend separado después del commit backend de la misma fase.
