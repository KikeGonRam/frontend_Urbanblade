---
name: frontend-security-hardening
description: 'Directrices, políticas de seguridad y checklist de blindaje contra vulnerabilidades (XSS, CSRF, Open Redirect, fugas de tokens, inyección y manipulación de estado) en el frontend Nuxt 4 de UrbanBlade. Consultar al tocar autenticación, cookies, pasarelas de pago (Stripe), redirecciones o renderizado de datos externos.'
---

# Blindaje de Seguridad en Frontend Nuxt 4 (UrbanBlade)

## Objetivo

Garantizar que el cliente web Nuxt 4 de UrbanBlade mantenga una postura de seguridad robusta, protegiendo las credenciales y tokens de los usuarios (`ub_token`), evitando vulnerabilidades cliente comunes (XSS, CSRF, Open Redirect, Clickjacking, Fugas de PII) y garantizando el aislamiento de operaciones sensibles (pagos Stripe, flujos de autenticación OAuth/Sanctum).

---

## 1. Principios Innegociables

1. **Prohibición absoluta de `v-html` no sanitizado:**
   - Queda terminantemente prohibido el uso de `v-html` para renderizar datos provenientes de la API, parámetros de URL o inputs de usuario.
   - Si se requiere renderizar contenido enriquecido (ej. términos legales o markdown), debe filtrarse obligatoriamente con `DOMPurify` utilizando una lista blanca estricta de tags y atributos.
2. **Almacenamiento de tokens en Cookies seguras, jamás en Web Storage:**
   - El token de autenticación (`ub_token`) debe residir en una Cookie configurada con `sameSite: 'lax'` y `secure: true` (en producción).
   - **Prohibido** almacenar tokens de sesión, JWTs o credenciales en `localStorage` o `sessionStorage`, ya que cualquier script inyectado vía XSS puede extraerlos instantáneamente.
3. **Aislamiento absoluto de datos bancarios (PCI-DSS):**
   - Jamás capturar números de tarjeta de crédito, CVVs o fechas de vencimiento en campos `<input>` estándar de Vue o en estados reactivos (`ref`, `reactive`, `pinia`).
   - La captura debe delegarse exclusivamente a los componentes iframe de **Stripe Elements** (`js.stripe.com`).
4. **Validación estricta contra Open Redirect:**
   - Todo parámetro de redirección (`redirect`, `returnUrl`, `next`) debe ser sanitizado antes de usarse en `navigateTo()` o `router.push()`. Debe ser estrictamente una ruta relativa local que inicie con `/` y no con `//` ni protocolos externos (`http://`, `https://`, `javascript:`).
5. **Cero exposición de datos sensibles y trazas técnicas:**
   - No imprimir tokens, payloads de login ni contraseñas en `console.log` o `console.debug`.
   - No exponer mensajes de error crudos de la base de datos (MongoDB, drivers) o trazas de Laravel al usuario final; mapear siempre a mensajes amigables y tipificados.

---

## 2. Autenticación y Manejo Seguro de Sesión

### A. Configuración de la Cookie de Sesión (`ub_token`)
El helper de autenticación debe instanciar la cookie respetando las directrices de seguridad:

```ts
// app/composables/useAuth.ts o useApiFetch.ts
const tokenCookie = useCookie<string | null>('ub_token', {
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 60 * 60 * 24 * 30, // 30 días
  path: '/'
})
```

### B. Limpieza Inmediata de Parámetros Sensibles en URLs (OAuth / Callback)
Cuando el backend redirige al frontend tras un flujo OAuth o reset de contraseña con un token en los parámetros de la URL (`?token=...` o `?code=...`):
1. Extraer el token de inmediato y guardarlo en la cookie segura.
2. Limpiar la URL de la barra de direcciones sin provocar un reload mediante `history.replaceState` o `router.replace({ query: {} })`.
3. Esto evita que el token quede registrado en el historial del navegador o se filtre en la cabecera `Referer` al navegar hacia enlaces externos.

```ts
// Ejemplo de consumo seguro de callback:
const route = useRoute()
const router = useRouter()

if (route.query.token) {
  tokenCookie.value = String(route.query.token)
  // Reemplazar la URL eliminando el token de la barra de direcciones
  router.replace({ path: route.path, query: {} })
}
```

### C. Protección Contra Open Redirect (Redirecciones Abiertas)
Al gestionar redirecciones dinámicas tras el login:

```ts
export function getSafeRedirectUrl(target: unknown, fallback = '/appointments'): string {
  if (typeof target !== 'string' || !target.trim()) {
    return fallback
  }

  const clean = target.trim()

  // Prohibir protocolos explícitos y URLs relativas de protocolo (//ejemplo.com)
  if (clean.startsWith('//') || clean.includes('://') || clean.toLowerCase().startsWith('javascript:')) {
    return fallback
  }

  // Asegurar que inicia con un solo slash relativo
  if (!clean.startsWith('/')) {
    return fallback
  }

  return clean
}
```

### D. Logout Seguro (Invalidación Doble)
El proceso de cierre de sesión debe invalidar el token tanto en el backend como en el cliente:
1. Llamar a `POST /api/auth/logout` con el Bearer token activo para revocar el Personal Access Token de Sanctum en MongoDB.
2. Eliminar la cookie local: `tokenCookie.value = null`.
3. Limpiar cualquier estado de usuario en memoria o store.
4. Redirigir a `/auth/login`.

---

## 3. Prevención de Cross-Site Scripting (XSS) e Inyección

### A. Renderizado por Defecto
Vue 3 y Nuxt escapan automáticamente todo texto insertado mediante la sintaxis de bigotes `{{ variable }}` o directivas `:title="variable"`.
- Utilizar siempre `{{ ... }}` o `v-text` para renderizar datos de clientes, barberos, servicios, notas de citas o reseñas.

### B. Uso Restringido y Sanitizado si se Requiere HTML Dinámico
Si alguna sección requiere renderizar HTML (ej. descripciones enriquecidas de servicios o cláusulas legales dinámicas):
```ts
import DOMPurify from 'dompurify'

// Sanitizar con lista blanca mínima antes de renderizar
const safeHtml = computed(() => {
  return DOMPurify.sanitize(rawServiceDescription.value, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'ul', 'ol', 'li', 'br'],
    ALLOWED_ATTR: ['href', 'target', 'rel']
  })
})
```
En el template:
```html
<div v-html="safeHtml" />
```

### C. Sanitización de Atributos `href`
Nunca enlazar rutas arbitrarias sin validar el protocolo:
```html
<!-- PELIGROSO: usuario puede inyectar "javascript:alert(1)" -->
<a :href="userProvidedWebsite">Visitar web</a>

<!-- SEGURO: validar que inicie con https:// o http:// -->
<a :href="safeExternalUrl" target="_blank" rel="noopener noreferrer">Visitar web</a>
```

---

## 4. Pasarela de Pagos (Stripe Elements)

1. **Cumplimiento PCI-DSS SAQ A:**
   - La aplicación frontend de UrbanBlade opera bajo el modelo SAQ A.
   - Ningún dato de tarjeta (PAN, CVC, fecha de expiración) debe transitar o tocar el DOM accesible por scripts del cliente.
2. **Uso de Stripe SDK:**
   - El SDK de Stripe debe cargarse desde `https://js.stripe.com/v3/`.
   - Se debe utilizar el componente oficial de Stripe Elements (`stripe.elements().create('card' | 'payment')`).
   - Al completar la transacción, únicamente se envía al backend el `payment_method_id` o se confirma el `client_secret` de un `PaymentIntent`.
3. **Manejo de Errores de Pago:**
   - Los errores de tarjeta rechazada devueltos por Stripe (`error.message`) pueden mostrarse directamente al usuario, ya que están diseñados de forma segura por Stripe.

---

## 5. Cabeceras de Seguridad y Configuración Nitro

En `nuxt.config.ts`, asegurar que Nitro emita las cabeceras HTTP de defensa en profundidad:

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  routeRules: {
    '/**': {
      headers: {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'SAMEORIGIN',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
      }
    }
  }
})
```

---

## 6. Manejo de Errores y Fuga de Información

1. **Ocultamiento de Errores Crudos de Backend:**
   - El backend Laravel puede retornar respuestas de error 500 con detalles de excepción en entornos locales. El frontend nunca debe volcar el objeto de error entero en la interfaz (`{{ error }}`).
   - Utilizar mensajes estándar de contingencia:
     - 401: "Tu sesión ha expirado. Por favor, inicia sesión nuevamente."
     - 403: "No tienes permisos para realizar esta acción."
     - 404: "El recurso solicitado no fue encontrado."
     - 422: Extraer `error.data.errors` y mapear cada campo al formulario correspondiente.
     - 500: "Ocurrió un error inesperado. Por favor, intenta de nuevo más tarde."
2. **Higiene en Consola de Depuración:**
   - Asegurarse de que en producción no se filtren datos PII (DNI, teléfono, correos de clientes) ni tokens en la consola de herramientas de desarrollo.

---

## 7. Checklist de Seguridad para PRs y Código Nuevo

- [ ] ¿Se eliminó cualquier uso de `v-html` no filtrado con `DOMPurify`?
- [ ] ¿El token de sesión se almacena en cookie con `sameSite: 'lax'` y `secure` en producción?
- [ ] ¿Se evita terminantemente el almacenamiento de tokens en `localStorage`?
- [ ] ¿Las redirecciones dinámicas (`?redirect=...`) validan contra Open Redirect usando `getSafeRedirectUrl`?
- [ ] ¿Los flujos OAuth / callbacks remueven tokens de los query parameters de la URL inmediatamente?
- [ ] ¿Las operaciones con Stripe utilizan exclusivamente iframes de Stripe Elements?
- [ ] ¿Los enlaces externos (`target="_blank"`) incluyen `rel="noopener noreferrer"`?
- [ ] ¿Los errores de API se muestran con mensajes amigables sin exponer trazas técnicas internas?
