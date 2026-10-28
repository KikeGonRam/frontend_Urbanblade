# Pruebas del frontend

Fuentes: [package.json](../package.json), [Vitest](../vitest.config.ts),
[Playwright](../playwright.config.ts) y [workflows](../.github/workflows).
Node 24 y npm ci --legacy-peer-deps reproducen la instalación de CI.
No usar cuentas, tokens ni endpoints reales para las pruebas simuladas.

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

## Evidencia y mantenimiento

Registrar SHA, entorno, comando, resultado y omisiones. Los resultados del PR #67
son históricos y no se presentan como nuevas ejecuciones de esta revisión.
No fijar un conteo permanente de pruebas en el README ni ocultar checks fallidos.
