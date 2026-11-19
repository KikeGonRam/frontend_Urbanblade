<script setup lang="ts">
/** Prueba social: solo se muestra si ya hay reseñas reales (no hay testimonios de ejemplo). */
import type { LandingPublicStats } from '~/types/landing'
import { vReveal } from '~/composables/useLandingReveal'

defineProps<{ stats: LandingPublicStats }>()
</script>

<template>
  <section class="relative overflow-hidden border-y border-line bg-panel py-24">
    <div class="pointer-events-none absolute -top-40 right-0 h-96 w-96 rounded-full bg-gold/4 blur-[120px]" />
    <div class="mx-auto max-w-4xl px-4 text-center">
      <p class="mb-4 flex items-center justify-center gap-3 text-xs font-black uppercase tracking-[0.4em] text-gold">
        <span class="inline-block h-px w-8 bg-gold" />
        Opiniones reales
        <span class="inline-block h-px w-8 bg-gold" />
      </p>
      <h2 class="text-4xl font-black uppercase tracking-tight text-ink">Lo que dicen <span class="text-gradient-gold">nuestros clientes</span></h2>
      <div v-reveal class="reveal mt-10 inline-flex items-center gap-5 rounded-2xl border border-line bg-card px-8 py-5">
        <div>
          <p class="text-4xl font-black text-ink">{{ stats.rating }}</p>
          <p class="mt-1 text-gold" role="img" :aria-label="`Calificación ${stats.rating} de 5`">★★★★★</p>
        </div>
        <div class="h-12 w-px bg-line" />
        <p class="text-sm font-bold text-ink">{{ stats.reviews }} {{ stats.reviews === 1 ? 'reseña' : 'reseñas' }}<br><span class="text-xs font-medium text-muted">de clientes con cita completada</span></p>
      </div>
    </div>
  </section>
</template>
