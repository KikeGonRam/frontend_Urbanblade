/*
 * Restringe una ruta a administrador/ingeniero — mismo criterio que el
 * backend usa para las rutas de solo lectura que ambos roles comparten
 * (/reports, /logs, /admin/system/status; ver la auditoría ruta por ruta
 * en barber/routes/api.php, guardrail #24). ingeniero es de solo lectura:
 * nunca debe ganar acceso a una página que no tenga este mismo criterio
 * en su ruta de API correspondiente.
 */
export default defineNuxtRouteMiddleware(async () => {
  const { user, hasRole, fetchMe } = useAuth()

  if (!user.value) {
    await fetchMe()
  }

  if (!hasRole('administrador') && !hasRole('ingeniero')) {
    return navigateTo('/dashboard')
  }
})
