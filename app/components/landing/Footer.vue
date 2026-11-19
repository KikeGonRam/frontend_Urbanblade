<script setup lang="ts">
/** Pie de la portada: navegación, contacto (solo lo capturado en /barbershop), redes y avisos legales. */
import type { LandingBarbershop, LandingSocial } from '~/types/landing'

defineProps<{ shop: LandingBarbershop | null, socials: LandingSocial[] }>()

const { reopen: reopenConsent } = useConsent()
</script>

<template>
  <footer class="relative overflow-hidden border-t border-line bg-main pb-24 pt-10 lg:pb-10">
    <div class="pointer-events-none absolute -bottom-32 -left-32 h-80 w-80 rounded-full bg-gold/4 blur-3xl" />
    <div class="mx-auto max-w-7xl px-4">
      <div class="flex flex-col items-start justify-between gap-8 md:flex-row">
        <div class="max-w-xs">
          <div class="mb-5 flex items-center gap-3">
            <img src="/images/urbanblade-mark.svg" class="h-9 w-9" alt="UrbanBlade">
            <span class="text-lg font-black uppercase tracking-tighter text-ink">Urban<span class="text-gold">Blade</span></span>
          </div>
          <p class="text-xs leading-relaxed text-muted">
            Líderes en el arte del grooming masculino. Unimos tradición y tecnología para una experiencia inigualable.
          </p>
        </div>

        <div class="grid grid-cols-2 gap-12 sm:grid-cols-3">
          <div>
            <h3 class="mb-5 text-xs font-black uppercase tracking-widest text-ink">Navegación</h3>
            <ul class="space-y-3 text-xs font-bold uppercase tracking-wider text-muted">
              <li><a href="#servicios" class="inline-flex min-h-[44px] items-center transition hover:text-gold">Servicios</a></li>
              <li><a href="#como-funciona" class="inline-flex min-h-[44px] items-center transition hover:text-gold">Proceso</a></li>
              <li><a href="#equipo" class="inline-flex min-h-[44px] items-center transition hover:text-gold">Maestros</a></li>
              <li><NuxtLink to="/login" class="inline-flex min-h-[44px] items-center transition hover:text-gold">Acceso Staff</NuxtLink></li>
            </ul>
          </div>
          <!-- Segundo bloque de contacto de la portada (el otro está en «Visítanos»): también sale de
               /barbershop, no de literales, y cada dato se oculta si la barbería no lo capturó. -->
          <div v-if="shop?.telefono || (shop?.horario_apertura && shop?.horario_cierre)">
            <h3 class="mb-5 text-xs font-black uppercase tracking-widest text-ink">Contacto</h3>
            <ul class="space-y-3 text-xs font-bold tracking-wider text-muted">
              <li v-if="shop?.telefono">
                <a :href="`tel:${shop.telefono.replace(/\s+/g, '')}`" class="transition hover:text-gold">{{ shop.telefono }}</a>
              </li>
              <li v-if="shop?.horario_apertura && shop?.horario_cierre" class="text-muted/80">
                {{ shop.horario_apertura }} – {{ shop.horario_cierre }}
              </li>
            </ul>
          </div>
          <div v-if="socials.length">
            <h3 class="mb-5 text-xs font-black uppercase tracking-widest text-ink">Social</h3>
            <div class="flex gap-3">
              <a
                v-for="social in socials" :key="`footer-${social.network}`"
                :href="social.url" target="_blank" rel="noopener noreferrer"
                :aria-label="`UrbanBlade en ${social.network}`"
                class="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-ink/5 text-muted transition-all hover:bg-gold/10 hover:text-gold"
              >
                <LandingSocialIcon :network="social.network" />
              </a>
            </div>
          </div>
        </div>
      </div>

      <div class="mt-8 flex flex-col items-center justify-between gap-2 border-t border-line pt-4 md:flex-row">
        <p class="text-xs font-black uppercase tracking-[0.3em] text-muted">
          &copy; {{ new Date().getFullYear() }} UrbanBlade. Todos los derechos reservados.
        </p>
        <div class="flex gap-6 text-xs font-black uppercase tracking-[0.2em] text-muted">
          <NuxtLink to="/privacidad" class="inline-flex min-h-[44px] items-center transition hover:text-ink">Privacidad</NuxtLink>
          <NuxtLink to="/terminos" class="inline-flex min-h-[44px] items-center transition hover:text-ink">Términos</NuxtLink>
          <button type="button" class="inline-flex min-h-[44px] items-center font-black uppercase tracking-[0.2em] transition hover:text-ink" data-testid="cookie-prefs" @click="reopenConsent()">Cookies</button>
        </div>
      </div>
    </div>
  </footer>
</template>
