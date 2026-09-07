<script setup lang="ts">
</script>

<template>
  <div class="min-h-screen bg-main font-sans text-ink">
    <nav class="sticky top-0 z-50 border-b border-line bg-main/95 backdrop-blur-xl">
      <div class="mx-auto flex h-20 max-w-4xl items-center justify-between px-4 sm:px-6">
        <NuxtLink to="/" class="flex items-center gap-3">
          <img src="/images/urbanblade-mark.svg" class="h-9 w-9" alt="UrbanBlade">
          <span class="text-lg font-black uppercase tracking-tighter text-ink">Urban<span class="text-gold">Blade</span></span>
        </NuxtLink>
        <NuxtLink to="/" class="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted transition-colors hover:text-gold">
          <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M11 17l-5-5m0 0l5-5m-5 5h12" /></svg>
          Volver al inicio
        </NuxtLink>
      </div>
    </nav>

    <main class="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <slot />
    </main>

    <footer class="border-t border-line py-10">
      <div class="mx-auto flex max-w-3xl flex-col items-center justify-between gap-4 px-4 text-[9px] font-black uppercase tracking-[0.2em] text-muted sm:flex-row sm:px-6">
        <p>&copy; {{ new Date().getFullYear() }} UrbanBlade. Todos los derechos reservados.</p>
        <div class="flex gap-6">
          <NuxtLink to="/privacidad" class="transition hover:text-gold">Aviso de Privacidad</NuxtLink>
          <NuxtLink to="/terminos" class="transition hover:text-gold">Términos y Condiciones</NuxtLink>
        </div>
      </div>
    </footer>
  </div>
</template>
