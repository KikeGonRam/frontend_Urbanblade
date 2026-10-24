/*
 * Carga la analítica solo si la persona ya la aceptó en una visita anterior (cookie ub_consent).
 * Sin elección, abre el banner. La primera aceptación se atiende en useConsent().accept().
 */
export default defineNuxtPlugin(() => {
  const { choice, bannerOpen, loadAnalytics } = useConsent()

  if (choice.value === 'accepted') loadAnalytics()
  else if (choice.value !== 'rejected') bannerOpen.value = true
})
