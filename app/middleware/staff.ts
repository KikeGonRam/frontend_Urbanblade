/*
 * Restringe una ruta a administrador/recepcionista — mismo criterio que el
 * backend usa para /api/v1/appointments/calendar-data (ver
 * Api/Appointment/AppointmentController::calendarData()). No reemplaza la
 * verificación real del servidor (esa sigue siendo la autoridad — un 403 de
 * la API se maneja igual que cualquier otro error), solo evita mostrar la
 * página a alguien que de todos modos no podrá cargar sus datos.
 */
export default defineNuxtRouteMiddleware(async () => {
  const { user, hasRole, fetchMe } = useAuth()

  // user puede seguir null en una carga directa a esta ruta (no pasó antes
  // por /dashboard, que es quien normalmente dispara fetchMe()).
  if (!user.value) {
    await fetchMe()
  }

  if (!hasRole('administrador') && !hasRole('recepcionista')) {
    return navigateTo('/dashboard')
  }
})
