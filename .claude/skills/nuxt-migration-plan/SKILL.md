---
name: nuxt-migration-plan
description: Arquitectura y mantenimiento de Nuxt; la migración histórica ya está cerrada.
---

# Mantenimiento de Nuxt

La arquitectura vigente está en [ARQUITECTURA](../../../docs/ARQUITECTURA.md);
decisiones en [DECISIONES](../../../docs/DECISIONES.md). Las fases históricas
cerradas se conservan en Git, no se vuelven a ejecutar.

- API HTTP de barber; nunca acceso directo a MongoDB.
- SSR por defecto y CSR según routeRules. Revisar HTML inicial para SEO.
- Auth Bearer propia; cookie legible por JavaScript, no Sanctum ni BFF.
- Composables/useState/useCookie; componentes reutilizables y cuatro temas.
- Tipos generados del contrato; no confundir tipos con validación de JSON.
- Revisar [PRUEBAS](../../../docs/PRUEBAS.md) antes de validar.
- No desplegar o publicar por una autorización histórica.
- Mantener ambas copias .claude/.agents sincronizadas.
