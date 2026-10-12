/*
 * Restringe una ruta solo a cliente — para Tienda/Carrito/Mis Pedidos
 * (Fase 9.4), equivalente cliente de 'admin'/'staff' para esas otras
 * secciones. Mismo criterio: fetchMe() si la ruta se abre directo.
 */
import { isClientExperience } from '../utils/userExperience'

export default defineNuxtRouteMiddleware(async () => {
  const { user, fetchMe } = useAuth()

  if (!user.value) {
    await fetchMe()
  }

  if (!isClientExperience(user.value?.roles)) {
    return navigateTo('/dashboard')
  }
})
