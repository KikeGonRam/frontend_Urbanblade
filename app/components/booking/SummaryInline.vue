<script setup lang="ts">
import type { BarberRow, ServiceRow } from '~/types/booking'

defineProps<{
  service: ServiceRow
  barber: BarberRow | null
  date: string
  time: string
  embedded: boolean
}>()
</script>

<template>
  <div class="ui-card mb-6 flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-xs text-muted" :class="embedded ? '' : 'lg:hidden'">
    <strong class="text-ink">{{ service.nombre }}</strong>
    <span>{{ service.duracion_min }} min · {{ bookingCurrency(service.precio) }}</span>
    <span v-if="barber">{{ barber.user?.name }}</span>
    <span v-if="date">{{ bookingPrettyDate(date) }} {{ time }}</span>
  </div>
</template>
