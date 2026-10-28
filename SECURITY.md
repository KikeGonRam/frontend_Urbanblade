# Política de seguridad

## Alcance y mantenimiento

Este frontend forma parte de UrbanBlade, en uso en producción, y consume la API
del repositorio [barber](https://github.com/KikeGonRam/barber).
Las correcciones se integran mediante PR hacia `main`; no se promete aquí
soporte por versión ni un plazo de respuesta.

## Reportar una vulnerabilidad

El reporte privado de vulnerabilidades del repositorio frontend no está
habilitado en la revisión del 27 de octubre de 2026. Para un hallazgo de
UrbanBlade, utiliza el
[canal privado habilitado en barber](https://github.com/KikeGonRam/barber/security/advisories/new)
e indica que afecta al frontend.

Incluye componente, impacto y pasos mínimos con datos ficticios.
No publiques exploits, tokens, contraseñas, datos personales ni comprobantes
en issues, PR o capturas públicas.

El reporte no autoriza pruebas contra producción, cuentas ajenas, pagos reales
ni cambios de datos. Coordina la reproducción con el propietario.

## Variables y datos

Todo valor `NUXT_PUBLIC_*` es visible en el cliente.
Solo se utiliza la clave publicable de Stripe en el frontend; las claves
secretas pertenecen al backend. No subas `.env`, sesiones, cookies, exportaciones
de datos ni logs privados.

Las pruebas con API simulada, auditorías de dependencias y controles del CI son
complementarios; no sustituyen una revisión de integración o autorización.
