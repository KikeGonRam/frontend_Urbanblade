<script setup lang="ts">
/** Barra de navegación de la portada, con el menú desplegable del teléfono. */
const props = defineProps<{ scrolled: boolean }>()
const open = defineModel<boolean>('open', { default: false })

const { isAuthenticated } = useAuth()
const navBackground = computed(() => `color-mix(in srgb, var(--bg-main) ${props.scrolled ? 95 : 60}%, transparent)`)

const links = [
  { href: '#servicios', label: 'Servicios' },
  { href: '#como-funciona', label: 'Proceso' },
  { href: '#equipo', label: 'Maestros' },
  { href: '#app', label: 'App' },
  { href: '#contacto', label: 'Ubicación' },
]
</script>

<template>
  <nav
    class="sticky top-0 z-50 border-b border-line backdrop-blur-xl transition-all duration-500"
    :style="{ background: navBackground }"
  >
    <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div class="flex h-20 items-center justify-between">
        <div class="flex items-center gap-3">
          <img src="/images/urbanblade-mark.svg" class="h-10 w-10" alt="UrbanBlade">
          <NuxtLink to="/" class="inline-flex min-h-[44px] items-center text-xl font-black uppercase tracking-tighter text-ink">Urban<span class="text-gold">Blade</span></NuxtLink>
        </div>

        <div class="hidden items-center gap-5 text-xs font-black uppercase tracking-[0.2em] text-muted lg:flex">
          <a v-for="link in links" :key="link.href" :href="link.href" class="transition-colors hover:text-gold">{{ link.label }}</a>
          <div class="mx-1 h-4 w-px bg-line" />
          <NuxtLink v-if="isAuthenticated" to="/dashboard" class="ui-btn px-6 py-2">Mi Panel</NuxtLink>
          <template v-else>
            <NuxtLink to="/login" class="transition-colors hover:text-gold">Acceso</NuxtLink>
            <NuxtLink to="/reservar" class="ui-btn group px-7 py-2.5 text-xs tracking-[0.15em] shadow-[0_0_25px_rgba(212,175,55,0.4)]">
              Reservar
              <svg class="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
            </NuxtLink>
          </template>
        </div>

        <button type="button" class="flex h-11 w-11 items-center justify-center text-ink lg:hidden" aria-label="Abrir menú" @click="open = !open">
          <svg v-if="!open" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M4 6h16M4 12h16M4 18h16" stroke-width="2" stroke-linecap="round" /></svg>
          <svg v-else class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M6 18L18 6M6 6l12 12" stroke-width="2" stroke-linecap="round" /></svg>
        </button>
      </div>
    </div>

    <Transition name="mobile-menu">
      <div v-if="open" class="space-y-4 border-b border-line bg-main px-5 pb-6 pt-2 lg:hidden">
        <a
          v-for="link in links" :key="link.href" :href="link.href"
          class="block py-2 text-xs font-black uppercase tracking-widest text-ink" @click="open = false"
        >{{ link.label }}</a>
        <div class="flex flex-col gap-3 pt-3">
          <NuxtLink v-if="isAuthenticated" to="/dashboard" class="ui-btn w-full py-3">Mi Panel</NuxtLink>
          <template v-else>
            <NuxtLink to="/login" class="py-2 text-center text-xs font-black uppercase tracking-widest text-ink transition hover:text-gold">Acceso</NuxtLink>
            <NuxtLink to="/reservar" class="ui-btn w-full py-3">Reservar Ahora</NuxtLink>
          </template>
        </div>
      </div>
    </Transition>
  </nav>
</template>

<style scoped>
.mobile-menu-enter-active, .mobile-menu-leave-active { transition: opacity .2s ease, transform .2s ease; }
.mobile-menu-enter-from, .mobile-menu-leave-to { opacity: 0; transform: translateY(-0.75rem); }
</style>
