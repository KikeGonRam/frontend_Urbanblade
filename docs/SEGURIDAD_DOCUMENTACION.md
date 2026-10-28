# Seguridad de la documentación

Revisión local: 28 de octubre de 2026. No incluye cambios de secretos,
cuentas, datos reales ni despliegues.

## Alcance y resultado inicial

Se analizaron los 318 archivos versionados presentes y el historial de Git
disponible en las referencias locales con Gitleaks 8.30.1.
El binario oficial se verificó con su checksum; se usaron reglas predeterminadas,
sin ampliar allowlists y con informes redactados. Ambos análisis dieron cero alertas.
Se repite la revisión sobre los documentos finales antes de entregar el cambio.

No se enviaron .env reales ni código a un servicio externo de escaneo.
Los archivos locales no versionados, como diagnósticos o configuración personal,
no se incorporan a esta revisión ni a los cambios documentales.

## Criterios para publicar

- Todo NUXT_PUBLIC_* es visible al cliente: solo configuración pública y clave
  publicable de Stripe. Secretos de Stripe, MongoDB, Firebase o proveedores van en backend.
- Una clave publicable o un identificador de analítica no equivale a un secreto.
- Usar TOKEN_DE_EJEMPLO y cuentas ficticias; no copiar sesiones reales en mocks.
- Revisar capturas, trazas, URLs de callback, headers Authorization y reportes de Cloud.
- No versionar .env, .vercel, dumps, llaves privadas ni exportaciones de usuarios.
- Comprobar el diff y los archivos candidatos; no agregar todo el workspace de forma indiscriminada.
- Si se confirma una filtración, comunicarla en privado según [SECURITY](../SECURITY.md).
  Eliminar el valor actual no lo elimina de Git: evaluar revocación/rotación.

## Riesgos técnicos documentados

[ARQUITECTURA](ARQUITECTURA.md) y [DECISIONES](DECISIONES.md) distinguen el estado
actual de las mejoras futuras: cookie de token legible por JavaScript,
token OAuth en query string y caché de navegación sin exclusión específica de
rutas privadas. La tarea documental no cambia esos comportamientos.

## Límites

Cero alertas no certifica ausencia absoluta de secretos ni seguridad del producto.
No hubo OCR de imágenes, pruebas de penetración, validación de credenciales ante
proveedores ni comprobación de permisos/configuración remota.
Los mocks y los resultados históricos de CI no sustituyen una revisión de producción.
