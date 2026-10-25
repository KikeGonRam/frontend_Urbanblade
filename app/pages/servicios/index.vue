<script setup lang="ts">
/*
 * Catálogo público de servicios -- puerto de barber's /servicios
 * (Client\ServiceController::publicIndex(), Blade). Consume el mismo
 * endpoint público que ya usa la landing (CatalogController::services()),
 * sin necesidad de cambios de backend. Sin middleware: cualquier visitante,
 * con o sin sesión, puede verlo.
 */
definePageMeta({ layout: 'public' })

useSeoMeta({
  title: 'Servicios — UrbanBlade',
  description: 'Catálogo de cortes, barba y grooming de estudio en UrbanBlade.',
})

interface ServiceRow {
  id: string
  nombre: string
  categoria: string | null
  precio: number
  duracion_min: number
  descripcion: string | null
  imagen: string | null
}

const { isAuthenticated } = useAuth()
const { apiFetch } = useApi()

const { data: response, pending, error, refresh } = await useAsyncData(
  'public-services-catalog',
  () => apiFetch<{ data: ServiceRow[] }>('/services'),
)
const services = computed(() => response.value?.data ?? [])
</script>

<template>
  <div class="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
    <header class="mb-12 text-center">
      <p class="mb-4 flex items-center justify-center gap-3 text-[10px] font-black uppercase tracking-[0.4em] text-gold">
        <span class="inline-block h-px w-8 bg-gold" />
        Catálogo
        <span class="inline-block h-px w-8 bg-gold" />
      </p>
      <h1 class="text-4xl font-black uppercase tracking-tight text-ink">Elige tu <span class="text-gold">estilo</span></h1>
      <p class="mx-auto mt-4 max-w-md text-sm leading-relaxed text-muted">Pasa el cursor o toca un servicio para verlo en grande y reservarlo en un paso.</p>
    </header>

    <BrandStatePanel v-if="pending" mascot="bladebot" state="waiting" title="Cargando catálogo…" />
    <BrandStatePanel
      v-else-if="error"
      mascot="bruno"
      state="error"
      tone="danger"
      title="No se pudo cargar el catálogo"
      description="Inténtalo nuevamente en unos minutos."
      action-label="Reintentar"
      @action="refresh"
    />
    <BrandStatePanel v-else-if="!services.length" mascot="nava" state="empty" title="No hay servicios disponibles" description="Vuelve pronto para conocer nuestros próximos servicios." />

    <LandingStyleLookbook v-else :services="services" />

    <div class="mt-16 text-center">
      <NuxtLink :to="isAuthenticated ? '/my/appointments' : '/register'" class="ui-btn px-10 py-4 text-[11px] tracking-[0.2em]">
        {{ isAuthenticated ? 'Reservar cita' : 'Regístrate para reservar' }} &rarr;
      </NuxtLink>
    </div>
  </div>
</template>
