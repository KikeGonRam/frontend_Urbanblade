<script setup lang="ts">
definePageMeta({ middleware: ['auth', 'client'], layout: 'dashboard' })
useSeoMeta({ title: 'Reservar — UrbanBlade', robots: 'noindex' })
</script>

<template>
  <section class="p-4 sm:p-6 lg:p-8">
    <header class="mb-5">
      <p class="text-xs uppercase tracking-widest text-gold">Reserva</p>
      <h1 class="mt-1 text-2xl font-semibold text-ink">Reservar</h1>
      <p class="mt-2 text-sm text-muted">Elige un servicio, barbero y horario real.</p>
    </header>
    <BookingWizard embedded @confirmed="navigateTo('/my/appointments')" />
  </section>
</template>
