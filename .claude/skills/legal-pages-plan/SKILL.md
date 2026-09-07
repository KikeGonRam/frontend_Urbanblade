---
name: legal-pages-plan
description: CERRADO (2026-09-06) — Aviso de Privacidad + Términos y Condiciones (LFPDPPP México), /privacidad y /terminos, enlazados desde el footer de la landing y el checkbox de consentimiento en el registro. Leer antes de tocar app/pages/privacidad.vue, app/pages/terminos.vue, app/layouts/legal.vue, o el checkbox de register.vue.
---

# Aviso de Privacidad + Términos y Condiciones — plan

## Contexto

La landing pública (`landing-page-plan`) ya tenía enlaces "Privacidad"/
"Términos" en el footer apuntando a `#` (placeholder). El dueño del
proyecto pidió páginas reales, alineadas con la legislación mexicana de
protección de datos (LFPDPPP) para reducir el riesgo legal real de operar
como negocio.

**Advertencia explícita, ya comunicada al usuario y repetida en las
páginas mismas**: este contenido está redactado para ser correcto en
estructura y cubrir lo que la LFPDPPP exige, pero **no sustituye una
revisión por un abogado real** antes de operar como negocio real. Las
páginas incluyen un aviso de "borrador" hasta que alguien confirme lo
contrario.

## Marco legal (LFPDPPP)

Ley Federal de Protección de Datos Personales en Posesión de los
Particulares (arts. 15-19 principalmente) exige que el Aviso de
Privacidad cubra: identidad y domicilio del responsable, datos
recabados, finalidades primarias y secundarias (con opción de
oposición a las secundarias), mecanismo para ejercer derechos ARCO
(Acceso, Rectificación, Cancelación, Oposición), transferencias a
terceros, uso de cookies/tecnologías de rastreo, y cómo se notifican
cambios al aviso.

## Datos reales que maneja `barber` (auditados antes de escribir el contenido)

Cuenta/contacto, historial de citas, pagos con tarjeta vía Stripe (los
datos de tarjeta nunca tocan la base de datos propia -- Stripe es el
procesador), puntos de lealtad, recibos de transferencia escaneados por
OCR, tokens de notificaciones push, preferencias de marketing por
email/WhatsApp. Hosting: Vercel (frontend) + MongoDB Atlas (backend) --
ambos con probable ubicación de servidores fuera de México, lo que
constituye una transferencia internacional de datos que debe
declararse.

## Decisión de alcance: solo frontend, sin cambios de API

El checkbox de consentimiento en `/register` es **solo de UX/frontend**
(bloquea el botón de submit hasta marcarlo) -- no se agrega ningún campo
nuevo a `AuthController::register()` en barber. Guardar el consentimiento
con timestamp en el backend sería más robusto legalmente, pero es un
cambio de API real (`routes/api.php`, guardrail #11 de
`urbanblade-guardrails`) que no se pidió explícitamente; se deja fuera de
alcance por ahora y se documenta aquí para si se pide después.

## Fases — todas ✅ DONE (2026-09-06)

1. ✅ `app/layouts/legal.vue` -- layout compartido (logo + volver al
   inicio, footer con el link cruzado a la otra página legal).
2. ✅ `app/pages/privacidad.vue` -- Aviso de Privacidad Integral: 10
   secciones (responsable, datos recabados, finalidades primarias/
   secundarias con opción de oposición, transferencias a Stripe/Vercel/
   Atlas, derechos ARCO y cómo ejercerlos, cookies, seguridad, menores,
   cambios al aviso, contacto). Placeholders entre corchetes para razón
   social/RFC (proyecto escolar, sin entidad legal constituida).
3. ✅ `app/pages/terminos.vue` -- Términos y Condiciones: 12 secciones
   (aceptación, descripción del servicio, cuentas, reservas/
   cancelación/inasistencia, métodos de pago -- reafirma que el monto
   real siempre se calcula server-side, nunca del cliente, mismo
   criterio que guardrail #13 de `urbanblade-guardrails` --, programa de
   lealtad, conducta, propiedad intelectual, límite de responsabilidad,
   modificaciones, ley aplicable/jurisdicción CDMX, contacto).
4. ✅ Footer de `index.vue` enlazado a `/privacidad`/`/terminos` (ya no
   `href="#"`). Checkbox de consentimiento agregado en `register.vue`
   (`acceptedTerms`, bloquea el botón de submit -- `:disabled="loading
   || secondsLeft > 0 || !acceptedTerms"` -- y también se valida al
   inicio de `onSubmit()` por si el DOM se manipula).
5. ✅ Verificación: lint y build limpios. Probado en un build de
   producción real (mismo criterio que `landing-page-plan`, tras el bug
   de reveal-on-scroll encontrado ahí): `/privacidad` y `/terminos`
   cargan bien, banner de borrador visible, mobile (375px) correcto. En
   `/register`, confirmado con JS que el botón está `disabled: true`
   hasta marcar el checkbox y `false` después.
6. ✅ Cierre: commit `0662267`, CI verde.

**Nota para el usuario, repetida en ambas páginas**: este contenido
cubre la estructura que exige la LFPDPPP y es un punto de partida sólido,
pero no sustituye la revisión de un abogado real antes de operar como
negocio real -- UrbanBlade sigue siendo un proyecto escolar sin razón
social constituida, así que la razón social y el RFC quedaron como
placeholders entre corchetes en `/privacidad`.
