<script setup lang="ts">
/** Héroe de la portada: foto de fondo con paralaje, titular, botones de reserva y cifras públicas. */
import type { LandingStat } from '~/types/landing'

defineProps<{ stats: LandingStat[] }>()

const { isAuthenticated } = useAuth()
const hero = ref<HTMLElement | null>(null)
const heroBg = ref<HTMLElement | null>(null)
useHeroEffects(hero, heroBg)
</script>

<template>
  <header id="inicio" ref="hero" class="relative flex items-center justify-center overflow-hidden" style="min-height: 80vh;">
    <div ref="heroBg" class="hero-bg absolute inset-0 z-0 scale-110">
      <div class="hero-photo absolute inset-0" />
    </div>
    <div class="hero-scrim absolute inset-0 z-[1]" />
    <div class="hero-spot pointer-events-none absolute inset-0 z-[1]" aria-hidden="true" />

    <div class="relative z-10 mx-auto max-w-7xl px-4 text-center">
      <h1 class="font-black uppercase leading-[0.88] tracking-tighter text-ink" style="font-size: clamp(3.5rem, 11vw, 9rem);">
        <span class="hero-word mr-[0.22em]" style="--i:0">LA</span>
        <span class="hero-word text-gradient-gold" style="--i:1">EXCELENCIA</span>
      </h1>
      <p class="ui-title-serif hero-word lowercase opacity-90" style="--i:3; font-size: clamp(2.5rem, 7vw, 6.5rem);">
        en cada detalle
      </p>

      <p class="mx-auto mt-6 max-w-xl text-lg font-medium leading-relaxed text-muted">
        Elevamos el concepto de barbería a un estudio de arte. Un espacio diseñado para el hombre que exige perfección y confort.
      </p>

      <div class="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
        <NuxtLink :to="isAuthenticated ? '/dashboard' : '/reservar'" class="ui-btn w-full px-12 py-5 text-[13px] tracking-[0.15em] shadow-[0_0_50px_rgba(212,175,55,0.18)] sm:w-auto">
          {{ isAuthenticated ? 'Ir a mi panel' : 'Reservar mi cita' }}
          <svg class="ml-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
        </NuxtLink>
        <a href="#servicios" class="ui-btn-secondary w-full px-12 py-5 text-[13px] tracking-[0.15em] sm:w-auto">
          Ver Servicios
        </a>
      </div>

      <ul v-if="stats.length" class="mt-8 flex flex-wrap items-center justify-center gap-2.5">
        <li v-for="stat in stats" :key="stat.label" class="rounded-full border border-line bg-main/50 px-4 py-2 text-xs font-bold text-muted backdrop-blur">
          <span class="font-black text-ink">{{ stat.value }}{{ stat.suffix }}</span> {{ stat.label }}
        </li>
      </ul>
    </div>
  </header>
</template>

<style scoped>
.hero-bg { will-change: transform; }
.hero-photo {
  background-image: url('https://images.unsplash.com/photo-1503951914875-452162b0f3f1?q=75&w=1920&auto=format&fit=max');
  background-size: cover;
  background-position: center;
  opacity: 0.48;
}
/* Misma URL que la precarga móvil de useLandingSeo: el navegador reutiliza la descarga. */
@media (max-width: 767px) {
  .hero-photo {
    background-image: url('https://images.unsplash.com/photo-1503951914875-452162b0f3f1?q=70&w=900&auto=format&fit=max');
  }
}
.hero-scrim {
  background:
    linear-gradient(to bottom, color-mix(in srgb, var(--bg-main) 55%, transparent) 0%, color-mix(in srgb, var(--bg-main) 12%, transparent) 45%, var(--bg-main) 100%),
    linear-gradient(to right, color-mix(in srgb, var(--bg-main) 40%, transparent), transparent, color-mix(in srgb, var(--bg-main) 40%, transparent));
}

.hero-word { display: inline-block; opacity: 0; transform: translateY(0.4em); animation: hero-rise .8s cubic-bezier(.2,.8,.2,1) forwards; animation-delay: calc(var(--i, 0) * 110ms + 120ms); }
@keyframes hero-rise { to { opacity: 1; transform: none; } }
.hero-spot {
  background: radial-gradient(520px circle at var(--mx, 50%) var(--my, 40%), rgb(var(--gold-rgb) / 0.16), transparent 60%);
  transition: background .15s linear;
}
@media (prefers-reduced-motion: reduce) {
  .hero-word { opacity: 1; transform: none; animation: none; }
}
</style>
