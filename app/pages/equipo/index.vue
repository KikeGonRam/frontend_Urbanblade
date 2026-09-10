<script setup lang="ts">
/*
 * Listado público del equipo -- puerto de barber's /equipo/{barber} (índice
 * implícito de la landing, Blade welcome). Consume CatalogController::barbers()
 * (ya público, mismo que usa la landing), sin cambios de backend. A
 * diferencia de /barbers (que exige sesión para el flujo de reserva dentro
 * de la app), esta página es para visitantes que aún no se registran.
 */
definePageMeta({ layout: 'public' })

useSeoMeta({
  title: 'Nuestro Equipo — UrbanBlade',
  description: 'Conoce a los maestros barberos de UrbanBlade antes de reservar tu cita.',
})

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
  'public-barbers-catalog',
  () => apiFetch<{ data: BarberRow[] }>('/barbers'),
)
const barbers = computed(() => response.value?.data ?? [])

function initials(name?: string | null) {
  if (!name) return '?'
  return name.trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase() ?? '').join('')
}
</script>

<template>
  <div class="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
    <header class="mb-12 text-center">
      <p class="mb-4 flex items-center justify-center gap-3 text-[10px] font-black uppercase tracking-[0.4em] text-gold">
        <span class="inline-block h-px w-8 bg-gold" />
        Nuestro Equipo
        <span class="inline-block h-px w-8 bg-gold" />
      </p>
      <h1 class="text-4xl font-black uppercase tracking-tight text-ink">Los <span class="text-gold">Maestros</span></h1>
      <p class="mx-auto mt-4 max-w-md text-sm leading-relaxed text-muted">Arquitectos de la imagen masculina. Conócelos antes de reservar.</p>
    </header>

    <p v-if="pending" class="py-20 text-center text-muted">Cargando maestros…</p>
    <p v-else-if="error" class="py-20 text-center text-sm text-red-400">No se pudo cargar el equipo.</p>
    <p v-else-if="!barbers.length" class="py-20 text-center text-muted">Nuestros maestros se están preparando...</p>

    <div v-else class="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
      <NuxtLink
        v-for="barber in barbers" :key="barber.id" :to="`/equipo/${barber.slug}`"
        class="barber-card group relative block"
      >
        <div class="relative aspect-[3/4] overflow-hidden rounded-3xl border border-line bg-card">
          <img
            v-if="barber.foto" :src="barber.foto" loading="lazy" :alt="`Foto de ${barber.user?.name}`"
            class="h-full w-full object-cover grayscale transition-all duration-700 group-hover:scale-110 group-hover:grayscale-0"
          >
          <div v-else class="flex h-full w-full items-center justify-center bg-gradient-to-br from-gold/10 via-card to-main">
            <span class="text-4xl font-black uppercase tracking-tighter text-gold/50">{{ initials(barber.user?.name) }}</span>
          </div>
          <div class="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
          <div class="absolute bottom-0 left-0 right-0 translate-y-1 p-6 transition-transform duration-400 group-hover:translate-y-0">
            <h2 class="text-base font-black uppercase text-white">{{ barber.user?.name }}</h2>
            <p class="mt-1 text-[9px] font-bold uppercase tracking-widest text-gold">{{ barber.especialidades || 'Master Groomer' }}</p>
            <p v-if="barber.avg_rating" class="mt-2 text-[9px] font-black uppercase tracking-widest text-white/70">★ {{ barber.avg_rating }} ({{ barber.total_reviews }} reseñas)</p>
          </div>
        </div>
      </NuxtLink>
    </div>
  </div>
</template>
