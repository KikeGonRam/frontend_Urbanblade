/**
 * Primer filtro de cada petición (antes de enrutar):
 *  - Solo GET, HEAD y OPTIONS: la web no tiene páginas ni rutas que reciban PUT, PATCH o DELETE
 *    (la API vive en otro dominio). Antes devolvían 200 con la página.
 *  - Rutas con «//», barras invertidas o «..» codificado (p. ej. //dominio/%2e%2e) se rechazan con
 *    404: antes llegaban al enrutador y terminaban en un 500, y «//dominio» podía confundirse con
 *    una URL absoluta al redirigir.
 */
const METODOS_PERMITIDOS = new Set(['GET', 'HEAD', 'OPTIONS'])
const RUTA_SOSPECHOSA = /^\/\/|\|%5c|%2e%2e|\.\.\//i

export default defineEventHandler((event) => {
  if (!METODOS_PERMITIDOS.has(event.method)) {
    setResponseHeader(event, 'Allow', 'GET, HEAD, OPTIONS')
    throw createError({ statusCode: 405, statusMessage: 'Method Not Allowed' })
  }

  if (RUTA_SOSPECHOSA.test(event.path)) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }
})
