<script setup lang="ts">
import type { AdminData } from "~/types/dashboard";
import { appointmentStatus } from "~/utils/appointmentStatus";

defineProps<{ data: AdminData }>();
const emit = defineEmits<{ select: [code: string] }>();

const activeTab = ref("activity");
const TABS = [
  { id: "activity", label: "Actividad" },
  { id: "stations", label: "Estaciones" },
  { id: "topbarber", label: "Top Mes" },
];
</script>

<template>
  <div class="lg:col-span-5">
    <div
      class="flex h-full flex-col overflow-hidden rounded-2xl border border-ink/[0.06] bg-card"
    >
      <div class="flex border-b border-ink/[0.06]">
        <button
          v-for="tab in TABS"
          :key="tab.id"
          type="button"
          class="flex-1 py-3 text-xs font-black uppercase tracking-[0.2em] transition-all"
          :class="
            activeTab === tab.id
              ? '-mb-px border-b-2 border-gold text-gold'
              : 'text-ink/50 hover:text-ink/60'
          "
          @click="activeTab = tab.id"
        >
          {{ tab.label }}
        </button>
      </div>

      <div class="flex-1 p-5">
        <div v-if="activeTab === 'activity'" class="space-y-3">
          <button
            v-for="appt in data.recentAppointments.slice(0, 6)"
            :key="appt.id"
            type="button"
            class="-mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-lg px-2 py-1 text-left transition-colors hover:bg-ink/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold"
            :aria-label="`Ver detalle de la cita de ${appt.cliente}`"
            @click="emit('select', appt.code)"
          >
            <UiAvatar :src="appt.cliente_avatar_url" :name="appt.cliente" />
            <div class="min-w-0 flex-1">
              <p class="truncate text-xs font-bold text-ink">
                {{ appt.cliente }}
              </p>
              <p class="truncate text-xs text-ink/50">
                {{ appt.fecha }} · {{ appt.hora_inicio?.slice(0, 5) }}
              </p>
            </div>
            <UiBadge :tone="appointmentStatus(appt.estado).tone" class="shrink-0">
              {{ appointmentStatus(appt.estado).label }}
            </UiBadge>
          </button>
          <p
            v-if="!data.recentAppointments.length"
            class="py-8 text-center text-xs italic text-ink/45"
          >
            Sin actividad reciente
          </p>
        </div>

        <DashboardAdministradorStationsTab
          v-else-if="activeTab === 'stations'"
          :statuses="data.kpis.barbers_status"
        />

        <div v-else-if="activeTab === 'topbarber'">
          <div
            v-if="data.kpis.top_barber_name"
            class="flex flex-col items-center py-4 text-center"
          >
            <div
              class="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl border border-gold/20 bg-gradient-to-br from-gold/20 to-gold/5 text-2xl font-black text-gold"
            >
              {{ data.kpis.top_barber_name.slice(0, 2).toUpperCase() }}
            </div>
            <p class="text-base font-black uppercase text-ink">
              {{ data.kpis.top_barber_name }}
            </p>
            <p
              class="mt-0.5 text-xs font-bold uppercase tracking-widest text-ink/50"
            >
              Mejor del mes
            </p>
            <div
              class="mt-3 inline-flex items-center gap-2 rounded-xl border border-gold/15 bg-gold/[0.06] px-4 py-2"
            >
              <svg
                class="h-3.5 w-3.5 text-gold"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <p class="text-sm font-black text-gold">
                {{ data.kpis.top_barber_total }}
              </p>
              <p
                class="text-xs font-bold uppercase tracking-wider text-ink/50"
              >
                citas
              </p>
            </div>
          </div>
          <p v-else class="py-8 text-center text-xs italic text-ink/45">
            Sin datos este mes
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
