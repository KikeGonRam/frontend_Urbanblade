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

## Estado (2026-09-07)

El detalle completo de cada fase (hallazgos, commits, verificación) vive en
la skill homónima del backend: `../barber/.agents/skills/urbanblade-completion-roadmap/SKILL.md`.
Resumen desde el lado del frontend:

- **Fases 1–5**: auditadas y cerradas del lado del backend. En este repo solo
  la 1 y la 2 tuvieron trabajo propio (contrato API/auth, perfil y avatar).
- **Fase 6**: Playwright agregado (`e2e/`, `playwright.config.ts`), 9 pruebas
  contra el **build de producción** (`nuxt build` + `nuxt preview` en el
  puerto 3100), con la API de barber interceptada en el navegador. Job `e2e`
  propio en CI. Se corrigió el gate de perfil incompleto en `login()` y
  `register()`, que antes solo respetaba el callback de Google.

Pendientes conocidos de este repo (no son bugs; son pantallas que faltan):

- ~~El cliente no puede reservar una cita desde aquí.~~ **Cerrado**
  (`cecb460`): el modal de `pages/my/appointments/` ahora también crea citas
  y `pages/barbers/[slug].vue` tiene el CTA "Reservar con X" que lo abre con
  el barbero preseleccionado (`?barber=<id>`). Cubierto por
  `e2e/booking.spec.ts`.
- **El pago con tarjeta no tiene cobertura E2E.** Stripe Elements vive en un
  iframe de otro origen; probarlo de verdad necesita infraestructura de
  pruebas de Stripe, no mocks.
- **No se consume `AvailabilityController::slots()`.** Los formularios de
  citas usan `<input type="date">` / `<input type="time">` planos, sin
  selector de horarios disponibles (hallazgo de Fase 3). Si se construye,
  debe asumir que el slot puede ocuparse entre que se listó y que se envió
  el submit — el backend ya responde con un 422 claro (índice único).

## Reglas frontend

- No hardcodear localhost en producción; `NUXT_PUBLIC_API_BASE` debe venir de Vercel.
- No guardar secretos en el bundle ni en `.env` versionado.
- Mantener Bearer token, limpieza inmediata del token OAuth en la URL y fallback de avatar sin iconos cuando exista una foto válida.
- Preferir cambios aditivos en el contrato y actualizar tipos TypeScript junto con los recursos Laravel.
- Cada fase debe pasar `npm run lint` y `npm run build`, además de las pruebas backend relacionadas.
- Publicar un commit frontend separado después del commit backend de la misma fase.
