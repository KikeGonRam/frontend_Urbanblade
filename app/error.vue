<script setup lang="ts">
import type { NuxtError } from '#app'
const props = defineProps<{ error: NuxtError }>()
const status = computed(() => Number(props.error?.statusCode || 500))
const profile = computed(() => {
  if (status.value === 404) return { eyebrow: 'Ruta perdida', title: 'Este corte quedó', accent: 'fuera del mapa', name: 'Nava', image: 'states/nava-lost.webp', message: 'La página que buscas cambió de lugar o ya no está disponible.' }
  if (status.value === 403) return { eyebrow: 'Área exclusiva', title: 'Acceso', accent: 'reservado', name: 'Bruno', image: 'states/bruno-forbidden.webp', message: 'Tu cuenta no tiene permiso para abrir esta sección.' }
  // Mismo copy que barber's resources/views/errors/maintenance.blade.php
  // (<x-error-page>) -- ver App\Http\Middleware\Api\CheckApiMaintenanceMode.
  if (status.value === 503) return { eyebrow: 'Mantenimiento programado', title: 'Estamos afinando', accent: 'cada detalle', name: 'Bladebot', image: 'states/bladebot-waiting.webp', message: 'UrbanBlade está recibiendo mejoras. Bladebot terminará pronto y podrás continuar con normalidad.' }
  return { eyebrow: 'Error del sistema', title: 'Estamos arreglando', accent: 'el detalle', name: 'Bruno', image: 'states/bruno-error.webp', message: 'Ocurrió un fallo inesperado. Inténtalo nuevamente en unos minutos.' }
})
function goHome() { clearError({ redirect: '/' }) }
</script>
<template>
  <main class="ub-error-page">
    <NuxtLink to="/" class="ub-error-brand"><BrandBrandMark /><span>Urban<strong>Blade</strong></span></NuxtLink>
    <section class="ub-error-shell"><div class="ub-error-copy"><span class="ub-error-eyebrow">{{ profile.eyebrow }}</span><p class="ub-error-code">{{ status }}</p><h1>{{ profile.title }} <span>{{ profile.accent }}</span></h1><p class="ub-error-message">{{ profile.message }} {{ profile.name }} te acompaña.</p><button type="button" class="ub-error-action" @click="goHome">Volver a UrbanBlade</button></div><figure class="ub-error-mascot"><span aria-hidden="true" /><img :src="`/images/mascots/${profile.image}`" :alt="`${profile.name}, mascota de UrbanBlade`"><figcaption>{{ profile.name }} está aquí para ayudarte</figcaption></figure></section>
  </main>
</template>
