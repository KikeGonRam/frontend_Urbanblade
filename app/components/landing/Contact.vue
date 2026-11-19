<script setup lang="ts">
/** «Visítanos»: datos de contacto, redes y mapa de la ficha del negocio. */
import type { LandingContactRow, LandingSocial } from '~/types/landing'
import { vReveal } from '~/composables/useLandingReveal'

defineProps<{
  contactInfo: LandingContactRow[]
  socials: LandingSocial[]
  mapAddress: string
  shopName: string | null
}>()
</script>

<template>
  <section id="contacto" class="relative overflow-hidden bg-main py-20">
    <div class="mx-auto max-w-7xl px-4">
      <div class="mb-8 text-center">
        <p class="mb-4 flex items-center justify-center gap-3 text-xs font-black uppercase tracking-[0.4em] text-gold">
          <span class="inline-block h-px w-8 bg-gold" />
          Encuéntranos
          <span class="inline-block h-px w-8 bg-gold" />
        </p>
        <h2 class="text-4xl font-black uppercase tracking-tight text-ink">Visítanos <span class="text-gold">Hoy</span></h2>
      </div>

      <div v-reveal class="reveal overflow-hidden rounded-3xl border border-line shadow-[0_30px_80px_rgba(0,0,0,0.4)]">
        <div class="flex flex-col lg:flex-row">
          <div class="relative overflow-hidden bg-panel p-8 lg:w-[38%] lg:p-10">
            <div class="pointer-events-none absolute -bottom-20 -left-20 h-60 w-60 rounded-full bg-gold/5 blur-[80px]" />
            <h3 class="relative z-10 mb-6 text-lg font-black uppercase tracking-tighter text-ink">Información de Contacto</h3>
            <div class="relative z-10 space-y-5">
              <div v-for="info in contactInfo" :key="info.label" class="flex gap-4">
                <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-gold/10 bg-gold/8 text-gold">
                  <svg v-if="info.label === 'Ubicación'" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /></svg>
                  <svg v-else-if="info.label === 'Contacto'" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                  <svg v-else class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <div>
                  <p class="mb-1 text-xs font-black uppercase tracking-widest text-gold">{{ info.label }}</p>
                  <p class="text-sm font-medium leading-relaxed text-ink">
                    <template v-for="(line, li) in info.lines" :key="line">
                      <span :class="{ 'text-muted': info.mutedLastLine && li === info.lines.length - 1 }">{{ line }}</span><br v-if="li < info.lines.length - 1">
                    </template>
                  </p>
                </div>
              </div>
            </div>
            <div v-if="socials.length" class="relative z-10 mt-10 border-t border-line pt-8">
              <p class="mb-4 text-xs font-black uppercase tracking-widest text-muted">Síguenos</p>
              <div class="flex gap-3">
                <a
                  v-for="social in socials" :key="social.network"
                  :href="social.url" target="_blank" rel="noopener noreferrer"
                  :aria-label="`UrbanBlade en ${social.network}`"
                  class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line bg-ink/5 text-muted transition-all hover:border-gold/20 hover:bg-gold/10 hover:text-gold"
                >
                  <LandingSocialIcon :network="social.network" />
                </a>
              </div>
            </div>
          </div>

          <div v-if="mapAddress" class="group relative h-[260px] overflow-hidden bg-panel lg:h-auto lg:flex-1">
            <iframe
              :src="`https://www.google.com/maps?q=${encodeURIComponent(mapAddress)}&output=embed`"
              class="absolute inset-0 h-full w-full border-0 opacity-90 grayscale-[35%] contrast-125 transition-all duration-500 group-hover:opacity-100 group-hover:grayscale-0"
              loading="lazy" referrerpolicy="no-referrer-when-downgrade" :title="`Ubicación de ${shopName || 'UrbanBlade'} en el mapa`"
            />
            <a
              :href="`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapAddress)}`"
              target="_blank" rel="noopener noreferrer"
              class="absolute bottom-4 right-4 flex min-h-[44px] items-center gap-2 rounded-xl border border-gold/20 bg-main/90 px-4 py-2.5 text-xs font-black uppercase tracking-widest text-gold backdrop-blur transition-all hover:bg-gold hover:text-black"
            >
              <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              Abrir en Google Maps
            </a>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
