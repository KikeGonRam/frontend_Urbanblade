/*
 * Carga los interruptores de módulos al montar la app (tras hidratar, para no desajustar el HTML del servidor).
 * El menú los lee de useFeatures(); el middleware 'feature' espera la misma petición compartida.
 */
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.hook('app:mounted', () => {
    void useFeatures().load()
  })
})
