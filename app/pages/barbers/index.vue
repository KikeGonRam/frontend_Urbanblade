<script setup lang="ts">
/*
 * Fase 9.8 — "Nuestros Barberos", puerto del catálogo público de barberos
 * (Client\ClientBarberController::index() web) contra CatalogController::barbers()
 * (ya existía, sin cambios de backend necesarios). Visible para cualquier rol
 * autenticado; el envío de reseñas en el detalle sí se restringe a clientes.
 */
definePageMeta({ middleware: ['auth'], layout: 'dashboard' })

interface BarberRow {
  id: string
  slug: string | null
  user: { id: string, name: string } | null
  especialidades: string
  descripcion: string
  foto: string | null
  avg_rating: number | null
  total_reviews: number
}

const { apiFetch } = useApi()

const { data: response, pending, error } = await useAsyncData(
  'barbers-catalog',
  () => apiFetch<{ data: BarberRow[] }>('/barbers'),
  { lazy: true },
)
const barbers = computed(() => response.value?.data ?? [])
</script>

<template>
  <div class="p-4 sm:p-6 lg:p-8">
    <header class="mb-6">
      <p class="text-sm uppercase tracking-widest text-muted">UrbanBlade</p>
      <h1 class="mt-1 text-2xl font-semibold text-ink">Nuestros <span class="text-gold">Barberos</span></h1>
      <p class="mt-1 text-sm text-muted">Conoce al equipo y revisa su trabajo antes de reservar.</p>
    </header>

    <BrandStatePanel v-if="pending" mascot="bladebot" state="waiting" title="Cargando barberos…" />
    <BrandStatePanel v-else-if="error" mascot="bruno" state="error" tone="danger" title="No se pudo cargar el catálogo" description="Inténtalo nuevamente en unos minutos." />
    <BrandStatePanel v-else-if="!barbers.length" mascot="nava" state="empty" title="Aún no hay barberos activos" description="El equipo aparecerá aquí cuando esté disponible." />

    <div v-else class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      <NuxtLink
        v-for="barber in barbers" :key="barber.id" :to="`/barbers/${barber.slug}`"
        class="ui-card block overflow-hidden p-5 transition hover:border-gold/40"
      >
        <div class="mb-3 flex items-center gap-3">
          <img
            v-if="barber.foto" :src="barber.foto" :alt="barber.user?.name ?? 'Barbero'"
            class="h-14 w-14 rounded-full object-cover"
          >
          <div v-else class="flex h-14 w-14 items-center justify-center rounded-full bg-gold/10 text-lg font-black text-gold">
            {{ (barber.user?.name ?? '?').charAt(0) }}
          </div>
          <div>
            <p class="font-black text-ink">{{ barber.user?.name ?? 'Barbero' }}</p>
            <p v-if="barber.avg_rating" class="text-xs text-gold">★ {{ barber.avg_rating }} ({{ barber.total_reviews }})</p>
            <p v-else class="text-xs text-muted">Sin reseñas aún</p>
          </div>
        </div>
        <p v-if="barber.especialidades" class="mb-1 text-xs font-bold uppercase tracking-wide text-muted">{{ barber.especialidades }}</p>
        <p class="line-clamp-2 text-sm text-muted">{{ barber.descripcion || 'Sin descripción.' }}</p>
      </NuxtLink>
    </div>
  </div>
</template>
