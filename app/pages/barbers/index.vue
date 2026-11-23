<script setup lang="ts">
/*
 * Redirección (nov-2026): «Nuestros Barberos» con sesión duplicaba /equipo (mismo
 * GET /barbers, público). Se unificó en /equipo, que ya ofrece la ficha, la reseña y
 * el botón de reservar cuando hay sesión. Se deja esta ruta para no romper marcadores.
 */
await navigateTo('/equipo', { replace: true, redirectCode: 301 })
</script>

<template>
  <div />
</template>
