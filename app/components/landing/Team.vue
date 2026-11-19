<script setup lang="ts">
/** «Los Maestros»: tarjetas de los primeros barberos con enlace a su ficha pública. */
import type { LandingBarber } from '~/types/landing'
import { vReveal } from '~/composables/useLandingReveal'
import { publicImageUrl } from '~/utils/publicImage'

defineProps<{ barbers: LandingBarber[], pending: boolean, few: boolean }>()

function initials(name?: string | null) {
  if (!name) return '?'
  return name.trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase() ?? '').join('')
}
</script>

<template>
  <section id="equipo" class="bg-main py-20">
    <div class="mx-auto max-w-7xl px-4">
      <div class="mb-10 flex flex-col justify-between gap-6 md:flex-row md:items-end">
        <div>
          <p class="mb-3 flex items-center gap-3 text-xs font-black uppercase tracking-[0.4em] text-gold">
            <span class="inline-block h-px w-8 bg-gold" />
            Nuestro Equipo
          </p>
          <h2 class="text-4xl font-black uppercase tracking-tight text-ink">Los <span class="text-gold">Maestros</span></h2>
          <p class="mt-2 text-sm text-muted">Arquitectos de la imagen masculina</p>
        </div>
        <NuxtLink to="/equipo" class="flex min-h-[44px] items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-gold transition-colors hover:text-ink">
          Ver equipo completo <span>&rarr;</span>
        </NuxtLink>
      </div>

      <ClientOnly>
        <p v-if="pending" class="py-20 text-center text-muted">Cargando maestros…</p>
        <p v-else-if="!barbers.length" class="py-20 text-center text-muted">Nuestros maestros se están preparando...</p>
        <div v-else :class="few ? 'lg:flex lg:items-center lg:gap-14' : ''">
          <div
            :class="few
              ? '-mx-4 flex snap-x snap-mandatory gap-5 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0 lg:shrink-0 lg:overflow-visible'
              : '-mx-4 flex snap-x snap-mandatory gap-5 overflow-x-auto px-4 pb-4 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-8 sm:overflow-visible sm:px-0 lg:grid-cols-4'"
          >
            <NuxtLink
              v-for="(barber, k) in barbers" :key="barber.id"
              v-reveal
              :to="`/equipo/${barber.slug}`"
              :class="few ? 'w-[72%] sm:w-60 lg:w-64' : 'w-[72%] sm:w-auto'" class="barber-card reveal group relative block shrink-0 snap-center"
              :style="{ transitionDelay: `${k * 120}ms` }"
            >
              <div class="relative aspect-[3/4] overflow-hidden rounded-3xl border border-line bg-card">
                <img
                  v-if="barber.foto" :src="publicImageUrl(barber.foto, 1400) ?? undefined" :srcset="`${publicImageUrl(barber.foto, 700) ?? ''} 700w, ${publicImageUrl(barber.foto, 1400) ?? ''} 1400w`" sizes="(min-width: 1024px) 25vw, 100vw" loading="lazy" :alt="`Foto de ${barber.user?.name}`"
                  class="h-full w-full object-cover grayscale transition-all duration-700 group-hover:scale-110 group-hover:grayscale-0"
                >
                <div v-else class="flex h-full w-full items-center justify-center bg-gradient-to-br from-gold/10 via-card to-main">
                  <span class="text-4xl font-black uppercase tracking-tighter text-gold/50">{{ initials(barber.user?.name) }}</span>
                </div>
                <div class="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                <span v-if="barber.avg_rating && (barber.total_reviews ?? 0) > 0" class="absolute left-4 top-4 rounded-full bg-black/60 px-3 py-1.5 text-xs font-bold text-gold backdrop-blur-sm">
                  ★ {{ Number(barber.avg_rating).toFixed(1) }} · {{ barber.total_reviews }}
                </span>
                <div class="absolute bottom-0 left-0 right-0 translate-y-1 p-6 transition-transform duration-400 group-hover:translate-y-0">
                  <h3 class="text-base font-black uppercase text-white">{{ barber.user?.name }}</h3>
                  <p class="mt-1 text-xs font-bold uppercase tracking-widest text-gold">{{ barber.especialidades || 'Master Groomer' }}</p>
                  <div class="mt-3 flex items-center gap-1 text-xs font-black uppercase tracking-widest text-white/50 transition-colors duration-400 group-hover:text-gold/80">
                    <span>Reservar con {{ barber.user?.name?.split(' ')[0] }}</span>
                    <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                  </div>
                </div>
              </div>
            </NuxtLink>
          </div>
          <div v-if="few" class="mt-8 max-w-md lg:mt-0">
            <h3 class="text-2xl font-black uppercase tracking-tight text-ink">Reserva con quien prefieras</h3>
            <p class="mt-3 text-sm leading-relaxed text-muted">Cada maestro tiene su propia agenda: elige con quién y mira sus horarios reales, sin crear cuenta.</p>
            <NuxtLink to="/reservar" class="ui-btn mt-6 inline-flex px-8 py-3 text-xs tracking-[0.15em]">Elegir horario</NuxtLink>
          </div>
        </div>
        <template #fallback>
          <p class="py-20 text-center text-muted">Cargando maestros…</p>
        </template>
      </ClientOnly>
    </div>
  </section>
</template>
