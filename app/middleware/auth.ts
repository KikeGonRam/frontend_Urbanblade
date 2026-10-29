/*
 * Exige sesión. En una carga directa (F5 o URL pegada) `user` aún es null porque nadie pasó antes por
 * /dashboard; sin él el menú lateral queda vacío y el avatar muestra "U". Por eso se carga aquí.
 * fetchMe() limpia el token si el servidor lo rechaza, así que se revisa de nuevo después.
 */
export default defineNuxtRouteMiddleware(async (to) => {
  const { isAuthenticated, user, fetchMe } = useAuth()

  if (isAuthenticated.value && !user.value) {
    await fetchMe()
  }

  if (!isAuthenticated.value) {
    return navigateTo({ path: '/login', query: { redirect: to.fullPath } })
  }
})
