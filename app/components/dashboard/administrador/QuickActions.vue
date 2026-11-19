<template>
  <!--
    Antes eran 4 tiles deshabilitados con badge "Próx." estático -- se
    escribieron antes de que /appointments, /clients, /payments y /reports
    existieran y nadie los actualizó al terminarse esas páginas (mismo
    bug que DashboardAnalyticsCta, corregido el mismo día). Ya son enlaces
    reales a las páginas correspondientes.
  -->
  <section class="grid grid-cols-2 gap-3 sm:grid-cols-4">
    <NuxtLink
      v-for="a in [
        { label: 'Nueva Cita', to: '/appointments' },
        { label: 'Nuevo Cliente', to: '/clients' },
        { label: 'Cobrar', to: '/payments' },
        { label: 'Reportes', to: '/reports' },
      ]"
      :key="a.label"
      :to="a.to"
      class="flex items-center gap-3 rounded-[8px] border border-ink/[0.06] bg-card px-4 py-3.5 transition hover:border-gold/30"
    >
      <span class="text-xs font-black uppercase tracking-wide text-ink">{{
        a.label
      }}</span>
      <svg class="ml-auto h-3.5 w-3.5 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
      </svg>
    </NuxtLink>
  </section>
</template>
