/*
 * Carga la analítica solo si la persona ya la aceptó en una visita anterior (cookie ub_consent).
 * Sin elección, abre el banner. La primera aceptación se atiende en useConsent().accept().
 *
 * onNuxtReady() y no el cuerpo del plugin: este plugin corre en el cliente antes de que Vue
 * hidrate la página. Si bannerOpen.value pasaba a true aquí, el <div v-if="bannerOpen"> del
 * banner ya existía para el primer render del cliente mientras el HTML del servidor (con la
 * cookie sin decidir) seguía teniendo el comentario vacío de un v-if en false: un nodo de más
 * que Vue detecta como "Hydration node mismatch" en cada visita sin cookie de consentimiento
 * (confirmado: desaparece moviendo esta asignación a después de hidratar). loadAnalytics()
 * también se movió, aunque no toca el árbol, para no dejar el plugin dividido en dos momentos.
 */
export default defineNuxtPlugin(() => {
  const { choice, bannerOpen, loadAnalytics, clearAnalyticsCookies } = useConsent()

  onNuxtReady(() => {
    if (choice.value === 'accepted') loadAnalytics()
    else if (choice.value !== 'rejected') bannerOpen.value = true

    /*
     * Revocar en otra pestaña: la cookie ub_consent es la misma para todas (mismo navegador),
     * pero cada pestaña ya cargó o no el script de GTM por su cuenta y useCookie() no se entera
     * de un cambio hecho en otra pestaña sin releer document.cookie. Al volver a esta pestaña
     * (o si queda en segundo plano cuando pasa) se compara la cookie actual contra lo que esta
     * pestaña ya tiene cargado: si ya cargó GTM y la cookie ahora dice "rejected", se recarga
     * igual que reject() — es la única forma de verdad de dejar de enviar datos a un script ya
     * en ejecución. Si la cookie pasó a "accepted" aquí, se carga sin esperar a un refresh.
     */
    function syncWithOtherTabs() {
      const actual = useCookie<string | null>('ub_consent').value
      const yaCargado = !!document.getElementById('ub-gtm')

      if (actual === 'rejected' && yaCargado) {
        clearAnalyticsCookies()
        location.reload()
      } else if (actual === 'accepted' && !yaCargado) {
        bannerOpen.value = false
        loadAnalytics()
      }
    }

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') syncWithOtherTabs()
    })
    window.addEventListener('focus', syncWithOtherTabs)
  })
})
