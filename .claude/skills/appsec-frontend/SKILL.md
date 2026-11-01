---
name: appsec-frontend
description: Lista de revisión de seguridad para cambios del frontend Nuxt de UrbanBlade: manejo de la sesión Bearer, XSS, variables públicas, redirecciones y datos en el cliente. Úsalo al revisar un cambio de frontend_Urbanblade antes de pedir la fusión.
---
<!-- Generado desde urbanblade-equipo. No editar aquí: cambia el origen y vuelve a sincronizar. -->

# Revisión de seguridad del frontend (frontend_Urbanblade)

Complementa `frontend-security-hardening` y `urbanblade-profile-security`. Revisas el diff con `git diff origin/main...HEAD`; solo lectura.

## Lista de revisión
1. **Sesión.** El Bearer vive en una cookie legible por JavaScript: eso es un hecho del diseño actual, así que cualquier XSS lo expone. Revisa que no se escriba el token en logs, URL ni almacenamiento adicional.
2. **XSS.** Uso de `v-html`, `innerHTML` o render de contenido que viene de usuarios (comentarios, nombres, reseñas, mensajes del chat) sin sanear.
3. **Variables públicas.** `NUXT_PUBLIC_*` es público: sin claves secretas ni valores internos. Mocks y capturas sin datos reales.
4. **Autorización.** Los middleware de navegación mejoran la experiencia, no protegen: la comprobación real está en el servidor. Marca cualquier lugar donde el cliente decida precios, descuentos, saldo o disponibilidad.
5. **Redirecciones y enlaces.** Parámetros como `redirect` o `next` validados contra rutas internas; enlaces externos con `rel="noopener noreferrer"`.
6. **Formularios y archivos.** Validación del lado del cliente es comodidad, no seguridad; subida de archivos limitada por tipo y tamaño; mensajes de error sin detalles internos.
7. **Datos personales.** Qué se guarda en `localStorage`, cookies o analítica; que no se envíen datos personales a terceros sin que figure en el aviso de privacidad.
8. **Dependencias.** Cambios en `package.json` o `package-lock.json`: pasan por `cadena-suministro` cuando exista, y por `npm audit` mientras tanto.

## Cómo reportar
Por hallazgo: archivo y línea, qué podría hacer un atacante, cómo reproducirlo en pocas palabras y la corrección mínima. Severidad crítica o alta bloquea. Termina con lo que no revisaste.
