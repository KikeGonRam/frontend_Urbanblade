/* Restringe las paginas de Mi Espacio al barbero autenticado. */
export default defineNuxtRouteMiddleware(async () => {
  const { user, hasRole, fetchMe } = useAuth()
  const { denegar } = useAccesoDenegado()
  if (!user.value) await fetchMe()
  if (!hasRole('barbero')) return denegar()
})
