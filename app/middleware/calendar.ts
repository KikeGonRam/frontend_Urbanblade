/*
 * Calendario de citas: administrador y recepcionista ven la agenda de todos; el barbero ve solo la suya (el backend
 * limita GET /appointments/calendar-data a sus citas aunque pida otro barbero). Como `staff`, solo evita mostrar la
 * página a quien de todos modos no podrá cargar sus datos; la autoridad sigue siendo el servidor.
 */
export default defineNuxtRouteMiddleware(async () => {
  const { user, hasRole, fetchMe } = useAuth()
  const { denegar } = useAccesoDenegado()

  if (!user.value) {
    await fetchMe()
  }

  if (!hasRole('administrador') && !hasRole('recepcionista') && !hasRole('barbero')) {
    return denegar()
  }
})
