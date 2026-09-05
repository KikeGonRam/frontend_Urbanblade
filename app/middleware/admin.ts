/*
 * Restringe una ruta solo a administrador — para endpoints como
 * Api/Admin/Client/ClientAdminController, que además de la ruta
 * role.custom:administrador tienen su propio guard interno
 * (authorizeAdmin()). Mismo criterio que 'staff' (ver ese archivo).
 */
export default defineNuxtRouteMiddleware(async () => {
  const { user, hasRole, fetchMe } = useAuth()

  if (!user.value) {
    await fetchMe()
  }

  if (!hasRole('administrador')) {
    return navigateTo('/dashboard')
  }
})
