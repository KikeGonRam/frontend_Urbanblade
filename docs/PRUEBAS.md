# Pruebas del frontend

Fuentes: [package.json](../package.json), [Vitest](../vitest.config.ts),
[Playwright](../playwright.config.ts) y [workflows](../.github/workflows).
Node 24 y npm ci --legacy-peer-deps reproducen la instalación de CI.
No usar cuentas, tokens ni endpoints reales para las pruebas simuladas.

## Tipos de prueba

Las pruebas de comportamiento se clasifican en cuatro tipos, igual que en el
backend ([PRUEBAS del backend](https://github.com/KikeGonRam/barber/blob/main/docs/referencia/PRUEBAS.md)).
Cada tipo tiene su carpeta y su comando.

| Tipo | Dónde | Herramienta | Qué verifica | Comando |
| --- | --- | --- | --- | --- |
| **UT / UIT** · Unitarias y de integración de unidades | [tests/UT](../tests/UT) | Vitest + Vue Test Utils | Funciones, stores y utilidades aisladas (carrito, reglas de negocio, protección de abuso) y páginas o formularios montados con sus colaboradores (login, recuperación, horario de barbero) con dependencias externas simuladas. | `npm run test:ut` |
| **SIT** · Integración de sistema | [e2e/SIT](../e2e/SIT) | Playwright | La aplicación construida funcionando con la API simulada: cookies, apertura de enlaces, mapa del sistema, diseño, accesibilidad y kit de interfaz. | `npm run test:sit` |
| **UAT** · Aceptación de usuario | [e2e/UAT](../e2e/UAT) y [cypress/e2e/UAT](../cypress/e2e/UAT) | Playwright y Cypress | Flujos por rol: autenticación, reservas, estados de citas, pagos, cierre de caja, paneles de cada rol, notificaciones. | `npm run test:uat` |
| **OAT** · Aceptación operativa | [e2e/OAT](../e2e/OAT) y [cypress/e2e/OAT](../cypress/e2e/OAT) | Playwright y Cypress | Que el sitio se pueda operar: humo y salud, PWA instalable y sin conexión, cabeceras de seguridad HTTP. | `npm run test:oat` |

`npm run test:unit` sigue ejecutando todo Vitest (los UT) y `npm run test:e2e`
todo Playwright (SIT + UAT + OAT). Para clasificar un archivo nuevo: si no monta la
aplicación, es UT; si recorre la aplicación construida, es OAT cuando verifica
salud, instalación o cabeceras, UAT cuando verifica un flujo concreto de un rol
y SIT cuando verifica una propiedad transversal de la aplicación. Los soportes
compartidos viven en [e2e/support](../e2e/support).

## Niveles y comandos

| Comando | Cobertura | Límite |
| --- | --- | --- |
| `npx --no-install eslint . --max-warnings=0` | Reglas estáticas con cero avisos. | No prueba comportamiento. |
| `npm run test:unit` | Vitest, Vue Test Utils y entorno Nuxt/happy-dom. | Dependencias de formularios simuladas. |
| `npm run contract:check` | Correspondencia OpenAPI local/tipos generados. | No verifica todos los datos en runtime. |
| `npm run build` | Bundle de producción Nuxt/Nitro. | No es un typecheck Vue completo ni un deploy. |
| `npm run test:e2e -- --workers=1` | Playwright Chromium sobre build propio. | API simulada; no certifica Laravel ni cobros reales. |
| `npm run cypress:run` | Flujos Cypress. | Requiere servidores y build preparados. |
| `npm run audit:gate` | Advisory high/critical y excepciones con vencimiento. | No sustituye revisión de secretos ni de lógica. |
| `python scripts/check_docs.py --all` | Enlaces locales y conflictos de Markdown mantenido. | No comprueba fuentes remotas, anclas ni toda la semántica. |

No hay script dedicado de typecheck completo en package.json. No presentar
build, lint o contract:check como si lo sustituyeran.

## Suite unitaria

[tests](../tests) contiene pruebas de login, recuperación, horario de barbero,
carrito, utilidades de negocio y protección de abuso. La configuración usa
`tests/**/*.test.ts`, entorno Nuxt y happy-dom.
Los conteos cambian; consultar el resumen de la ejecución correspondiente.

## Playwright

El archivo de configuración levanta una API simulada SSR en 8099 y construye
Nuxt para preview en 3100. Usa 127.0.0.1 y reuseExistingServer=false:
un servidor de desarrollo anterior no se acepta como evidencia del build actual.
Instalar Chromium si falta mediante `npx playwright install chromium`.

[e2e](../e2e) incluye autenticación, reservas, estados de citas, pagos simulados,
paneles por rol, seguridad HTTP, cookies, PWA, notificaciones, UI y observabilidad.
El mock del navegador no intercepta las peticiones SSR; por eso también existe
[e2e/support/mock-api.mjs](../e2e/support/mock-api.mjs).

El estado inicial rechaza analítica; cookies.spec.ts prueba elecciones desde un
contexto limpio. Las trazas/capturas pueden contener datos de la sesión:
revisarlas antes de compartirlas y no usar una cuenta real.

## Cypress

Sigue [CYPRESS_CLOUD.md](CYPRESS_CLOUD.md) para construir contra la API simulada
y arrancar `npm run e2e:servers`. Ejecutar Cypress por sí solo no los arranca.
La clave de registro va en secretos del proveedor, nunca en Markdown.
Cloud puede recibir artefactos; no grabar sesiones reales con información sensible.

## Validación de interfaz e integración

La [auditoría del 2 de octubre](AUDITORIA_UI_UX.md) conserva hallazgos y límites
de aquella revisión. No se ha repetido aquí ni se declaran resueltos sus pendientes.
Para una nueva revisión: cuatro temas, móvil/escritorio, teclado, movimiento reducido,
estados vacíos, error y datos densos, con una sesión del rol afectado.

La integración real necesita un entorno aislado y autorización de las escrituras
que produzca. Los mocks no prueban webhooks, OAuth remoto, correo ni pagos reales.
Los tests de backend se ejecutan desde barber exclusivamente con .\test.ps1.

## Análisis estático

El workflow [semgrep.yml](../.github/workflows/semgrep.yml) ejecuta Semgrep con las reglas
`p/owasp-top-ten` en cada PR y en `main`, y bloquea con cualquier hallazgo de severidad `ERROR`.
El 29 de octubre de 2026 el escaneo local dio 0 hallazgos en 261 archivos, sin excepciones.

Para correrlo en local (PowerShell, desde la raíz del repositorio):

```powershell
docker run --rm -v "${PWD}:/src" -w /src semgrep/semgrep:1.182.1 semgrep scan --config p/owasp-top-ten --severity ERROR --error --metrics=off --exclude node_modules --exclude .nuxt --exclude .output --exclude dist --exclude coverage --exclude .claude --exclude .agents --exclude docs
```

Un falso positivo o un riesgo aceptado se suprime en la propia línea con `// nosemgrep: <regla>` y una
justificación en el comentario anterior; se registra aquí con su regla, archivo y motivo. No se suprime
una regla completa ni se excluyen carpetas de código para que pase el CI. Hoy no hay supresiones.

## Evidencia y mantenimiento

Registrar SHA, entorno, comando, resultado y omisiones. Los resultados del PR #67
son históricos y no se presentan como nuevas ejecuciones de esta revisión.
No fijar un conteo permanente de pruebas en el README ni ocultar checks fallidos.
