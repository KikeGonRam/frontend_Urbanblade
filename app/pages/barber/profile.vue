<script setup lang="ts">
/*
 * Redirección (25-oct-2026): esta página era un duplicado de /profile, que ya cubre todo lo del
 * barbero (especialidades, "sobre mí", foto — POST /barber/profile — y sus números — GET
 * /barber/me) y es a donde ya apunta el avatar del topbar/drawer para cualquier rol. Tener "Mi
 * Perfil" en dos rutas distintas confundía (reporte de usuario, 25-oct). Se deja la ruta con una
 * redirección, no se borra el archivo, para no romper un enlace o marcador guardado.
 */
definePageMeta({ middleware: ['auth', 'barber'], layout: 'dashboard' })

await navigateTo('/profile', { replace: true, redirectCode: 302 })
</script>

<template>
  <div />
</template>
