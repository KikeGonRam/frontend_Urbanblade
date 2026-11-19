<script setup lang="ts">
import type { DayOption, Slot, SlotGroup } from '~/types/booking'

defineProps<{
  days: DayOption[]
  date: string
  time: string
  slots: Slot[]
  groupedSlots: SlotGroup[]
  slotsPending: boolean
  slotsFailed: boolean
  /** Solo cliente o invitado pueden anotarse en la lista de espera (nunca staff/barbero). */
  canBookHere: boolean
  joiningWaitlist: boolean
  waitlistJoined: boolean
  waitlistError: string
}>()
const emit = defineEmits<{
  'pick-date': [iso: string]
  'pick-time': [time: string]
  'join-waitlist': []
}>()
</script>

<template>
  <section aria-labelledby="paso-horario">
    <h2 id="paso-horario" class="mb-4 text-sm font-black uppercase tracking-widest text-ink">
      3. Elige día y hora
    </h2>

    <div class="mb-5 grid grid-cols-4 gap-2 sm:grid-cols-7" role="group" aria-label="Elegir día">
      <button
        v-for="d in days" :key="d.iso" type="button"
        class="flex min-h-11 min-w-0 flex-col items-center justify-center rounded-xl border py-3 transition-colors"
        :class="date === d.iso ? 'border-gold bg-gold/10 text-gold' : 'border-line text-muted hover:border-gold/30'"
        :aria-pressed="date === d.iso"
        @click="emit('pick-date', d.iso)"
      >
        <span class="text-xs font-black uppercase tracking-widest">{{ d.isToday ? 'Hoy' : d.weekday }}</span>
        <span class="text-lg font-black leading-none text-ink" :class="date === d.iso && 'text-gold'">{{ d.day }}</span>
        <span class="text-xs uppercase">{{ d.month }}</span>
      </button>
    </div>

    <BrandStatePanel
      v-if="!date" mascot="nava" state="empty"
      title="Elige un día" description="Te mostramos los horarios libres de ese día."
    />
    <BrandStatePanel v-else-if="slotsPending" mascot="bladebot" state="waiting" title="Buscando horarios libres…" />
    <BrandStatePanel
      v-else-if="slotsFailed" mascot="bruno" state="error" tone="danger"
      title="No se pudieron cargar los horarios" description="Revisa tu conexión e inténtalo nuevamente."
    />
    <template v-else-if="!slots.length">
      <BrandStatePanel
        mascot="nava" state="empty"
        title="Ese día ya no tiene horarios libres"
        description="Prueba con otra fecha o con otro barbero del equipo."
      />
      <div v-if="canBookHere" class="ui-card mt-4 p-4 text-center">
        <template v-if="waitlistJoined">
          <p class="text-sm font-bold text-success">
            Te anotamos en la lista de espera. Te avisaremos si se libera un horario ese día.
          </p>
        </template>
        <template v-else>
          <p class="text-sm text-muted">
            ¿Prefieres esperar a que se libere un horario en vez de cambiar de día?
          </p>
          <button
            type="button" class="ui-btn-secondary mt-3 px-6 py-2.5 text-xs"
            :disabled="joiningWaitlist" @click="emit('join-waitlist')"
          >
            {{ joiningWaitlist ? 'Anotando…' : 'Anotarme en lista de espera' }}
          </button>
          <p v-if="waitlistError" role="alert" class="mt-2 text-xs text-danger">{{ waitlistError }}</p>
        </template>
      </div>
    </template>
    <template v-else>
      <p class="mb-4 text-xs font-bold text-muted">
        {{ slots.length }} horario{{ slots.length === 1 ? '' : 's' }} disponible{{ slots.length === 1 ? '' : 's' }} para
        {{ bookingPrettyDate(date) }}
      </p>
      <div v-for="group in groupedSlots" :key="group.key" class="mb-5 last:mb-0">
        <h3 class="mb-2 text-xs font-black uppercase tracking-widest text-muted">
          {{ group.label }} <span class="text-ink/40">· {{ group.slots.length }}</span>
        </h3>
        <div class="grid grid-cols-3 gap-2 sm:grid-cols-5">
          <button
            v-for="slot in group.slots" :key="slot.time" type="button"
            class="min-h-11 rounded-xl border px-2 py-2 text-sm font-bold transition-colors"
            :class="time === slot.time ? 'border-gold bg-gold/10 text-gold' : 'border-line text-ink hover:border-gold/30'"
            :aria-pressed="time === slot.time"
            @click="emit('pick-time', slot.time)"
          >
            {{ slot.time }}
          </button>
        </div>
      </div>
    </template>
  </section>
</template>
