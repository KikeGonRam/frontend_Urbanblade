# CI/CD del frontend

## Comprobaciones existentes

| Workflow | Comprobaciones |
| --- | --- |
| [CI](../.github/workflows/ci.yml) | ESLint estricto, build Nuxt, auditoría, Vitest, contrato, Playwright e imagen Docker con arranque y usuario sin privilegios. |
| [Cypress](../.github/workflows/cypress.yml) | Flujos de interfaz con build y API simulada; registro/paralelización en Cloud cuando existe su secreto. |
| [Documentación](../.github/workflows/documentation.yml) | Enlaces locales de los documentos de entrada. |

CI instala Node.js 24 y utiliza `npm ci --legacy-peer-deps`.
El Dockerfile existente utiliza Node.js 22; esa diferencia se documenta y
cualquier alineación queda para un cambio de imágenes con validación propia.

Playwright construye y levanta los puertos 3100 y 8099 con la API simulada.
Cypress requiere un build y `npm run e2e:servers` activos; consulta
[CYPRESS_CLOUD.md](CYPRESS_CLOUD.md).
Estas suites no prueban la API real ni autentican un usuario de producción.

El build no equivale a una comprobación completa de tipos Vue.
El job de contrato valida los tipos generados y la comprobación de drift remoto
es informativa; no se presenta aquí como un typecheck completo.

## Límites del mantenimiento

Esta actualización se limita a Markdown, plantillas, validación documental y
configuración de CI. No cambia lógica de negocio, dependencias del producto,
Dockerfiles, variables de entorno, contrato de API ni infraestructura.

Los workflows versionados revisados se disparan con `push` a `main` o
`pull_request` hacia `main`. Construir una imagen en un runner no la publica.
No contienen `docker push`, actualización de ECS ni un trabajo de despliegue.
Los cambios documentales también ejecutan la CI existente: no se añaden filtros
que puedan dejar checks requeridos pendientes o saltarse controles de seguridad.

Esto no confirma la configuración de integraciones externas como Vercel,
webhooks o pipelines configurados fuera del repositorio. Antes de fusionar,
revisa esas conexiones. Durante este mantenimiento no se despliega, publica
ni ejecutan comandos de infraestructura.

## Comprobación documental

`python scripts/check_docs.py` comprueba README, contribución, seguridad,
índice documental, esta guía, la plantilla de PR y la guía de Cypress.
Detecta archivos vacíos, conflictos de merge y destinos locales inexistentes
en enlaces Markdown en línea e imágenes/enlaces HTML.
Omite bloques de código, URLs externas y anclas; no comprueba sintaxis Markdown
completa, enlaces de referencia ni vigencia semántica de todas las guías.

Para revisar otros documentos explícitamente:

```powershell
python scripts/check_docs.py docs/README.md docs/CI_CD.md
```

El workflow `documentation.yml` usa Python del runner y no instala dependencias.
Se ejecuta con PR/push a `main` para no omitir un check si se configura como requerido.
Los workflows del producto mantienen sus nombres de jobs. Los límites de tiempo
evitan ejecuciones atascadas; la concurrencia cancela corridas anteriores del
mismo PR, conservando las corridas de `main`.

## Evidencia y publicación

En cada PR registra comandos y resultados del checkout probado. Distingue:
validación local, checks de GitHub, fusión y publicación.
Ninguno implica automáticamente el siguiente.

El badge del README enlaza al workflow del repositorio; no representa un
certificado del commit de una rama local.

No se modifica la licencia ni se renombran repositorios durante este mantenimiento.

## Presentación en GitHub

Descripción de About:

> Frontend de UrbanBlade para barberías: reservas, agenda, pagos y paneles por rol con Nuxt, Vue y TypeScript.

Temas configurados: `nuxt`, `vue`, `typescript`, `tailwindcss`, `pwa`,
`barbershop`. El enlace del sitio ya está configurado:
https://urbanblade.com.mx/.

La revisión inicial encontró la descripción y los temas vacíos. El propietario
autorizó actualizarlos; los valores anteriores ya se aplicaron y verificaron
mediante la API de GitHub.

## Verificación local del mantenimiento · 27 de octubre de 2026

- Base revisada: `origin/main` en `c9a7570`.
- `npm run test:unit`: 56 pruebas aprobadas en seis archivos.
- `npx --no-install eslint . --max-warnings=0`: aprobado.
- `npm run contract:check`: tipos al día con el contrato local.
- Validador documental: siete documentos de entrada aprobados y 15 casos
  positivos/negativos del validador comprobados en archivos temporales.
- Enlaces locales: seis Markdown públicos versionados revisados sin destinos faltantes.
- YAML: workflows y formularios de issues parseados sin errores.
  Se compararon los jobs anteriores: solo cambian sus límites de tiempo.
- `git diff --check`: sin errores.

Esta evidencia es local. No se ejecutaron Playwright, Cypress ni un nuevo build
durante el mantenimiento; los workflows modificados requieren validación en el PR.
No se ejecutaron despliegues.
