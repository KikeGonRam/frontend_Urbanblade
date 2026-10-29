<script setup lang="ts">
const { bannerOpen, accept, reject } = useConsent()
</script>

<template>
  <div
    v-if="bannerOpen"
    role="dialog"
    aria-labelledby="cookie-banner-title"
    aria-describedby="cookie-banner-text"
    class="fixed inset-x-3 bottom-3 z-[60] mx-auto max-w-3xl rounded-2xl border border-line bg-main/95 p-4 shadow-2xl backdrop-blur-xl sm:bottom-5 sm:p-5"
    data-testid="cookie-banner"
  >
    <p id="cookie-banner-title" class="mb-1 text-xs font-black uppercase tracking-[0.25em] text-gold">Cookies</p>
    <p id="cookie-banner-text" class="text-sm leading-relaxed text-muted">
      Usamos cookies necesarias para que el sitio funcione. Con tu permiso también usamos cookies de analítica
      (Google Tag Manager y Microsoft Clarity) para saber cómo se usa el sitio. Puedes cambiar tu elección cuando
      quieras desde «Preferencias de cookies». Más información en el
      <NuxtLink to="/privacidad#cookies" class="font-bold text-ink underline hover:text-gold">Aviso de Privacidad</NuxtLink>.
    </p>
    <div class="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
      <button
        type="button"
        class="min-h-[44px] rounded-xl border border-line px-5 text-xs font-black uppercase tracking-widest text-ink transition hover:border-gold hover:text-gold"
        data-testid="cookie-reject"
        @click="reject()"
      >
        Rechazar
      </button>
      <button
        type="button"
        class="min-h-[44px] rounded-xl border border-line px-5 text-xs font-black uppercase tracking-widest text-ink transition hover:border-gold hover:text-gold"
        data-testid="cookie-accept"
        @click="accept()"
      >
        Aceptar
      </button>
    </div>
  </div>
</template>
