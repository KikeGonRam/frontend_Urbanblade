<script setup lang="ts">
import type { ServiceRow } from '~/types/booking'

defineProps<{
  services: ServiceRow[]
  pending: boolean
  failed: boolean
}>()
const emit = defineEmits<{ pick: [id: string] }>()
</script>

<template>
  <section aria-labelledby="paso-servicio">
    <h2 id="paso-servicio" class="mb-4 text-sm font-black uppercase tracking-widest text-ink">
      1. Elige tu servicio
    </h2>
    <BrandStatePanel v-if="pending" mascot="bladebot" state="waiting" title="Cargando servicios…" />
    <BrandStatePanel
      v-else-if="failed" mascot="bruno" state="error" tone="danger"
      title="No se pudo cargar el catálogo" description="Revisa tu conexión e inténtalo nuevamente."
    />
    <BrandStatePanel
      v-else-if="!services.length" mascot="nava" state="empty"
      title="Aún no hay servicios publicados" description="Vuelve pronto o comunícate con la barbería."
    />
    <div v-else class="grid gap-3 sm:grid-cols-2">
      <button
        v-for="service in services" :key="service.id" type="button"
        class="ui-card flex min-h-11 items-center gap-4 p-4 text-left transition-colors hover:border-gold/40"
        @click="emit('pick', service.id)"
      >
        <img
          v-if="service.imagen" :src="service.imagen" :alt="service.nombre"
          class="h-14 w-14 shrink-0 rounded-lg border border-line object-cover"
        >
        <span v-else class="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-line bg-gold/10 text-gold" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="h-6 w-6">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 6a2 2 0 1 1 4 0 2 2 0 0 1-4 0Zm0 12a2 2 0 1 1 4 0 2 2 0 0 1-4 0Zm2-10 10 8m0-8L8 16" />
          </svg>
        </span>
        <span class="min-w-0 flex-1">
          <span class="block truncate text-sm font-black text-ink">{{ service.nombre }}</span>
          <span class="mt-0.5 block text-xs text-muted">{{ service.duracion_min }} min</span>
        </span>
        <span class="shrink-0 text-sm font-black text-gold">{{ bookingCurrency(service.precio) }}</span>
      </button>
    </div>
  </section>
</template>
