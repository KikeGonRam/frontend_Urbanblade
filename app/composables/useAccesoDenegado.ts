/*
 * Aviso para quien abre por URL una pantalla que su rol no usa. Los middlewares de rol lo mandan a /dashboard;
 * sin este aviso la redirección parecía un fallo silencioso. El layout del dashboard lo muestra.
 */
export function useAccesoDenegado() {
  const aviso = useState<string | null>('acceso_denegado', () => null)

  function denegar() {
    aviso.value = 'No tienes permiso para abrir esa pantalla. Te llevamos a tu panel.'

    return navigateTo('/dashboard')
  }

  function limpiar() {
    aviso.value = null
  }

  return { aviso, denegar, limpiar }
}
