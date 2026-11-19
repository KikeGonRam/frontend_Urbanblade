<script setup lang="ts">
import type { BarberRow, ServiceRow } from '~/types/booking'

defineProps<{
  service: ServiceRow | null
  barber: BarberRow | null
  date: string
  time: string
  /** Paso activo (0-3): en el último se muestra el total real en lugar de «Desde». */
  step: number
  grandTotal: number
}>()
</script>

<template>
  <aside class="mt-6 hidden lg:sticky lg:top-24 lg:mt-0 lg:block" aria-label="Resumen de tu reserva">
    <div class="ui-card p-5">
      <h2 class="text-xs font-black uppercase tracking-widest text-gold">Tu reserva</h2>
      <dl class="mt-4 space-y-3 text-sm">
        <div>
          <dt class="text-xs uppercase tracking-wider text-muted">Servicio</dt>
          <dd v-if="service" class="mt-0.5 font-bold text-ink">
            {{ service.nombre }}
            <span class="block text-xs font-normal text-muted">{{ service.duracion_min }} min</span>
          </dd>
          <dd v-else class="mt-0.5 text-muted">Elige un servicio</dd>
        </div>
        <div>
          <dt class="text-xs uppercase tracking-wider text-muted">Barbero</dt>
          <dd v-if="barber" class="mt-0.5 font-bold text-ink">{{ barber.user?.name }}</dd>
          <dd v-else class="mt-0.5 text-muted">Pendiente</dd>
        </div>
        <div>
          <dt class="text-xs uppercase tracking-wider text-muted">Cuándo</dt>
          <dd v-if="date && time" class="mt-0.5 font-bold text-ink">{{ bookingPrettyDate(date) }} · {{ time }}</dd>
          <dd v-else class="mt-0.5 text-muted">Pendiente</dd>
        </div>
      </dl>
      <div v-if="service" class="mt-5 flex items-baseline justify-between border-t border-line pt-4">
        <span class="text-xs uppercase tracking-wider text-muted">{{ step === 3 ? 'Total' : 'Desde' }}</span>
        <span class="text-2xl font-black text-ink">{{ bookingCurrency(step === 3 ? grandTotal : service.precio) }}</span>
      </div>
      <p class="mt-4 text-xs leading-5 text-muted">Puedes iniciar sin cuenta; te la pedimos solo al confirmar.</p>
    </div>
  </aside>
</template>
