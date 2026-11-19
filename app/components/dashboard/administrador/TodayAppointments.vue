<script setup lang="ts">
import type { TodayAppointment } from "~/types/dashboard";
import { appointmentStatus } from "~/utils/appointmentStatus";

defineProps<{ appointments: TodayAppointment[] }>();
const emit = defineEmits<{ select: [code: string] }>();
</script>

<template>
  <div
    class="rounded-2xl border border-ink/[0.06] bg-card p-5 lg:col-span-7"
  >
    <div class="mb-5 flex items-center justify-between">
      <div>
        <h3 class="text-base font-semibold text-ink">Citas de Hoy</h3>
        <p class="mt-0.5 text-sm text-muted">Agenda</p>
      </div>
    </div>

    <div
      v-if="!appointments.length"
      class="flex flex-col items-center justify-center rounded-xl border border-dashed border-ink/[0.06] py-12"
    >
      <svg
        class="mb-2 h-8 w-8 text-ink/10"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="1.2"
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      </svg>
      <p class="text-xs font-bold uppercase tracking-widest text-ink/45">
        Sin citas hoy
      </p>
    </div>
    <div v-else class="space-y-2">
      <button
        v-for="appt in appointments"
        :key="appt.id"
        type="button"
        class="flex w-full items-center gap-3 rounded-xl border border-ink/[0.05] p-3 text-left transition-all hover:border-gold/40 hover:bg-ink/[0.02] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
        :aria-label="`Ver detalle de la cita de ${appt.cliente}`"
        @click="emit('select', appt.code)"
      >
        <div class="w-10 shrink-0 text-center">
          <p class="text-xs font-black text-ink">
            {{ appt.hora_inicio?.slice(0, 5) ?? "--:--" }}
          </p>
          <p class="text-xs font-bold text-ink/45">
            {{ appt.hora_fin?.slice(0, 5) }}
          </p>
        </div>
        <div class="h-7 w-px shrink-0 bg-ink/[0.06]" />
        <div class="min-w-0 flex-1">
          <p class="truncate text-xs font-black text-ink">
            {{ appt.cliente }}
          </p>
          <p class="truncate text-xs font-bold text-ink/35">
            {{ appt.servicio }} · {{ appt.barbero }}
          </p>
        </div>
        <UiBadge :tone="appointmentStatus(appt.estado).tone" class="shrink-0">
          {{ appointmentStatus(appt.estado).label }}
        </UiBadge>
      </button>
    </div>
  </div>
</template>
