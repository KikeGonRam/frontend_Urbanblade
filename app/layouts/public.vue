<script setup lang="ts">
/*
 * Chrome ligero para páginas públicas fuera de la landing (catálogo de
 * servicios, equipo de barberos): sin sidebar de dashboard, sin exigir
 * sesión. Calcado del nav/footer de app/pages/index.vue pero sin las
 * secciones ancla (#servicios, #equipo, ...) que solo existen ahí.
 */
const { isAuthenticated } = useAuth()
</script>

<template>
  <div class="flex min-h-screen flex-col bg-main font-sans text-ink">
    <nav class="sticky top-0 z-50 border-b border-line bg-main/95 backdrop-blur-xl">
      <div class="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <NuxtLink to="/" class="flex items-center gap-3">
          <img src="/images/urbanblade-mark.svg" class="h-9 w-9" alt="UrbanBlade">
          <span class="text-lg font-black uppercase tracking-tighter text-ink">Urban<span class="text-gold">Blade</span></span>
        </NuxtLink>

        <div class="flex items-center gap-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted">
          <NuxtLink to="/servicios" class="hidden transition-colors hover:text-gold sm:inline">Servicios</NuxtLink>
          <NuxtLink to="/equipo" class="hidden transition-colors hover:text-gold sm:inline">Equipo</NuxtLink>
          <NuxtLink v-if="isAuthenticated" to="/dashboard" class="ui-btn px-6 py-2">Mi Panel</NuxtLink>
          <template v-else>
            <NuxtLink to="/login" class="transition-colors hover:text-gold">Acceso</NuxtLink>
            <NuxtLink to="/register" class="ui-btn px-6 py-2.5 text-[11px] tracking-[0.15em]">Reservar</NuxtLink>
          </template>
        </div>
      </div>
    </nav>

    <main class="flex-1">
      <slot />
    </main>

    <footer class="border-t border-line py-10">
      <div class="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 text-[9px] font-black uppercase tracking-[0.2em] text-muted sm:flex-row sm:px-6 lg:px-8">
        <p>&copy; {{ new Date().getFullYear() }} UrbanBlade. Todos los derechos reservados.</p>
        <div class="flex gap-6">
          <NuxtLink to="/privacidad" class="transition hover:text-gold">Aviso de Privacidad</NuxtLink>
          <NuxtLink to="/terminos" class="transition hover:text-gold">Términos y Condiciones</NuxtLink>
        </div>
      </div>
    </footer>
  </div>
</template>
