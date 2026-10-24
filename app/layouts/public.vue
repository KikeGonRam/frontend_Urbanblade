<script setup lang="ts">
const { reopen: reopenConsent } = useConsent()
/*
 * Chrome ligero para páginas públicas fuera de la landing (catálogo de
 * servicios, equipo de barberos): sin sidebar de dashboard, sin exigir
 * sesión. Calcado del nav/footer de app/pages/index.vue pero sin las
 * secciones ancla (#servicios, #equipo, ...) que solo existen ahí.
 */
const { isAuthenticated } = useAuth()
const { apiFetch } = useApi()
const menuOpen = ref(false)
const route = useRoute()
watch(() => route.fullPath, () => { menuOpen.value = false })

// Mismos datos y misma llave que la landing: se piden una sola vez.
interface Barbershop {
  direccion: string | null
  telefono: string | null
  horario_apertura: string | null
  horario_cierre: string | null
  redes_sociales: Record<string, string | null> | null
}
const { data: shopData } = await useAsyncData<{ data: Barbershop }>('landing-barbershop', () => apiFetch('/barbershop'), { server: false })
const shop = computed(() => shopData.value?.data ?? null)
const SOCIAL_BASE: Record<string, string> = { instagram: 'https://instagram.com/', facebook: 'https://facebook.com/', tiktok: 'https://tiktok.com/@' }
const socials = computed(() =>
  Object.entries(shop.value?.redes_sociales ?? {})
    .filter((e): e is [string, string] => Boolean(e[1]) && e[0] in SOCIAL_BASE)
    .map(([network, handle]) => ({
      network,
      url: handle.startsWith('http') ? handle : `${SOCIAL_BASE[network]}${handle.replace(/^@/, '')}`,
    })),
)
</script>

<template>
  <div class="flex min-h-screen flex-col bg-main font-sans text-ink">
    <nav class="sticky top-0 z-50 border-b border-line bg-main/95 backdrop-blur-xl">
      <div class="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <NuxtLink to="/" class="flex items-center gap-3">
          <img src="/images/urbanblade-mark.svg" class="h-9 w-9" alt="UrbanBlade">
          <span class="text-lg font-black uppercase tracking-tighter text-ink">Urban<span class="text-gold">Blade</span></span>
        </NuxtLink>

        <div class="flex items-center gap-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted sm:gap-6">
          <NuxtLink to="/servicios" class="hidden transition-colors hover:text-gold sm:inline">Servicios</NuxtLink>
          <NuxtLink to="/equipo" class="hidden transition-colors hover:text-gold sm:inline">Equipo</NuxtLink>
          <NuxtLink to="/#app" class="hidden transition-colors hover:text-gold sm:inline">App</NuxtLink>
          <NuxtLink v-if="isAuthenticated" to="/dashboard" class="ui-btn px-4 py-2 sm:px-6">Mi Panel</NuxtLink>
          <template v-else>
            <NuxtLink to="/login" class="hidden transition-colors hover:text-gold sm:inline">Acceso</NuxtLink>
            <NuxtLink to="/reservar" class="ui-btn px-4 py-2.5 text-[11px] tracking-[0.15em] sm:px-6">Reservar</NuxtLink>
          </template>
          <button type="button" class="flex h-11 w-11 items-center justify-center text-ink sm:hidden" :aria-label="menuOpen ? 'Cerrar menú' : 'Abrir menú'" :aria-expanded="menuOpen" @click="menuOpen = !menuOpen">
            <svg v-if="!menuOpen" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M4 6h16M4 12h16M4 18h16" stroke-width="2" stroke-linecap="round" /></svg>
            <svg v-else class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M6 18L18 6M6 6l12 12" stroke-width="2" stroke-linecap="round" /></svg>
          </button>
        </div>
      </div>
      <div v-if="menuOpen" class="border-t border-line bg-main px-4 pb-4 pt-2 sm:hidden">
        <NuxtLink v-for="l in [{ to: '/servicios', t: 'Servicios' }, { to: '/equipo', t: 'Equipo' }, { to: '/#app', t: 'App móvil' }, ...(isAuthenticated ? [] : [{ to: '/login', t: 'Acceso' }])]" :key="l.to" :to="l.to" class="flex min-h-[44px] items-center text-[11px] font-black uppercase tracking-widest text-ink">{{ l.t }}</NuxtLink>
      </div>
    </nav>

    <main class="flex-1">
      <slot />
    </main>

    <footer class="border-t border-line py-10">
      <div v-if="shop?.direccion || shop?.telefono || socials.length" class="mx-auto mb-6 flex max-w-7xl flex-col items-center justify-between gap-3 border-b border-line px-4 pb-6 text-xs text-muted sm:flex-row sm:px-6 lg:px-8">
        <p class="text-center sm:text-left">
          <span v-if="shop?.direccion">{{ shop.direccion }}</span>
          <span v-if="shop?.direccion && shop?.telefono"> · </span>
          <a v-if="shop?.telefono" :href="`tel:${shop.telefono.replace(/\s+/g, '')}`" class="font-bold text-ink hover:text-gold">{{ shop.telefono }}</a>
        </p>
        <div class="flex gap-1">
          <a v-for="social in socials" :key="social.network" :href="social.url" target="_blank" rel="noopener noreferrer" class="inline-flex min-h-[44px] items-center px-3 text-[10px] font-black uppercase tracking-widest hover:text-gold">{{ social.network }}</a>
        </div>
      </div>
      <div class="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 text-[9px] font-black uppercase tracking-[0.2em] text-muted sm:flex-row sm:px-6 lg:px-8">
        <p>&copy; {{ new Date().getFullYear() }} UrbanBlade. Todos los derechos reservados.</p>
        <div class="flex gap-6">
          <NuxtLink to="/privacidad" class="transition hover:text-gold">Aviso de Privacidad</NuxtLink>
          <NuxtLink to="/terminos" class="transition hover:text-gold">Términos y Condiciones</NuxtLink>
          <button type="button" class="font-black uppercase tracking-[0.2em] transition hover:text-gold" data-testid="cookie-prefs" @click="reopenConsent()">Preferencias de cookies</button>
        </div>
      </div>
    </footer>
  </div>
</template>
