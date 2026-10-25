<script setup lang="ts">
// Dirección canónica de cada página (sin parámetros de consulta ni ancla): evita que Google indexe
// variantes duplicadas de la misma ruta. Las páginas privadas ya llevan robots: noindex.
const currentRoute = useRoute()
const config = useRuntimeConfig()
useHead(() => ({
  link: [{ rel: 'canonical', href: `${String(config.public.siteUrl).replace(/\/$/, '')}${currentRoute.path}` }],
}))
</script>

<template>
  <div>
    <NuxtLoadingIndicator :height="2.5" :throttle="150" :duration="2500" color="#d4af37" />
    <NuxtRouteAnnouncer />
    <NuxtLayout>
      <NuxtPage>
        <template #default="{ Component, route }">
          <!-- La key ignora el #ancla: si no, un salto a #servicios remontaba la página entera y la dejaba en negro. -->
          <Transition name="ub-page" mode="out-in" appear :duration="{ enter: 140, leave: 90 }">
            <component :is="Component" :key="route.fullPath.split('#')[0]" />
          </Transition>
        </template>
      </NuxtPage>
    </NuxtLayout>
    <UiConfirmModal />
    <UiCookieBanner />
  </div>
</template>

<style>
.ub-page-enter-active,
.ub-page-leave-active {
  transition: opacity 160ms ease, transform 160ms ease;
}
.ub-page-enter-from {
  opacity: 0;
  transform: translateY(4px);
}
.ub-page-leave-to {
  opacity: 0;
  transform: translateY(-3px);
}
</style>
