<script setup lang="ts">
/** CTA final: franja delgada que invita a reservar (o a entrar al panel si ya hay sesión). */
import { vReveal } from '~/composables/useLandingReveal'

const { isAuthenticated } = useAuth()
</script>

<template>
  <section class="relative overflow-hidden border-t border-line bg-panel py-10">
    <div v-reveal class="reveal mx-auto flex max-w-5xl flex-col items-center justify-between gap-5 px-4 text-center sm:flex-row sm:text-left">
      <div>
        <p class="text-xl font-black uppercase tracking-tight text-ink">¿Listo para tu <span class="text-gradient-gold">mejor versión</span>?</p>
        <p class="mt-1 text-sm text-muted">Elige servicio, maestro y un horario realmente disponible.</p>
      </div>
      <NuxtLink :to="isAuthenticated ? '/dashboard' : '/reservar'" class="ui-btn shrink-0 px-10 py-4 text-[12px] tracking-[0.2em]">
        {{ isAuthenticated ? 'Mi panel' : 'Reservar ahora' }}
      </NuxtLink>
    </div>
  </section>
</template>
