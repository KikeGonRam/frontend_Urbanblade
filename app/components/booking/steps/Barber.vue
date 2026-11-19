<script setup lang="ts">
import type { BarberRow } from '~/types/booking'

defineProps<{
  /** Ya ordenados (favorito primero). */
  barbers: BarberRow[]
  pending: boolean
  failed: boolean
  isAuthenticated: boolean
  favoriteSaving: boolean
}>()
const emit = defineEmits<{
  pick: [id: string]
  favorite: [barber: BarberRow]
}>()
</script>

<template>
  <section aria-labelledby="paso-barbero">
    <h2 id="paso-barbero" class="mb-4 text-sm font-black uppercase tracking-widest text-ink">
      2. Elige tu barbero
    </h2>
    <BrandStatePanel v-if="pending" mascot="bladebot" state="waiting" title="Cargando barberos…" />
    <BrandStatePanel
      v-else-if="failed" mascot="bruno" state="error" tone="danger"
      title="No se pudo cargar el equipo" description="Revisa tu conexión e inténtalo nuevamente."
    />
    <BrandStatePanel
      v-else-if="!barbers.length" mascot="nava" state="empty"
      title="Aún no hay barberos activos" description="Vuelve pronto o comunícate con la barbería."
    />
    <div v-else class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <div
        v-for="barber in barbers" :key="barber.id"
        class="ui-card relative flex flex-col gap-3 p-4 transition-colors hover:border-gold/40"
        :class="barber.es_favorito && 'border-gold/50'"
      >
        <button
          v-if="isAuthenticated" type="button"
          class="absolute right-2 top-2 grid h-11 w-11 place-items-center rounded-full transition-colors"
          :class="barber.es_favorito ? 'text-gold' : 'text-muted hover:text-gold'"
          :aria-pressed="barber.es_favorito"
          :aria-label="barber.es_favorito ? `Quitar a ${barber.user?.name} de favoritos` : `Marcar a ${barber.user?.name} como favorito`"
          :disabled="favoriteSaving"
          @click.stop="emit('favorite', barber)"
        >
          <svg viewBox="0 0 24 24" :fill="barber.es_favorito ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="1.5" class="h-5 w-5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 20.5s-7.5-4.6-10-9.3C.5 8 2 4.5 5.5 4c2-.3 3.8.7 4.9 2.2l1.6 2 1.6-2C14.7 4.7 16.5 3.7 18.5 4c3.5.5 5 4 3.5 7.2-2.5 4.7-10 9.3-10 9.3Z" />
          </svg>
        </button>
        <button type="button" class="flex min-h-11 items-center gap-3 pr-10 text-left" @click="emit('pick', barber.id)">
          <img
            v-if="barber.foto" :src="barber.foto" :alt="`Foto de ${barber.user?.name}`"
            class="h-12 w-12 shrink-0 rounded-full object-cover" loading="lazy" decoding="async"
          >
          <span v-else class="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-gold/15 text-xs font-black text-gold" aria-hidden="true">
            {{ (barber.user?.name ?? '?').slice(0, 1) }}
          </span>
          <span class="min-w-0">
            <span class="block truncate text-sm font-black text-ink">{{ barber.user?.name }}</span>
            <span v-if="barber.es_favorito" class="mt-1 inline-block rounded-full bg-gold/10 px-2 py-0.5 text-xs font-bold text-gold">Tu favorito</span>
            <span class="mt-0.5 block truncate text-xs text-muted">{{ barber.especialidades || 'Barbero' }}</span>
          </span>
        </button>

        <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <span v-if="barber.avg_rating" class="flex items-center gap-1 font-bold text-gold">
            <svg viewBox="0 0 20 20" fill="currentColor" class="h-3.5 w-3.5">
              <path d="M10 1.5l2.6 5.27 5.82.85-4.21 4.1 1 5.8L10 14.9l-5.21 2.74 1-5.8-4.21-4.1 5.82-.85L10 1.5Z" />
            </svg>
            {{ barber.avg_rating }} <span class="font-normal text-muted">({{ barber.total_reviews }})</span>
          </span>
          <span v-else class="text-muted">Sin reseñas todavía</span>
          <span v-if="barber.citas_conmigo" class="rounded-full bg-gold/10 px-2 py-0.5 font-bold text-gold">
            Ya te cortaste {{ barber.citas_conmigo }}x con él
          </span>
        </div>

        <NuxtLink
          v-if="barber.slug" :to="`/equipo/${barber.slug}`" target="_blank"
          class="text-xs font-bold text-muted underline decoration-dotted hover:text-gold"
        >
          Ver perfil y portafolio →
        </NuxtLink>
      </div>
    </div>
  </section>
</template>
