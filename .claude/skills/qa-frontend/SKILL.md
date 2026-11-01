---
name: qa-frontend
description: Cómo probar el frontend Nuxt de UrbanBlade: tipos de prueba (UT, SIT, UAT, OAT), los comandos reales, qué cubre cada uno y sus límites. Úsalo antes de ejecutar o escribir pruebas en el repo frontend_Urbanblade.
---
<!-- Generado desde urbanblade-equipo. No editar aquí: cambia el origen y vuelve a sincronizar. -->

# QA del frontend (frontend_Urbanblade)

Fuente de verdad: `docs/PRUEBAS.md` del repo. Si algo de aquí contradice a ese archivo, gana el archivo.

## Tipos de prueba
| Tipo | Dónde | Herramienta | Qué verifica |
| --- | --- | --- | --- |
| UT | `tests/UT` | Vitest y Vue Test Utils | Funciones, stores y utilidades aisladas |
| SIT | `e2e/SIT` | Playwright | La app construida con la API simulada |
| UAT | `e2e/UAT` y `cypress/e2e/UAT` | Playwright y Cypress | Flujos por rol: autenticación, reservas… |
| OAT | `e2e/OAT` y `cypress/e2e/OAT` | Playwright y Cypress | Que el sitio se pueda operar: humo y salud |

## Comandos
```bash
npx --no-install eslint . --max-warnings=0   # reglas estáticas, cero avisos
npm run test:unit                              # Vitest (los UT)
npm run contract:check                         # contrato OpenAPI contra los tipos generados
npm run build                                  # bundle de producción
npm run test:e2e -- --workers=1                # Playwright sobre un build propio
python scripts/check_docs.py --all             # enlaces de la documentación
```
Cypress tiene `cypress:run` y `cypress:open`. El CI corre Cypress en dos contenedores y los E2E sobre el build de producción.

## Límites que debes decir en el reporte
- Los E2E usan una **API simulada**: no certifican Laravel ni cobros reales.
- `npm run build` no es una comprobación de tipos completa de Vue ni un despliegue.
- Los mocks de formularios no prueban la integración real.

## Qué probar con más cuidado
Roles y rutas protegidas, flujos de reserva y pago, estados de error de la API (401, 403, 422, 5xx), responsivo y los cuatro temas, y accesibilidad de formularios.
