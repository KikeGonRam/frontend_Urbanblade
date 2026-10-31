# Mantenimiento de frontend-urban

Lee docs/README.md, docs/ARQUITECTURA.md, docs/PRUEBAS.md y docs/DECISIONES.md.
Inspecciona rama y estado antes de editar; preserva cambios preexistentes.

- Nuxt consume la API de barber: no introducir acceso directo a MongoDB.
- Los middleware de navegación no reemplazan autorización en el backend.
- La sesión usa Bearer propio con cookie legible por JavaScript; no documentar
  Sanctum o BFF/HttpOnly como si estuvieran implementados.
- NUXT_PUBLIC_* es público. Nunca guardar secretos en documentación, mocks o capturas.
- Reutilizar componentes y tokens de los cuatro temas; comprobar roles y responsive.
- Para Markdown: python scripts/check_docs.py --all y git diff --check.
- Para comportamiento: escoger gates de docs/PRUEBAS.md; mocks no prueban integración real.
- No regenerar contratos, actualizar dependencias o construir imágenes por editar guías.
- Backend se prueba exclusivamente con barber/test.ps1, sin datos reales ni Atlas.
- Usar ramas y staging selectivo. Publicar cuando lo ordene el propietario para ese cambio.
- No force push, reescrituras de historial ni eliminación de ramas publicadas.
- CI verde no equivale a deploy. El despliegue a staging lo hace el workflow «Desplegar a staging»:
  arranca tras el CI de main y espera la aprobación del propietario; un cambio solo de Markdown,
  `.github/` o pruebas no lo pide. Respetar la instrucción vigente de no desplegar. Vercel se
  desconectó el 31-oct-2026 y ya no construye nada.
- Mantener coherentes las copias .claude/.agents. Los planes antiguos no conceden
  autorizaciones operativas ni acreditan el estado actual de producción.
