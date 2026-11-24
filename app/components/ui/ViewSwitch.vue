<script setup lang="ts">
/*
 * Selector de vista entre pantallas hermanas («Lista | Calendario» de la agenda). Son enlaces, no pestañas:
 * cada vista es su propia ruta, así que «atrás» del navegador y los marcadores siguen funcionando. Sustituye
 * a tener «Citas» y «Calendario» como dos entradas separadas del menú (rediseño de navegación, nov-2026).
 */
const props = defineProps<{
  options: { label: string; to: string }[]
  /** Nombre accesible del grupo, p. ej. «Vista de la agenda». */
  label: string
}>()

const route = useRoute()
const current = computed(() => props.options.find((o) => o.to === route.path)?.to ?? null)
</script>

<template>
  <nav :aria-label="label" class="inline-flex rounded-xl border border-line bg-card p-1">
    <NuxtLink
      v-for="option in options"
      :key="option.to"
      :to="option.to"
      class="inline-flex min-h-10 items-center rounded-lg px-4 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
      :class="current === option.to ? 'bg-gold text-black' : 'text-muted hover:text-ink'"
      :aria-current="current === option.to ? 'page' : undefined"
    >
      {{ option.label }}
    </NuxtLink>
  </nav>
</template>
