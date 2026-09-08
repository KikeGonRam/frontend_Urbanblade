---
name: frontend-performance-latency
description: 'Directrices, patrones arquitectónicos y checklist de optimización para rendimiento, velocidad de carga y minimización de latencia en Nuxt 4 (UrbanBlade). Consultar antes de modificar useApi/useApiFetch, empaquetado de Vite/Nitro, code-splitting, lazy loading de componentes pesados (FullCalendar, Chart.js), debounce de búsquedas o reglas de caché SWR.'
---

# Rendimiento y Optimización de Latencia en Nuxt 4 (UrbanBlade)

## Objetivo

Garantizar que el frontend Nuxt 4 de UrbanBlade ofrezca una experiencia ultra-rápida, con tiempos de respuesta casi instantáneos (TTI < 1.2s, First Contentful Paint < 0.8s) y Core Web Vitals en verde, minimizando tanto la latencia de red contra el backend Laravel como el costo computacional de renderizado en el cliente.

---

## 1. Principios Innegociables

1. **Preservar el modelo de SSR híbrido:**
   - Páginas públicas (`/`, `/privacidad`, `/terminos`) usan prerender / SSG / SSR para SEO óptimo y First Contentful Paint inmediato.
   - Rutas autenticadas (`/dashboard/**`, `/appointments/**`, `/clients/**`, `/payments/**`, etc.) deben configurarse con `{ ssr: false }` en `routeRules` de `nuxt.config.ts`. Como el Bearer token vive en el cliente, el SSR en rutas autenticadas genera peticiones fallidas o redundantes en el servidor Node/Nitro.
2. **Direccionamiento de red:**
   - La base de la API local debe ser siempre `127.0.0.1:8000`, **nunca** `localhost:8000`. Los navegadores modernos intentan resolver IPv6 (`::1`) primero para "localhost", agregando de 2 a 3 segundos de latencia de timeout antes de reintentar con IPv4.
3. **Cero búsquedas o filtros sin debounce:**
   - Cualquier input de texto que dispare llamadas a la API (búsqueda de clientes, citas, logs, catálogo) debe implementar un debounce mínimo de `300ms` a `400ms` para evitar spam de peticiones innecesarias.
4. **Carga perezosa (Lazy Loading) para componentes pesados:**
   - Componentes que superen los 30 KB en dependencias (`FullCalendar`, `Chart.js`, modales de creación con múltiples selects y datalists) deben importarse de forma asíncrona o mediante el prefijo `Lazy*` de Nuxt.

---

## 2. Reducción de Latencia de Red

### A. Deduplicación y Claves Estables en `useAsyncData` y `useApiFetch`
- Al usar `useApiFetch` o `useAsyncData`, define siempre una clave única basada en los parámetros de la consulta:
  ```ts
  // BIEN: clave única que deduplica y evita llamadas simultáneas redundantes
  const { data, refresh } = await useApiFetch(`/appointments`, {
    key: `appointments-page-${page.value}-${filter.value}`,
    query: { page: page.value, estado: filter.value }
  })
  ```
- **Evitar llamadas duplicadas en hooks de ciclo de vida:** No llamar a un `fetch` manual en `onMounted` si la página ya carga datos mediante `useAsyncData` en el setup script.

### B. Prefetching Predictivo
- Usa `<NuxtLink>` con la directiva `prefetch` en los enlaces más frecuentados del sidebar (`/appointments`, `/store`, `/cart`) para que los chunks de JavaScript se descarguen en segundo plano durante los tiempos ociosos de la red.

### C. Consolidación de Peticiones (Evitar N+1 en Cliente)
- Prefiere consumir endpoints agregados del backend (`/dashboard`, `/reports`, `/barber/agenda`) que ya empaquetan KPIs, gráficas y listados en una sola respuesta JSON, en lugar de encadenar 4 o 5 llamadas `$fetch` separadas desde diferentes componentes hijos.

---

## 3. Optimización de Renderizado y Bundle

### A. Aislamiento de Librerías Pesadas
- **FullCalendar (`@fullcalendar/*`):**
  - Debe importarse **únicamente** en `app/pages/appointments/calendar.vue`. No debe incluirse en layouts globales ni plugins generales.
  - Asegurar que todos los paquetes de `@fullcalendar/*` compartan exactamente la misma versión fijada (`6.1.21`).
- **Chart.js (`chart.js` y `vue-chartjs`):**
  - Centralizar la configuración, escalas y colores en `app/utils/chartTheme.ts` y el plugin `plugins/chart.client.ts`.
  - Evitar instanciar `new Chart(...)` directamente sobre elementos del DOM imperativo; usar los componentes reactivos `<Line>`, `<Bar>`, `<Doughnut>` con datos reactivos mínimos.
  - Usar `v-if` sobre contenedores plegables con gráficas (como en `Administrador.vue`) para que el `<canvas>` no inicialice en dimensiones 0x0 antes de ser visible.

### B. Gestión de Reactividad y Listados Grandes
- Para tablas con cientos de filas (Logs, Historial de Pagos, Movimientos de Inventario):
  - Usar `shallowRef()` en lugar de `ref()` cuando el array de datos solo se reemplaza completamente en paginación y no requiere reactividad profunda propiedad por propiedad.
  - En bucles `v-for`, usar siempre como `:key` el identificador inmutable (`item.id` o `item.code`), **nunca** el índice del array (`:key="index"`), para que el Virtual DOM de Vue no destruya y recree nodos innecesariamente en reordenamientos.

### C. Prevención de FOUC y Carga de Fuentes
- Mantener la tipografía optimizada con `@nuxt/fonts` (Google Fonts descargadas localmente o con `font-display: swap`).
- El script de anti-flash en el `<head>` de `nuxt.config.ts` debe mantenerse mínimo (lectura síncrona rápida de la cookie `ub_theme`) para no bloquear el hilo principal de renderizado.

---

## 4. Checklist de Verificación de Rendimiento

Antes de dar por finalizada una optimización de rendimiento:

- [ ] `npm run build`: La compilación debe completar sin advertencias de chunks gigantescos (> 500 kB sin code-splitting).
- [ ] DevTools Network: En una navegación entre páginas, verificar que no existan llamadas duplicadas al mismo endpoint.
- [ ] Memoria: Verificar que no haya listeners o intervals acumulándose en componentes desmontados (`onUnmounted(() => clearInterval(...))`).
- [ ] `npx eslint . --max-warnings=0`: Cero violaciones de sintaxis o variables no utilizadas.
- [ ] `npx playwright test`: La suite E2E debe ejecutarse contra el build de producción pasando al 100%.
