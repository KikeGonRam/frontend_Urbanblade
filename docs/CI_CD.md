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

Los workflows revisados construyen y prueban, pero no contienen docker push,
actualizaciones de ECS ni un job de despliegue. Eso no controla integraciones
configuradas fuera del repositorio.

Vercel puede crear builds también por cambios Markdown. En el merge anterior
del PR #67 se pausaron temporalmente los builds con autorización del propietario,
se verificó la cancelación por Ignored Build Step y se restauró Automatic.
Es un antecedente, no una autorización para repetir la operación.
Antes de publicar otra rama, verificar las conexiones vigentes y respetar el
alcance de no desplegar cuando lo indique el usuario.

No incluir secretos en variables públicas NUXT_PUBLIC_*, logs, ejemplos, reportes
de Cypress o trazas. Consultar [seguridad documental](SEGURIDAD_DOCUMENTACION.md).

## Evidencia histórica

[PR #67](https://github.com/KikeGonRam/frontend_Urbanblade/pull/67), merge
22e2fe7, terminó con checks de main verdes el 28 de octubre de 2026.
La ejecución local previa reportó 56 pruebas unitarias, ESLint y contrato aprobados.
No se presentan esos resultados como ejecuciones nuevas de esta revisión.

Para cada cambio registrar SHA, comando, resultado, omisiones y entorno.
Validación local, CI, fusión y despliegue son evidencias distintas.
