<script setup lang="ts">
/*
 * Google redirige aquí (barber: SocialAuthController::callback()) con
 * ?token=... en la URL. Guarda el token y limpia la URL de inmediato --
 * dejarlo visible en la barra de direcciones/historial sería un riesgo
 * innecesario (ver guardrail del plan).
 */
definePageMeta({ layout: false })

const route = useRoute()
const { token, fetchMe } = useAuth()
const failed = ref(false)

onMounted(async () => {
  const incomingToken = typeof route.query.token === 'string' ? route.query.token : ''

  if (!incomingToken) {
    failed.value = true

    return
  }

  token.value = incomingToken
  history.replaceState(history.state, '', '/auth/callback')

  const user = await fetchMe()
  if (!user) {
    failed.value = true

    return
  }

  await navigateTo('/dashboard', { replace: true })
})
</script>

<template>
  <div class="flex min-h-screen flex-col items-center justify-center gap-4 bg-main p-6 text-center">
    <template v-if="!failed">
      <div class="h-8 w-8 animate-spin rounded-full border-2 border-gold border-t-transparent" />
      <p class="text-sm text-muted">Completando tu acceso…</p>
    </template>
    <template v-else>
      <p class="text-sm text-red-400">No se pudo completar el acceso con Google.</p>
      <NuxtLink to="/login" class="text-sm text-gold hover:underline">Volver a intentar</NuxtLink>
    </template>
  </div>
</template>
