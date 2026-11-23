/*
 * Protege las rutas de un módulo apagado. La página declara su interruptor en
 * definePageMeta({ middleware: ['auth', 'feature'], feature: 'packages' }). Si el módulo está apagado
 * (o aún no hay respuesta de GET /barbershop), escribir la URL a mano manda a /dashboard.
 * Como 'staff', no reemplaza al backend: ahí las rutas de un módulo apagado ni existen (404).
 */
import type { FeatureName } from '~/composables/useFeatures'

export default defineNuxtRouteMiddleware(async (to) => {
  const feature = to.meta.feature as FeatureName | undefined
  if (!feature) return

  const { load, isEnabled } = useFeatures()
  await load()

  if (!isEnabled(feature)) {
    return navigateTo('/dashboard')
  }
})
