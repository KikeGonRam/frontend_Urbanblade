<script setup lang="ts">
/*
 * Puente de los enlaces de los correos. Recibe `?ruta=/my/invoices` y decide según el dispositivo:
 *  - Celular Android con pantalla equivalente en la app -> intenta abrir la app (y ofrece el botón, porque
 *    Chrome exige un toque del usuario para lanzar apps); si no está instalada, cae a la web.
 *  - Computadora, iPhone, o una ruta sin equivalente en la app -> redirige directo a la web (302 en el servidor).
 * Solo acepta rutas internas del propio sitio (ver safeWebPath), nunca otro dominio.
 */
definePageMeta({ layout: 'public' })

useSeoMeta({ title: 'Abriendo UrbanBlade', robots: 'noindex' })

const route = useRoute()
const path = safeWebPath(route.query.ruta) ?? '/'
const appRoute = appRouteFor(path)

const headers = useRequestHeaders(['user-agent'])
const userAgent = import.meta.server ? (headers['user-agent'] ?? '') : navigator.userAgent
const openInApp = isAndroid(userAgent) && appRoute !== null

if (!openInApp) {
  await navigateTo(path, { replace: true, redirectCode: 302 })
}

const origin = useRequestURL().origin
const intentUrl = openInApp && appRoute ? buildAndroidIntent(appRoute, origin + path) : ''

onMounted(() => {
  // Intento automático: si el navegador lo permite abre la app; si no, quedan los dos botones.
  if (intentUrl) setTimeout(() => { window.location.href = intentUrl }, 250)
})
</script>

<template>
  <section class="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-6 py-16 text-center">
    <img src="/images/urbanblade-mark.svg" class="mb-6 h-16 w-16" alt="UrbanBlade">
    <p class="mb-2 text-[10px] font-black uppercase tracking-[0.3em] text-gold">Abriendo</p>
    <h1 class="mb-3 text-2xl font-black uppercase tracking-tight text-ink">Urban<span class="text-gold">Blade</span></h1>
    <p class="mb-8 text-sm text-muted">Te llevamos a tu cuenta. Si no se abre la app, continúa en el navegador.</p>

    <template v-if="openInApp">
      <a :href="intentUrl" class="ui-btn mb-3 w-full px-6 py-3.5 text-center">Abrir en la app</a>
      <NuxtLink :to="path" class="w-full rounded-xl border border-line px-6 py-3.5 text-center text-[11px] font-black uppercase tracking-[0.15em] text-muted transition hover:text-gold">
        Continuar en el navegador
      </NuxtLink>
    </template>
  </section>
</template>
