<script setup lang="ts">
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
const { mascots } = useBrandMascots()
const states = [
  { id: 'welcome', mascot: 'bladebot' },
  { id: 'waiting', mascot: 'bladebot' },
  { id: 'success', mascot: 'bladebot' },
  { id: 'empty', mascot: 'nava' },
  { id: 'forbidden', mascot: 'bruno' },
  { id: 'lost', mascot: 'nava' },
  { id: 'error', mascot: 'bruno' },
] as const
</script>
<template>
  <main class="mx-auto max-w-6xl space-y-8 p-4 sm:p-6 lg:p-8">
    <header><p class="text-xs font-black uppercase tracking-[.2em] text-gold">Identidad UrbanBlade</p><h1 class="mt-2 text-3xl font-black text-ink">Una familia con propósito</h1><p class="mt-2 max-w-2xl text-sm leading-6 text-muted">Guía viva para usar el logotipo, las mascotas y sus estados de manera coherente en producto, soporte y comunicación.</p></header>
    <section class="grid gap-5 lg:grid-cols-3"><article v-for="(mascot, id) in mascots" :key="id" class="ui-card overflow-hidden p-5"><BrandMascot :mascot="id" state="welcome" size="md" caption /><p class="mt-4 text-sm leading-6 text-muted">{{ mascot.story }}</p><blockquote class="mt-4 border-l-2 border-gold pl-3 text-sm italic text-ink">“{{ mascot.motto }}”</blockquote></article></section>
    <section class="ui-card p-6"><h2 class="text-xl font-black text-ink">Estados visuales</h2><p class="mt-1 text-sm text-muted">Cada pose comunica un estado; nunca es decoración que bloquee una tarea.</p><div class="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7"><div v-for="state in states" :key="state.id" class="rounded-xl border border-line bg-main p-3 text-center"><BrandMascot :mascot="state.mascot" :state="state.id" size="sm" /><span class="text-[10px] font-bold uppercase tracking-wider text-muted">{{ state.id }}</span></div></div></section>
    <section class="grid gap-5 md:grid-cols-2"><article class="ui-card p-6"><h2 class="font-black text-ink">Uso correcto</h2><ul class="mt-3 space-y-2 text-sm text-muted"><li>• Nava guía exploración, rutas perdidas y estados vacíos.</li><li>• Bladebot acompaña acciones, espera, éxito y Concierge.</li><li>• Bruno explica errores, reportes y conocimiento.</li><li>• Mantener espacio libre alrededor del símbolo UB.</li></ul></article><article class="ui-card p-6"><h2 class="font-black text-ink">Evitar</h2><ul class="mt-3 space-y-2 text-sm text-muted"><li>• No cubrir controles ni información.</li><li>• No usar animación continua si el usuario la reduce.</li><li>• No recolorear directamente los personajes.</li><li>• No mezclar mensajes contradictorios con su estado.</li></ul></article></section>
  </main>
</template>
