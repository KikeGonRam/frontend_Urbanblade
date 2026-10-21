<script setup lang="ts">
/*
 * Sección que promociona la app móvil. La app está en prueba cerrada de Google
 * Play, así que NO hay botón de descarga: la insignia dice "Próximamente".
 * Cuando se publique en producción, cambiar `available` y poner el enlace real.
 */
const available = false
const storeUrl = ''

const shots = [
  { src: '/images/app/inicio.png', alt: 'Pantalla de inicio de la app con la próxima visita confirmada', label: 'Tu próxima visita' },
  { src: '/images/app/reservar.png', alt: 'Pantalla para reservar una cita en la app', label: 'Reserva en segundos' },
  { src: '/images/app/mis-citas.png', alt: 'Pantalla Mis citas con opción de reagendar o cancelar', label: 'Reagenda o cancela' },
]
const features = [
  'Reserva con tu maestro favorito y un horario realmente disponible',
  'Recordatorios y avisos de tu cita en el teléfono',
  'Reagenda o cancela sin llamar',
  'Tu nivel de cliente y beneficios siempre a la mano',
]

const active = ref(0)
let timer: ReturnType<typeof setInterval> | undefined

function start() {
  stop()
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  timer = setInterval(() => { active.value = (active.value + 1) % shots.length }, 3800)
}
function stop() {
  if (timer) clearInterval(timer)
  timer = undefined
}
function select(i: number) {
  active.value = i
  start()
}

onMounted(start)
onBeforeUnmount(stop)
</script>

<template>
  <section id="app" class="relative overflow-hidden border-y border-line bg-panel py-28">
    <div class="pointer-events-none absolute -left-32 top-10 h-96 w-96 rounded-full bg-gold/5 blur-[120px]" />
    <div class="mx-auto grid max-w-6xl items-center gap-16 px-4 lg:grid-cols-2">
      <div class="order-2 lg:order-1">
        <p class="mb-4 flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.4em] text-gold">
          <span class="inline-block h-px w-8 bg-gold" />
          App móvil
        </p>
        <h2 class="text-4xl font-black uppercase leading-[1.05] tracking-tight text-ink">
          UrbanBlade <span class="text-gradient-gold">en tu bolsillo</span>
        </h2>
        <p class="mt-5 max-w-md text-sm leading-relaxed text-muted">
          La misma experiencia de la web, hecha para tu teléfono Android. Tu cita, tu barbero y tus beneficios, a un toque.
        </p>

        <ul class="mt-8 space-y-4">
          <li v-for="f in features" :key="f" class="flex items-start gap-3 text-sm font-medium text-ink">
            <span class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gold/15 text-gold" aria-hidden="true">
              <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" /></svg>
            </span>
            {{ f }}
          </li>
        </ul>

        <div class="mt-10 flex flex-wrap items-center gap-4">
          <a
            v-if="available && storeUrl" :href="storeUrl" target="_blank" rel="noopener noreferrer"
            class="ui-btn px-8 py-4 text-[12px] tracking-[0.15em]"
          >Descargar en Google Play</a>
          <div v-else class="inline-flex items-center gap-3 rounded-2xl border border-gold/30 bg-card px-5 py-3">
            <svg class="h-6 w-6 text-gold" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3.6 2.3a1.5 1.5 0 0 0-.6 1.2v17a1.5 1.5 0 0 0 .6 1.2L13.3 12 3.6 2.3zm10.4 10.4 2.7 2.7-11.4 6.5 8.7-9.2zm0-1.4L5.3 2.1l11.4 6.5L14 11.3zm3.8 2.2L20.4 12a1.2 1.2 0 0 0 0-2l-2.6-1.5-3 3 3 3z" /></svg>
            <span class="text-left leading-tight">
              <span class="block text-[9px] font-black uppercase tracking-[0.25em] text-muted">Próximamente en</span>
              <span class="block text-sm font-black text-ink">Google Play</span>
            </span>
          </div>
          <span class="text-[11px] font-bold uppercase tracking-widest text-muted">Disponible solo en Android</span>
        </div>
      </div>

      <div class="order-1 flex flex-col items-center lg:order-2" @mouseenter="stop" @mouseleave="start">
        <div class="phone relative w-[240px] sm:w-[270px]">
          <div class="absolute left-1/2 top-3 z-10 h-5 w-20 -translate-x-1/2 rounded-full bg-black" aria-hidden="true" />
          <div class="relative aspect-[1080/2160] overflow-hidden rounded-[2.4rem] bg-black">
            <img
              v-for="(s, i) in shots" :key="s.src"
              :src="s.src" :alt="s.alt" loading="lazy" decoding="async"
              class="shot absolute inset-0 h-full w-full object-cover"
              :class="{ 'is-active': i === active }"
            >
          </div>
        </div>
        <p class="mt-6 text-[11px] font-black uppercase tracking-[0.25em] text-gold">{{ shots[active]?.label }}</p>
        <div class="mt-3 flex gap-2" role="tablist" aria-label="Pantallas de la app">
          <button
            v-for="(s, i) in shots" :key="s.label" type="button" role="tab" :aria-selected="i === active" :aria-label="s.label"
            class="flex h-6 w-6 items-center justify-center" @click="select(i)"
          >
            <span class="block h-2 rounded-full transition-all" :class="i === active ? 'w-6 bg-gold' : 'w-2 bg-line'" />
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.phone {
  border-radius: 2.9rem;
  border: 1px solid rgb(var(--gold-rgb) / 0.35);
  background: #0b0b0b;
  padding: 0.55rem;
  box-shadow: 0 40px 90px rgba(0, 0, 0, 0.55), 0 0 60px rgb(var(--gold-rgb) / 0.12);
}
.shot { opacity: 0; transform: scale(1.03); transition: opacity .6s ease, transform .6s ease; }
.shot.is-active { opacity: 1; transform: none; }
@media (prefers-reduced-motion: reduce) {
  .shot { transition: none; }
}
</style>
