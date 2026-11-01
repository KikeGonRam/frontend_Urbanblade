# CI/CD del frontend

Fuentes: [.github/workflows](../.github/workflows), [package.json](../package.json)
y [Dockerfile](../Dockerfile). Revisión: 28 de octubre de 2026.

## Comprobaciones

| Workflow | Comprobaciones |
| --- | --- |
| [CI](../.github/workflows/ci.yml) | ESLint estricto, build, audit gate, Vitest, contrato, Playwright e imagen Docker con salud y usuario sin privilegios. |
| [Cypress](../.github/workflows/cypress.yml) | Build y flujos con API simulada; registro/paralelización en Cloud cuando existe su secreto. |
| [Documentación](../.github/workflows/documentation.yml) | Markdown mantenido: enlaces locales, archivos vacíos y conflictos. |

Se ejecutan en PR y push a main con contents:read. Los timeouts limitan trabajos
atascados; la concurrencia cancela corridas anteriores del mismo PR.
Las reglas remotas de protección determinan qué checks son requeridos;
consultarlas antes de fusionar, sin inferirlas de los nombres de jobs.

CI instala Node 24 y npm ci --legacy-peer-deps. Docker usa Node 22 y npm install.
Esa diferencia queda registrada para un cambio técnico independiente.

## Qué demuestra cada gate

[PRUEBAS](PRUEBAS.md) contiene los comandos y prerrequisitos. Playwright y Cypress
usan el build con API simulada, no una cuenta de producción.
contract:check comprueba copia local y tipos; contract:drift es informativo.
El build no es un typecheck completo Vue.

El validador documental puede ejecutarse con:

```powershell
python scripts/check_docs.py --all
git diff --check
```

Revisa Markdown en raíz, docs y .github. Omite bloques de código, anclas, enlaces
externos y links de referencia; no valida toda la semántica de una guía.
Las guías .claude/.agents se revisan por separado y sus copias deben ser coherentes.

## Publicación

CI y Cypress construyen y prueban, pero no publican. La publicación a staging la hace el
workflow [Desplegar a staging](../.github/workflows/desplegar-staging.yml): arranca solo cuando el
CI de `main` termina en verde tras un push (o a mano desde Actions), solo desde `main`, y **siempre
espera la aprobación del propietario** en el entorno `staging` de GitHub. Un job previo compara el
commit con el anterior: si solo cambian Markdown, `.github/`, `tests/`, `cypress/` o archivos de
agentes, no hay despliegue ni aprobación. AWS se asume por OIDC con un rol de privilegio mínimo, deja
la etiqueta `rollback-<fecha>-pre-<sha>`, sube la imagen con `sha-<corto>` y `latest`, verifica el
digest de las tareas y `/` y `/api/health`, hace pruebas de humo de solo lectura (`/`, `/servicios` y `/equipo` con el primer servicio real de la API, y un 404 real en una ruta inexistente) y revierte sola si falla. El procedimiento completo está
en [CI_CD.md del backend](https://github.com/KikeGonRam/barber/blob/main/docs/referencia/CI_CD.md).

La lógica de despliegue es una plantilla compartida con el backend: el repositorio [KikeGonRam/urbanblade-ci](https://github.com/KikeGonRam/urbanblade-ci) (`desplegar-ecs.yml`). `desplegar-staging.yml` solo declara los disparadores, los permisos y los parámetros del frontend, y la fija por SHA de commit: un cambio en la plantilla no llega aquí sin un PR. Las pruebas de humo propias están en `.github/scripts/humo.sh`.

Vercel dejó de estar conectado al repositorio el 31-oct-2026. Antes creaba un despliegue «Preview»
por cada push de PR y uno «Production» por cada fusión, aunque el sitio real no se sirve desde ahí
(corre en AWS con el dominio propio); por eso se retiraron los entornos `Preview` y `Production` de
GitHub. El proyecto de Vercel conserva una copia congelada en `frontend-urbanblade.vercel.app` que ya
no se actualiza. Los antecedentes de cuando Vercel construía cambios de Markdown (PR #67) siguen más
abajo como historia, no como procedimiento vigente. Respetar el alcance de no desplegar cuando lo
indique el usuario.

No incluir secretos en variables públicas NUXT_PUBLIC_*, logs, ejemplos, reportes
de Cypress o trazas. Consultar [seguridad documental](SEGURIDAD_DOCUMENTACION.md).

## Evidencia histórica

[PR #67](https://github.com/KikeGonRam/frontend_Urbanblade/pull/67), merge
22e2fe7, terminó con checks de main verdes el 28 de octubre de 2026.
La ejecución local previa reportó 56 pruebas unitarias, ESLint y contrato aprobados.
No se presentan esos resultados como ejecuciones nuevas de esta revisión.

Para cada cambio registrar SHA, comando, resultado, omisiones y entorno.
Validación local, CI, fusión y despliegue son evidencias distintas.
