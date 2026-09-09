<script setup lang="ts">
/*
 * Landing pública — puerto de barber/resources/views/welcome.blade.php
 * (ver .claude/skills/landing-page-plan/SKILL.md para el detalle de fases).
 * Diferencia deliberada frente al original: aquí usa los tokens de tema
 * (bg-main/bg-panel/text-gold/...) en vez de hex fijos, así que respeta los
 * 4 temas del selector en vez de quedar siempre en negro.
 *
 * /services y /barbers (CatalogController) son públicas sin token -- se
 * llaman igual que en cualquier otra página, sin auth. No hay todavía una
 * página pública de detalle de servicio/barbero en Nuxt (el catálogo público
 * de Blade -- /servicios, /equipo/{barber} -- sigue vivo ahí para eso), así
 * que todo CTA de "ver más" de esta landing manda a /register en vez de a
 * una ruta que no existe o que exige rol admin (/services aquí es solo
 * admin, /barbers/[slug] exige sesión).
 */
useSeoMeta({
  title: 'UrbanBlade — Elite Grooming Studio',
  description: 'Donde el estilo toma vida. Reserva tu cita premium en UrbanBlade: cortes, barba y grooming de estudio.',
})

interface ServiceRow {
  id: string
  nombre: string
  categoria: string | null
  precio: number
  duracion_min: number
  descripcion: string | null
}
interface BarberRow {
  id: string
  slug: string | null
  user: { id: string, name: string } | null
  especialidades: string
  foto: string | null
}

const { isAuthenticated } = useAuth()
const { apiFetch } = useApi()

const mobileMenuOpen = ref(false)
const scrolled = ref(false)
const navBackground = computed(() => `color-mix(in srgb, var(--bg-main) ${scrolled.value ? 95 : 60}%, transparent)`)

const { data: servicesData, pending: servicesPending } = await useAsyncData<{ data: ServiceRow[] }>(
  'landing-services',
  () => apiFetch('/services'),
  { server: false },
)
const services = computed(() => (servicesData.value?.data ?? []).slice(0, 6))

const { data: barbersData, pending: barbersPending } = await useAsyncData<{ data: BarberRow[] }>(
  'landing-barbers',
  () => apiFetch('/barbers'),
  { server: false },
)
const barbers = computed(() => (barbersData.value?.data ?? []).slice(0, 4))

function initials(name?: string | null) {
  if (!name) return '?'
  return name.trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase() ?? '').join('')
}
function pad2(n: number) {
  return String(n).padStart(2, '0')
}
function currency(n: number) {
  return `$${Math.round(n).toLocaleString('es-MX')}`
}

const steps = [
  { num: '1', title: 'Regístrate', desc: 'Crea tu cuenta gratuita en menos de un minuto. Solo tu nombre y correo.', active: false },
  { num: '2', title: 'Elige tu Cita', desc: 'Selecciona el servicio, tu barbero favorito y el horario que prefieras.', active: true },
  { num: '3', title: '¡Luce Increíble!', desc: 'Llega, relájate y déjate transformar. Sin esperas, sin sorpresas.', active: false },
]

const contactInfo = [
  { label: 'Ubicación', lines: ['Av. de la Reforma 123,', 'Suite 405, CDMX'] },
  { label: 'Contacto', lines: ['+52 55 1234 5678', 'hola@urbanblade.com'] },
  { label: 'Horario', lines: ['Lun – Sáb: 9:00 – 21:00', 'Dom: Cerrado'], mutedLastLine: true },
]
const mapAddress = 'Av. de la Reforma 123, Suite 405, Ciudad de México'

let scrollHandler: (() => void) | undefined
let parallaxHandler: (() => void) | undefined
let revealObserver: IntersectionObserver | undefined
let reducedMotion = false

/*
 * v-reveal en vez de un querySelectorAll('.reveal') único en onMounted:
 * las tarjetas de servicios/barberos se agregan al DOM DESPUÉS de que
 * useAsyncData resuelve (más tarde que onMounted), así que un barrido único
 * las encontraba con opacity:0 para siempre -- el directive's mounted() se
 * dispara para cada elemento en el momento real en que entra al DOM, sin
 * importar si eso pasa en el mount inicial o después de un fetch async.
 *
 * revealObserver se crea aquí, en el scope de setup() -- NO dentro de
 * onMounted() -- porque para los elementos ya presentes en el render
 * inicial (SSR hidratado), Vue dispara el mounted() de un directive de
 * elemento ANTES del onMounted() del propio componente (los directives se
 * encolan durante el patch del árbol; el onMounted del componente se
 * encola después de que ese patch termina). Con revealObserver creado
 * dentro de onMounted, ese primer batch de mounted() de v-reveal corría
 * con revealObserver todavía undefined -- el `?.observe()` no hacía nada y
 * la sección completa quedaba en opacity:0 para siempre. Bug real,
 * invisible en `npm run dev` (donde por timing sí llegaba a tiempo) pero
 * reproducido de forma consistente en un build de producción real
 * (`npm run build` + `node .output/server/index.mjs`) -- exactamente el
 * comportamiento que el dueño del proyecto reportó ver en el deploy real
 * de Vercel (toda la página bajo el hero aparecía en blanco).
 */
if (import.meta.client) {
  reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (!reducedMotion) {
    revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible')
          revealObserver?.unobserve(entry.target)
        }
      })
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' })
  }
}

const vReveal = {
  mounted(el: HTMLElement) {
    if (reducedMotion) el.classList.add('is-visible')
    else revealObserver?.observe(el)
  },
}

onMounted(() => {
  scrollHandler = () => { scrolled.value = window.scrollY > 50 }
  window.addEventListener('scroll', scrollHandler, { passive: true })

  const heroBg = document.querySelector<HTMLElement>('.hero-bg')
  if (heroBg) {
    parallaxHandler = () => { heroBg.style.transform = `translateY(${window.scrollY * 0.22}px)` }
    window.addEventListener('scroll', parallaxHandler, { passive: true })
  }
})

onBeforeUnmount(() => {
  if (scrollHandler) window.removeEventListener('scroll', scrollHandler)
  if (parallaxHandler) window.removeEventListener('scroll', parallaxHandler)
  revealObserver?.disconnect()
})
</script>

<template>
  <div class="min-h-screen bg-main font-sans text-ink">
    <!-- NAVBAR -->
    <nav
      class="sticky top-0 z-50 border-b border-line backdrop-blur-xl transition-all duration-500"
      :style="{ background: navBackground }"
    >
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div class="flex h-20 items-center justify-between">
          <div class="flex items-center gap-3">
            <img src="/images/urbanblade-mark.svg" class="h-10 w-10" alt="UrbanBlade">
            <NuxtLink to="/" class="text-xl font-black uppercase tracking-tighter text-ink">Urban<span class="text-gold">Blade</span></NuxtLink>
          </div>

          <div class="hidden items-center gap-8 text-[10px] font-black uppercase tracking-[0.2em] text-muted md:flex">
            <a href="#inicio" class="transition-colors hover:text-gold">Inicio</a>
            <a href="#servicios" class="transition-colors hover:text-gold">Servicios</a>
            <a href="#como-funciona" class="transition-colors hover:text-gold">Proceso</a>
            <a href="#equipo" class="transition-colors hover:text-gold">Maestros</a>
            <a href="#contacto" class="transition-colors hover:text-gold">Ubicación</a>
            <div class="mx-1 h-4 w-px bg-line" />
            <NuxtLink v-if="isAuthenticated" to="/dashboard" class="ui-btn px-6 py-2">Mi Panel</NuxtLink>
            <template v-else>
              <NuxtLink to="/login" class="transition-colors hover:text-gold">Acceso</NuxtLink>
              <NuxtLink to="/register" class="ui-btn group px-7 py-2.5 text-[11px] tracking-[0.15em] shadow-[0_0_25px_rgba(212,175,55,0.4)]">
                Reservar
                <svg class="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
              </NuxtLink>
            </template>
          </div>

          <button type="button" class="p-2 text-ink md:hidden" aria-label="Abrir menú" @click="mobileMenuOpen = !mobileMenuOpen">
            <svg v-if="!mobileMenuOpen" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M4 6h16M4 12h16M4 18h16" stroke-width="2" stroke-linecap="round" /></svg>
            <svg v-else class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M6 18L18 6M6 6l12 12" stroke-width="2" stroke-linecap="round" /></svg>
          </button>
        </div>
      </div>

      <Transition name="mobile-menu">
        <div v-if="mobileMenuOpen" class="space-y-4 border-b border-line bg-main px-5 pb-6 pt-2 md:hidden">
          <a href="#inicio" class="block py-2 text-[11px] font-black uppercase tracking-widest text-ink" @click="mobileMenuOpen = false">Inicio</a>
          <a href="#servicios" class="block py-2 text-[11px] font-black uppercase tracking-widest text-ink" @click="mobileMenuOpen = false">Servicios</a>
          <a href="#como-funciona" class="block py-2 text-[11px] font-black uppercase tracking-widest text-ink" @click="mobileMenuOpen = false">Proceso</a>
          <a href="#equipo" class="block py-2 text-[11px] font-black uppercase tracking-widest text-ink" @click="mobileMenuOpen = false">Maestros</a>
          <a href="#contacto" class="block py-2 text-[11px] font-black uppercase tracking-widest text-ink" @click="mobileMenuOpen = false">Ubicación</a>
          <div class="flex flex-col gap-3 pt-3">
            <NuxtLink v-if="isAuthenticated" to="/dashboard" class="ui-btn w-full py-3">Mi Panel</NuxtLink>
            <template v-else>
              <NuxtLink to="/login" class="py-2 text-center text-[11px] font-black uppercase tracking-widest text-muted">Acceso</NuxtLink>
              <NuxtLink to="/register" class="ui-btn w-full py-3">Reservar Ahora</NuxtLink>
            </template>
          </div>
        </div>
      </Transition>
    </nav>

    <!-- HERO -->
    <header id="inicio" class="relative flex items-center justify-center overflow-hidden" style="min-height: 92vh;">
      <div class="hero-bg absolute inset-0 z-0 scale-110">
        <div class="hero-photo absolute inset-0" />
      </div>
      <div class="hero-scrim absolute inset-0 z-[1]" />

      <div class="pointer-events-none absolute inset-0 z-[2] overflow-hidden">
        <span class="absolute left-[14%] top-[18%] h-1.5 w-1.5 animate-ping rounded-full bg-gold/40" style="animation-duration:3.2s" />
        <span class="absolute left-[7%] top-[35%] h-1 w-1 animate-ping rounded-full bg-gold/25" style="animation-duration:4.5s;animation-delay:.8s" />
        <span class="absolute right-[10%] top-[50%] h-2 w-2 animate-ping rounded-full bg-gold/20" style="animation-duration:5s;animation-delay:.4s" />
        <span class="absolute left-[28%] top-[64%] h-1 w-1 animate-ping rounded-full bg-gold/30" style="animation-duration:3.8s;animation-delay:2s" />
        <span class="absolute right-[22%] top-[22%] h-1.5 w-1.5 animate-ping rounded-full bg-ink/10" style="animation-duration:6s;animation-delay:1.5s" />
      </div>

      <div class="relative z-10 mx-auto max-w-7xl px-4 text-center">
        <div class="float-badge mb-8 inline-flex">
          <span class="ui-badge px-5 py-2 text-[10px] tracking-[0.25em]">
            <span class="mr-2 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-gold" />
            Reservas Disponibles Hoy
          </span>
        </div>

        <h1 class="font-black uppercase leading-[0.88] tracking-tighter text-ink" style="font-size: clamp(3.5rem, 11vw, 9rem);">
          LA <span class="text-gradient-gold">EXCELENCIA</span>
        </h1>
        <p class="ui-title-serif lowercase opacity-90" style="font-size: clamp(2.5rem, 7vw, 6.5rem);">
          en cada detalle
        </p>

        <p class="mx-auto mt-10 max-w-xl text-lg font-medium leading-relaxed text-muted">
          Elevamos el concepto de barbería a un estudio de arte. Un espacio diseñado para el hombre que exige perfección y confort.
        </p>

        <div class="mt-12 flex flex-col items-center justify-center gap-5 sm:flex-row">
          <NuxtLink :to="isAuthenticated ? '/dashboard' : '/register'" class="ui-btn w-full px-12 py-5 text-[13px] tracking-[0.15em] shadow-[0_0_50px_rgba(212,175,55,0.18)] sm:w-auto">
            Agendar Cita Premium
            <svg class="ml-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
          </NuxtLink>
          <a href="#servicios" class="ui-btn-secondary w-full px-12 py-5 text-[13px] tracking-[0.15em] sm:w-auto">
            Ver Servicios
          </a>
        </div>

        <div class="mt-16 flex flex-col items-center gap-2 opacity-40">
          <span class="text-[9px] font-black uppercase tracking-[0.4em] text-muted">Descubrir</span>
          <div class="scroll-line h-12 w-px bg-gradient-to-b from-gold/60 to-transparent" />
        </div>
      </div>
    </header>

    <!-- STATS -->
    <section class="relative overflow-hidden border-y border-line bg-panel py-16">
      <div class="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/20 to-transparent" />
      <div class="mx-auto max-w-7xl px-4">
        <div class="grid grid-cols-2 gap-8 md:grid-cols-4">
          <div v-reveal class="reveal text-center">
            <p class="text-4xl font-black text-ink">500<span class="text-gold">+</span></p>
            <p class="mt-2 text-[10px] font-black uppercase tracking-widest text-muted">Clientes Satisfechos</p>
          </div>
          <div v-reveal class="reveal text-center" style="transition-delay:100ms">
            <p class="text-4xl font-black text-ink">10<span class="text-gold">+</span></p>
            <p class="mt-2 text-[10px] font-black uppercase tracking-widest text-muted">Años de Experiencia</p>
          </div>
          <div v-reveal class="reveal text-center" style="transition-delay:200ms">
            <p class="text-4xl font-black text-ink">15<span class="text-gold">+</span></p>
            <p class="mt-2 text-[10px] font-black uppercase tracking-widest text-muted">Servicios Premium</p>
          </div>
          <div v-reveal class="reveal text-center" style="transition-delay:300ms">
            <p class="text-4xl font-black text-ink">4.9</p>
            <p class="mt-2 text-[10px] font-black uppercase tracking-widest text-muted">Calificación Promedio</p>
          </div>
        </div>
      </div>
    </section>

    <!-- SERVICIOS -->
    <section id="servicios" class="relative overflow-hidden bg-main py-32">
      <div class="mx-auto max-w-7xl px-4">
        <div class="mb-20 text-center">
          <p class="mb-4 flex items-center justify-center gap-3 text-[10px] font-black uppercase tracking-[0.4em] text-gold">
            <span class="inline-block h-px w-8 bg-gold" />
            Nuestros Servicios
            <span class="inline-block h-px w-8 bg-gold" />
          </p>
          <h2 class="text-4xl font-black uppercase tracking-tight text-ink">Catálogo <span class="text-gold">Signature</span></h2>
          <p class="mx-auto mt-4 max-w-md text-sm leading-relaxed text-muted">Maestría artesanal aplicada a cada uno de nuestros tratamientos exclusivos.</p>
          <div class="line-grow mx-auto mt-6 h-0.5 w-16 rounded-full bg-gradient-to-r from-gold to-gold-dim shadow-[0_0_12px_rgba(212,175,55,0.5)]" />
        </div>

        <ClientOnly>
        <p v-if="servicesPending" class="py-20 text-center italic text-muted">Cargando catálogo premium…</p>
        <p v-else-if="!services.length" class="py-20 text-center italic text-muted">El catálogo estará disponible muy pronto.</p>
        <div v-else class="grid grid-cols-1 gap-6 md:grid-cols-3">
          <article
            v-for="(service, i) in services" :key="service.id"
            v-reveal
            class="ui-card-premium reveal group p-10 hover:border-gold/40"
            :style="{ transitionDelay: `${i * 100}ms` }"
          >
            <div class="mb-8 flex items-start justify-between">
              <div class="flex h-14 w-14 items-center justify-center rounded-2xl border border-gold/10 bg-gold/5 text-gold transition-all duration-500 group-hover:scale-110 group-hover:bg-gold group-hover:text-black">
                <svg class="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7.848 8.25l1.536.887M7.848 8.25a3 3 0 11-5.196-3 3 3 0 015.196 3zm1.536.887a2.165 2.165 0 011.083 1.839c.005.351.054.695.196 1.024M9.384 9.137l2.077 1.199M13.5 15.75l1.83 1.83a3 3 0 006.086-1.803L21 15.75m-6.5-4.5l-3.83-2.212M7.848 15.75l1.536-.887M7.848 15.75a3 3 0 11-5.196 3 3 3 0 015.196-3zm1.536-.887a2.165 2.165 0 001.083-1.839 4.166 4.166 0 01.196-1.024M9.384 14.863l7.632-4.406M18.75 4.5l-2.928 1.69" />
                </svg>
              </div>
              <span class="text-[10px] font-black text-ink/10 transition-colors group-hover:text-gold/20">{{ pad2(i + 1) }}</span>
            </div>
            <h3 class="text-2xl font-black uppercase text-ink">{{ service.nombre }}</h3>
            <p class="mt-4 text-sm font-medium leading-relaxed text-muted">
              {{ service.descripcion || 'Una experiencia diseñada para resaltar tu mejor versión con técnica clásica.' }}
            </p>
            <div class="mt-8 flex items-center justify-between">
              <span class="text-2xl font-black text-ink">{{ currency(service.precio) }}</span>
              <span class="rounded-full border border-gold/10 bg-gold/5 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-gold">{{ service.duracion_min }} min</span>
            </div>
            <div class="mt-6 h-px overflow-hidden rounded-full bg-ink/5">
              <div class="h-full w-0 rounded-full bg-gradient-to-r from-gold/40 to-gold/5 transition-all duration-700 group-hover:w-full" />
            </div>
          </article>
        </div>
        <template #fallback>
          <p class="py-20 text-center italic text-muted">Cargando catálogo premium…</p>
        </template>
        </ClientOnly>

        <div class="mt-12 text-center">
          <NuxtLink to="/register" class="ui-btn-secondary px-10 py-4 text-[11px] tracking-[0.2em]">
            Regístrate para reservar &rarr;
          </NuxtLink>
        </div>
      </div>
    </section>

    <!-- CÓMO FUNCIONA -->
    <section id="como-funciona" class="relative overflow-hidden bg-panel py-32">
      <div class="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/20 to-transparent" />
      <div class="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-gold/10 to-transparent" />

      <div class="mx-auto max-w-7xl px-4">
        <div class="mb-20 text-center">
          <p class="mb-4 flex items-center justify-center gap-3 text-[10px] font-black uppercase tracking-[0.4em] text-gold">
            <span class="inline-block h-px w-8 bg-gold" />
            Proceso
            <span class="inline-block h-px w-8 bg-gold" />
          </p>
          <h2 class="text-4xl font-black uppercase tracking-tight text-ink">¿Cómo <span class="text-gold">Funciona</span>?</h2>
          <p class="mx-auto mt-4 max-w-sm text-sm leading-relaxed text-muted">Tres pasos simples para vivir la experiencia UrbanBlade.</p>
        </div>

        <div class="relative grid grid-cols-1 gap-10 md:grid-cols-3">
          <div class="absolute left-[calc(33.3%+1rem)] right-[calc(33.3%+1rem)] top-8 hidden h-px bg-gradient-to-r from-gold/30 via-gold/50 to-gold/30 md:block" />

          <div v-for="(step, k) in steps" :key="step.num" v-reveal class="reveal group text-center" :style="{ transitionDelay: `${k * 150}ms` }">
            <div
              v-if="step.active"
              class="relative mx-auto mb-8 inline-flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-gold to-gold-dim shadow-[0_0_30px_rgba(212,175,55,0.35)] transition-all duration-500 group-hover:shadow-[0_0_50px_rgba(212,175,55,0.5)]"
            >
              <span class="text-2xl font-black text-black">{{ step.num }}</span>
            </div>
            <div
              v-else
              class="relative mx-auto mb-8 inline-flex h-16 w-16 items-center justify-center rounded-full border-2 border-gold/30 bg-card transition-all duration-500 group-hover:border-gold group-hover:shadow-[0_0_25px_rgba(212,175,55,0.25)]"
            >
              <span class="text-2xl font-black text-gold">{{ step.num }}</span>
              <span class="absolute inset-0 scale-110 rounded-full border border-gold/15 opacity-0 transition-transform duration-500 group-hover:scale-125 group-hover:opacity-100" />
            </div>
            <h3 class="mb-3 text-lg font-black uppercase tracking-tight text-ink">{{ step.title }}</h3>
            <p class="mx-auto max-w-xs text-sm leading-relaxed text-muted">{{ step.desc }}</p>
          </div>
        </div>

        <div class="mt-16 flex justify-center">
          <NuxtLink to="/register" class="ui-btn w-full px-12 py-5 text-[13px] tracking-[0.15em] shadow-[0_0_50px_rgba(212,175,55,0.18)] sm:w-auto">
            Comenzar Ahora
            <svg class="ml-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
          </NuxtLink>
        </div>
      </div>
    </section>

    <!-- EQUIPO -->
    <section id="equipo" class="bg-main py-32">
      <div class="mx-auto max-w-7xl px-4">
        <div class="mb-20 flex flex-col justify-between gap-8 md:flex-row md:items-end">
          <div>
            <p class="mb-3 flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.4em] text-gold">
              <span class="inline-block h-px w-8 bg-gold" />
              Nuestro Equipo
            </p>
            <h2 class="text-4xl font-black uppercase tracking-tight text-ink">Los <span class="text-gold">Maestros</span></h2>
            <p class="mt-2 text-sm text-muted">Arquitectos de la imagen masculina</p>
          </div>
          <NuxtLink to="/register" class="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-gold transition-colors hover:text-ink">
            Únete y conócelos <span>&rarr;</span>
          </NuxtLink>
        </div>

        <ClientOnly>
        <p v-if="barbersPending" class="py-20 text-center text-muted">Cargando maestros…</p>
        <p v-else-if="!barbers.length" class="py-20 text-center text-muted">Nuestros maestros se están preparando...</p>
        <div v-else class="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <NuxtLink
            v-for="(barber, k) in barbers" :key="barber.id"
            v-reveal
            to="/register"
            class="barber-card reveal group relative block"
            :style="{ transitionDelay: `${k * 120}ms` }"
          >
            <div class="relative aspect-[3/4] overflow-hidden rounded-3xl border border-line bg-card">
              <img
                v-if="barber.foto" :src="barber.foto" loading="lazy" :alt="`Foto de ${barber.user?.name}`"
                class="h-full w-full object-cover grayscale transition-all duration-700 group-hover:scale-110 group-hover:grayscale-0"
              >
              <div v-else class="flex h-full w-full items-center justify-center bg-gradient-to-br from-gold/10 via-card to-main">
                <span class="text-4xl font-black uppercase tracking-tighter text-gold/50">{{ initials(barber.user?.name) }}</span>
              </div>
              <div class="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
              <div class="absolute bottom-0 left-0 right-0 translate-y-1 p-6 transition-transform duration-400 group-hover:translate-y-0">
                <h4 class="text-base font-black uppercase text-white">{{ barber.user?.name }}</h4>
                <p class="mt-1 text-[9px] font-bold uppercase tracking-widest text-gold">{{ barber.especialidades || 'Master Groomer' }}</p>
                <div class="mt-3 flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-white/50 transition-colors duration-400 group-hover:text-gold/80">
                  <span>Reservar con {{ barber.user?.name?.split(' ')[0] }}</span>
                  <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                </div>
              </div>
            </div>
          </NuxtLink>
        </div>
        <template #fallback>
          <p class="py-20 text-center text-muted">Cargando maestros…</p>
        </template>
        </ClientOnly>
      </div>
    </section>

    <!-- TESTIMONIALES -->
    <section class="relative overflow-hidden border-y border-line bg-panel py-32">
      <div class="pointer-events-none absolute -top-40 right-0 h-96 w-96 rounded-full bg-gold/4 blur-[120px]" />
      <div class="mx-auto max-w-7xl px-4">
        <div class="grid grid-cols-1 items-center gap-20 lg:grid-cols-2">
          <div v-reveal class="reveal">
            <p class="mb-4 flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.4em] text-gold">
              <span class="inline-block h-px w-8 bg-gold" />
              Testimonios
            </p>
            <h2 class="text-4xl font-black uppercase tracking-tight leading-[1.1] text-ink">Lo que dicen <br>nuestros <span class="text-gradient-gold">Caballeros</span></h2>
            <p class="mt-6 max-w-sm text-sm leading-relaxed text-muted">Nuestra reputación se ha forjado con precisión y satisfacción. Más de 500 clientes confían en UrbanBlade.</p>

            <div class="mt-10 inline-flex items-center gap-5 rounded-2xl border border-line bg-card px-6 py-4">
              <div class="text-center">
                <p class="text-3xl font-black text-ink">4.9</p>
                <div class="mt-1 flex justify-center gap-0.5 text-gold" role="img" aria-label="Calificación 4.9 de 5 estrellas">
                  <svg v-for="n in 5" :key="n" class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                </div>
              </div>
              <div class="h-10 w-px bg-line" />
              <div>
                <p class="text-xs font-bold text-ink">500+ Reseñas</p>
              </div>
            </div>
          </div>

          <div class="space-y-5">
            <div v-reveal class="ui-card-premium reveal border-gold/15 p-8 transition-colors hover:border-gold/30" style="transition-delay:100ms">
              <div class="mb-5 flex gap-0.5">
                <svg v-for="n in 5" :key="n" class="h-3.5 w-3.5 text-gold" viewBox="0 0 20 20" fill="currentColor"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
              </div>
              <p class="font-serif text-base italic leading-relaxed text-ink">"La atención al detalle es increíble. No es solo un corte, es un ritual de relajación. Totalmente recomendado."</p>
              <div class="mt-5 flex items-center gap-3">
                <div class="flex h-8 w-8 items-center justify-center rounded-full border border-gold/20 bg-gradient-to-br from-gold/35 to-gold/10 text-[10px] font-black text-gold">R</div>
                <p class="text-[10px] font-black uppercase tracking-widest text-gold">Ricardo Arjona &nbsp;·&nbsp; Cliente VIP</p>
              </div>
            </div>

            <div v-reveal class="ui-card-premium reveal border-line p-8 transition-colors hover:border-ink/10" style="transition-delay:200ms">
              <div class="mb-5 flex gap-0.5">
                <svg v-for="n in 5" :key="n" class="h-3.5 w-3.5 text-gold" viewBox="0 0 20 20" fill="currentColor"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
              </div>
              <p class="font-serif text-base italic leading-relaxed text-ink">"El sistema de reservas es súper rápido. Llego y mi barbero ya me espera. Eficiencia y lujo en un solo lugar."</p>
              <div class="mt-5 flex items-center gap-3">
                <div class="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-ink/10 text-[10px] font-black text-muted">J</div>
                <p class="text-[10px] font-black uppercase tracking-widest text-muted">Julian Casas &nbsp;·&nbsp; Emprendedor</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- CONTACTO -->
    <section id="contacto" class="relative overflow-hidden bg-main py-32">
      <div class="mx-auto max-w-7xl px-4">
        <div class="mb-16 text-center">
          <p class="mb-4 flex items-center justify-center gap-3 text-[10px] font-black uppercase tracking-[0.4em] text-gold">
            <span class="inline-block h-px w-8 bg-gold" />
            Encuéntranos
            <span class="inline-block h-px w-8 bg-gold" />
          </p>
          <h2 class="text-4xl font-black uppercase tracking-tight text-ink">Visítanos <span class="text-gold">Hoy</span></h2>
        </div>

        <div v-reveal class="reveal overflow-hidden rounded-3xl border border-line shadow-[0_30px_80px_rgba(0,0,0,0.4)]">
          <div class="flex flex-col lg:flex-row">
            <div class="relative overflow-hidden bg-panel p-10 lg:w-[38%] lg:p-14">
              <div class="pointer-events-none absolute -bottom-20 -left-20 h-60 w-60 rounded-full bg-gold/5 blur-[80px]" />
              <h3 class="relative z-10 mb-10 text-lg font-black uppercase tracking-tighter text-ink">Información de Contacto</h3>
              <div class="relative z-10 space-y-7">
                <div v-for="info in contactInfo" :key="info.label" class="flex gap-4">
                  <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-gold/10 bg-gold/8 text-gold">
                    <svg v-if="info.label === 'Ubicación'" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /></svg>
                    <svg v-else-if="info.label === 'Contacto'" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                    <svg v-else class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <div>
                    <p class="mb-1 text-[10px] font-black uppercase tracking-widest text-gold">{{ info.label }}</p>
                    <p class="text-sm font-medium leading-relaxed text-ink">
                      <template v-for="(line, li) in info.lines" :key="line">
                        <span :class="{ 'text-muted': info.mutedLastLine && li === info.lines.length - 1 }">{{ line }}</span><br v-if="li < info.lines.length - 1">
                      </template>
                    </p>
                  </div>
                </div>
              </div>
              <div class="relative z-10 mt-10 border-t border-line pt-8">
                <p class="mb-4 text-[9px] font-black uppercase tracking-widest text-muted">Síguenos</p>
                <div class="flex gap-3">
                  <a href="#" class="flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-ink/5 text-muted transition-all hover:border-gold/20 hover:bg-gold/10 hover:text-gold">
                    <svg class="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" /></svg>
                  </a>
                  <a href="#" class="flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-ink/5 text-muted transition-all hover:border-gold/20 hover:bg-gold/10 hover:text-gold">
                    <svg class="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
                  </a>
                </div>
              </div>
            </div>

            <div class="group relative h-[320px] overflow-hidden bg-panel lg:h-auto lg:flex-1">
              <iframe
                :src="`https://www.google.com/maps?q=${encodeURIComponent(mapAddress)}&output=embed`"
                class="absolute inset-0 h-full w-full border-0 opacity-90 grayscale-[35%] contrast-125 transition-all duration-500 group-hover:opacity-100 group-hover:grayscale-0"
                loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="Ubicación de UrbanBlade en el mapa"
              />
              <a
                :href="`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapAddress)}`"
                target="_blank" rel="noopener noreferrer"
                class="absolute bottom-4 right-4 flex items-center gap-2 rounded-xl border border-gold/20 bg-main/90 px-4 py-2.5 text-[9px] font-black uppercase tracking-widest text-gold backdrop-blur transition-all hover:bg-gold hover:text-black"
              >
                <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                Abrir en Google Maps
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- CTA FINAL -->
    <section class="relative overflow-hidden py-32">
      <div class="absolute inset-0 bg-gradient-to-b from-main via-panel to-main" />
      <div class="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_50%,rgba(212,175,55,0.06),transparent)]" />
      <div class="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/20 to-transparent" />

      <div v-reveal class="reveal relative z-10 mx-auto max-w-3xl px-4 text-center">
        <span class="ui-badge mb-8 inline-flex px-5 py-2">Reservas Abiertas</span>
        <h2 class="mb-6 font-black uppercase leading-none tracking-tighter text-ink" style="font-size: clamp(2.5rem, 7vw, 4.5rem);">
          ¿Listo para tu <br>
          <span class="text-gradient-gold font-serif lowercase italic normal-case" style="font-size: clamp(3rem, 8vw, 5.5rem);">mejor versión?</span>
        </h2>
        <p class="mb-12 text-base leading-relaxed text-muted">Únete a cientos de caballeros que ya confían en UrbanBlade para lucir siempre impecables.</p>
        <NuxtLink :to="isAuthenticated ? '/dashboard' : '/register'" class="ui-btn gold-glow-hover animate-float px-16 py-6 text-[13px] uppercase tracking-[0.25em] shadow-[0_0_60px_rgba(212,175,55,0.18)]">
          Reserva tu Turno Ahora
        </NuxtLink>
      </div>
    </section>

    <!-- FOOTER -->
    <footer class="relative overflow-hidden border-t border-line bg-main py-16">
      <div class="pointer-events-none absolute -bottom-32 -left-32 h-80 w-80 rounded-full bg-gold/4 blur-3xl" />
      <div class="mx-auto max-w-7xl px-4">
        <div class="flex flex-col items-start justify-between gap-12 md:flex-row">
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
              <h5 class="mb-5 text-[10px] font-black uppercase tracking-widest text-ink">Navegación</h5>
              <ul class="space-y-3 text-[11px] font-bold uppercase tracking-wider text-muted">
                <li><a href="#servicios" class="transition hover:text-gold">Servicios</a></li>
                <li><a href="#como-funciona" class="transition hover:text-gold">Proceso</a></li>
                <li><a href="#equipo" class="transition hover:text-gold">Maestros</a></li>
                <li><NuxtLink to="/login" class="transition hover:text-gold">Acceso Staff</NuxtLink></li>
              </ul>
            </div>
            <div>
              <h5 class="mb-5 text-[10px] font-black uppercase tracking-widest text-ink">Contacto</h5>
              <ul class="space-y-3 text-[11px] font-bold tracking-wider text-muted">
                <li>+52 55 1234 5678</li>
                <li>hola@urbanblade.com</li>
                <li class="text-muted/80">Lun – Sáb: 9 – 21h</li>
              </ul>
            </div>
            <div>
              <h5 class="mb-5 text-[10px] font-black uppercase tracking-widest text-ink">Social</h5>
              <div class="flex gap-3">
                <a href="#" class="flex h-8 w-8 items-center justify-center rounded-lg bg-ink/5 text-muted transition-all hover:bg-gold/10 hover:text-gold">
                  <svg class="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" /></svg>
                </a>
                <a href="#" class="flex h-8 w-8 items-center justify-center rounded-lg bg-ink/5 text-muted transition-all hover:bg-gold/10 hover:text-gold">
                  <svg class="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
                </a>
              </div>
            </div>
          </div>
        </div>

        <div class="mt-14 flex flex-col items-center justify-between gap-4 border-t border-line pt-8 md:flex-row">
          <p class="text-[9px] font-black uppercase tracking-[0.3em] text-muted">
            &copy; {{ new Date().getFullYear() }} UrbanBlade. Todos los derechos reservados.
          </p>
          <div class="flex gap-6 text-[9px] font-black uppercase tracking-[0.2em] text-muted">
            <NuxtLink to="/privacidad" class="transition hover:text-ink">Privacidad</NuxtLink>
            <NuxtLink to="/terminos" class="transition hover:text-ink">Términos</NuxtLink>
          </div>
        </div>
      </div>
    </footer>

    <BrandMascotCompanion />
  </div>
</template>

<style scoped>
.hero-bg { will-change: transform; }
.hero-photo {
  background-image: url('https://images.unsplash.com/photo-1503951914875-452162b0f3f1?q=80&w=2070&auto=format&fit=crop');
  background-size: cover;
  background-position: center;
  opacity: 0.48;
}
.hero-scrim {
  background:
    linear-gradient(to bottom, color-mix(in srgb, var(--bg-main) 55%, transparent) 0%, color-mix(in srgb, var(--bg-main) 12%, transparent) 45%, var(--bg-main) 100%),
    linear-gradient(to right, color-mix(in srgb, var(--bg-main) 40%, transparent), transparent, color-mix(in srgb, var(--bg-main) 40%, transparent));
}

.mobile-menu-enter-active, .mobile-menu-leave-active { transition: opacity .2s ease, transform .2s ease; }
.mobile-menu-enter-from, .mobile-menu-leave-to { opacity: 0; transform: translateY(-0.75rem); }
</style>
