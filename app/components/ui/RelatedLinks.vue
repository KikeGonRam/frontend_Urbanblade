<script setup lang="ts">
/*
 * Accesos a pantallas relacionadas dentro de una página (p. ej. «Lista de espera» o «Mis recibos» desde «Mis
 * citas»). Con el rediseño de navegación (nov-2026) esas pantallas salieron del menú del cliente para dejarlo
 * en cinco entradas; se siguen alcanzando desde la pantalla a la que pertenecen y desde el buscador.
 */
defineProps<{
  links: { label: string; to: string }[]
  /** Nombre accesible del grupo, p. ej. «Más sobre tus citas». */
  label: string
}>()
</script>

<template>
  <nav :aria-label="label">
    <ul class="flex flex-wrap gap-2">
      <li v-for="link in links" :key="link.to">
        <NuxtLink
          :to="link.to"
          class="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-line bg-card px-3.5 text-sm font-semibold text-ink transition-colors hover:border-gold/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
        >
          {{ link.label }}
          <span class="text-gold" aria-hidden="true">→</span>
        </NuxtLink>
      </li>
    </ul>
  </nav>
</template>
