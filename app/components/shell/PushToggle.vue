<script setup lang="ts">
/*
 * Campana de notificaciones push en el shell (sidebar desktop + topbar
 * móvil) — Nuxt todavía no tiene una pantalla de perfil/cuenta propia (ver
 * .claude/skills/push-and-chat-plan/SKILL.md), así que el toggle vive aquí
 * en vez de en un formulario de preferencias dedicado.
 */
const { isSupported, permission, isSubscribed, loading, error, detectSupport, refreshSubscriptionState, toggle } = usePush()

onMounted(async () => {
  detectSupport()
  await refreshSubscriptionState()
})
</script>

<template>
  <button
    v-if="isSupported && permission !== 'denied'"
    type="button"
    :disabled="loading"
    class="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-accent hover:text-ink disabled:opacity-50"
    :class="{ 'text-gold hover:text-gold': isSubscribed }"
    :aria-label="error || (isSubscribed ? 'Notificaciones push activas — clic para desactivar' : 'Activar notificaciones push de citas próximas')"
    :title="error || (isSubscribed ? 'Notificaciones push activas — clic para desactivar' : 'Activar notificaciones push de citas próximas')"
    @click="toggle"
  >
    <span class="relative inline-flex">
      <svg class="h-5 w-5" viewBox="0 0 24 24" :fill="isSubscribed ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="1.5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path stroke-linecap="round" stroke-linejoin="round" d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
      <span v-if="isSubscribed" class="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-gold" />
    </span>
  </button>
</template>
