---
name: dev-frontend-nuxt
description: Contexto y reglas para modificar el frontend Nuxt 4 de UrbanBlade (repositorio frontend_Urbanblade): estructura, comandos de comprobación, contrato con la API y flujo de rama. Úsalo antes de cambiar páginas, componentes, composables o stores.
---
<!-- Generado desde urbanblade-equipo. No editar aquí: cambia el origen y vuelve a sincronizar. -->

# Frontend (frontend_Urbanblade)

Repositorio `KikeGonRam/frontend_Urbanblade`: sitio Nuxt 4 que consume la API de barber. Lee `AGENTS.md`, `docs/README.md`, `docs/ARQUITECTURA.md`, `docs/PRUEBAS.md` y `docs/DECISIONES.md` antes de actuar. Complementan este skill: `urbanblade-ui-kit`, `ui-ux-visual-polish`, `frontend-form-ux-standards`, `frontend-security-hardening`, `frontend-performance-latency` y `api-contract-plan`.

## Estructura útil
`app/pages`, `app/components`, `app/composables`, `app/middleware`, `app/layouts`, `app/lib`, `app/utils`, `server` (rutas de Nitro como `/api/health`), `contract` (OpenAPI y tipos generados), `tests/UT`, `e2e/SIT|UAT|OAT` (Playwright), `cypress/e2e`.

## Reglas que no se rompen
- Nuxt consume la API de barber: sin acceso directo a MongoDB.
- La sesión usa un Bearer propio con una cookie legible por JavaScript. No lo documentes ni lo implementes como Sanctum ni como cookie HttpOnly de un BFF: no lo es.
- Los middleware de navegación no sustituyen la autorización del servidor.
- `NUXT_PUBLIC_*` es público: nunca guardes secretos, ni en el código, ni en mocks, ni en capturas.
- Reutiliza los componentes y tokens de los cuatro temas; comprueba roles y diseño responsivo.

## Comprobaciones antes de pedir fusión
```bash
npx --no-install eslint . --max-warnings=0
npm run test:unit
npm run contract:check
npm run build
npm run test:e2e -- --workers=1
python scripts/check_docs.py --all
git diff --check
```
Los mocks no prueban integración real. No regeneres contratos, no actualices dependencias ni construyas imágenes como parte de editar guías.

## Contrato con la API
Si el cambio necesita datos que la API no entrega, se pide a `dev-backend` y se espera el contrato; no se simulan en el cliente. `contract:check` detecta la deriva entre el contrato local y los tipos generados.

## Git y entrega
- Rama nueva desde `origin/main`, cambios selectivos. Commits y PR en español.
- No hagas commit, push ni PR sin la orden del propietario. «CI en verde» no equivale a desplegar; el despliegue lo hace el workflow con la aprobación del propietario.
