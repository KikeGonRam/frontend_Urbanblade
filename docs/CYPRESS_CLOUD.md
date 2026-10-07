# Cypress y Cypress Cloud

Las pruebas E2E principales de `frontend-urban` siguen siendo las de **Playwright** (`e2e/`, 64
pruebas). Cypress se agregó para registrar corridas en **Cypress Cloud** durante su periodo de
prueba (organización «kike», proyecto `1dpyzb`) con recorridos reales, no con una prueba de relleno.

## Qué cubre

Mismas reglas que Playwright: se prueba el **build de producción** (`nuxt build` + `nuxt preview`)
contra la API simulada de `e2e/support/mock-api.mjs`; no hace falta Laravel, Mongo ni Redis.

| Archivo | Qué comprueba |
|---|---|
| `cypress/e2e/smoke.cy.ts` | La landing renderiza (título, Acceso y Reservar, sin `console.error`), las páginas legales cargan y el catálogo público muestra los servicios de la API. |
| `cypress/e2e/auth.cy.ts` | Una ruta protegida manda a `/login?redirect=/dashboard`; el login rechaza credenciales inválidas sin salir de la página; un cliente con perfil completo entra al dashboard; el login declara `plataforma: web` y `device_name: Nuxt Web`. |

Los datos simulados del navegador están en `cypress/support/api-mock.ts` y usan el tipo `ApiUser`
generado del OpenAPI: si el contrato cambia y el mock deja de caber, deja de compilar.

## Correrlas en local

Dos terminales, desde la raíz de `frontend-urban` (en PowerShell las variables van con `$env:`):

```powershell
# 1. Build con la API simulada y servidores (API simulada en :8099 y build en :3100)
$env:NUXT_PUBLIC_API_BASE = "http://127.0.0.1:8099/api/v1"; $env:NUXT_PUBLIC_STRIPE_KEY = "pk_test_e2e_fake"
npm run build
npm run e2e:servers

# 2. En otra terminal
npm run cypress:run      # o npm run cypress:open para la interfaz
```

Sin `CYPRESS_RECORD_KEY` en el entorno las pruebas corren y no se registran.

## En CI

`.github/workflows/cypress.yml` corre en cada PR y en cada push a `main`, con dos contenedores en
paralelo y permisos mínimos (`contents: read`). Si existe el secreto `CYPRESS_RECORD_KEY`, registra
las corridas en Cypress Cloud y reparte las pruebas entre los contenedores; si no existe (forks,
PR de Dependabot o antes de configurarlo) corre igual sin registrar. No es un check obligatorio de
`main`: los obligatorios siguen siendo los de `ci.yml`.

## Configurar el secreto (lo hace el dueño del repositorio)

1. En Cypress Cloud: proyecto → *Project settings* → *Record Keys*, copiar la llave.
2. En GitHub: repositorio → *Settings* → *Secrets and variables* → *Actions* → *New repository
   secret* con el nombre `CYPRESS_RECORD_KEY`.

La llave nunca se escribe en el repositorio, en este documento ni en un mensaje de commit.

## Qué tareas del trial cubre y cuáles no

Cubre registrar corridas desde CI, desde varias ramas (PR y `main`) y la paralelización. No cubre
invitar al equipo, el SSO ni las integraciones: esas se configuran en la web de Cypress Cloud.
El periodo de prueba vence alrededor del 5 de noviembre de 2026; después hay que quitar el secreto
(el workflow vuelve a correr sin registrar) o contratar el plan.
