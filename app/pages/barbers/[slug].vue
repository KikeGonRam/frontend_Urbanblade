<script setup lang="ts">
/*
 * Redirección (nov-2026): la ficha con sesión duplicaba /equipo/[slug] (mismo
 * GET /barbers/{slug}). /equipo/[slug] ya muestra portafolio, reseñas, el formulario
 * de reseña para el cliente elegible y el botón de reservar. /barbers/manage es una
 * ruta estática y no pasa por aquí.
 */
const route = useRoute()

await navigateTo(
  { path: `/equipo/${String(route.params.slug ?? '')}`, query: route.query },
  { replace: true, redirectCode: 301 },
)
</script>

<template>
  <div />
</template>
