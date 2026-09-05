<script setup lang="ts">
withDefaults(defineProps<{ titulo?: string, descripcion?: string, cta?: string }>(), {
  titulo: 'Analítica avanzada',
  descripcion: 'Patrones, predicciones y recomendaciones calculadas sobre tu historial.',
  cta: 'Ver analítica',
})

/*
 * /analytics todavía no existe en este repo (fase 9 del plan) — se muestra
 * como tarjeta informativa deshabilitada en vez de un <NuxtLink> a un 404,
 * mismo criterio que los ítems "Próx." del sidebar.
 */
</script>

<template>
  <div class="grid cursor-not-allowed gap-4 rounded-[8px] border border-ink/[0.08] bg-card p-4 opacity-60 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
    <div class="flex h-11 w-11 items-center justify-center rounded-[8px] border border-gold/20 bg-gold/10 text-gold">
      <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.9" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" d="M3 3v18h18" />
        <path stroke-linecap="round" stroke-linejoin="round" d="m18.7 8.3-4.2 4.2-2.8-2.8L7 14.4" />
      </svg>
    </div>

    <div class="min-w-0">
      <p class="text-[9px] font-black uppercase tracking-[0.22em] text-gold/70">UrbanBlade Analytics</p>
      <h3 class="mt-1 text-sm font-black uppercase tracking-tight text-ink">{{ titulo }}</h3>
      <p class="mt-1 max-w-2xl text-[12px] leading-relaxed text-ink/48">{{ descripcion }}</p>
    </div>

    <span class="inline-flex h-10 items-center justify-center gap-2 rounded-[8px] border border-line px-4 text-[10px] font-black uppercase tracking-widest text-muted">
      Próximamente
    </span>
  </div>
</template>
