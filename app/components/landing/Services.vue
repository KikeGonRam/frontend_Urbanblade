<script setup lang="ts">
/** Catálogo de servicios de la portada (vista previa con el selector de estilos). */
import type { LandingService } from '~/types/landing'
import { vReveal } from '~/composables/useLandingReveal'

defineProps<{ services: LandingService[], pending: boolean }>()
</script>

<template>
  <section id="servicios" class="relative overflow-hidden bg-main py-20">
    <div class="mx-auto max-w-7xl px-4">
      <div class="mb-10 text-center">
        <p class="mb-4 flex items-center justify-center gap-3 text-xs font-black uppercase tracking-[0.4em] text-gold">
          <span class="inline-block h-px w-8 bg-gold" />
          Nuestros Servicios
          <span class="inline-block h-px w-8 bg-gold" />
        </p>
        <h2 class="text-4xl font-black uppercase tracking-tight text-ink">Elige tu <span class="text-gold">estilo</span></h2>
        <p class="mx-auto mt-4 max-w-md text-sm leading-relaxed text-muted">Pasa el cursor o toca un servicio para verlo en grande y reservarlo en un paso.</p>
        <div class="line-grow mx-auto mt-6 h-0.5 w-16 rounded-full bg-gradient-to-r from-gold to-gold-dim shadow-[0_0_12px_rgba(212,175,55,0.5)]" />
      </div>

      <ClientOnly>
        <p v-if="pending" class="py-20 text-center italic text-muted">Cargando catálogo premium…</p>
        <p v-else-if="!services.length" class="py-20 text-center italic text-muted">El catálogo estará disponible muy pronto.</p>
        <div v-else v-reveal class="reveal">
          <LandingStyleLookbook :services="services" />
        </div>
        <template #fallback>
          <p class="py-20 text-center italic text-muted">Cargando catálogo premium…</p>
        </template>
      </ClientOnly>

      <div class="mt-12 text-center">
        <NuxtLink to="/reservar" class="ui-btn-secondary px-10 py-4 text-xs tracking-[0.2em]">
          Reservar ahora &rarr;
        </NuxtLink>
      </div>
    </div>
  </section>
</template>
