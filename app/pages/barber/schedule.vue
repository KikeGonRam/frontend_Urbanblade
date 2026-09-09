<script setup lang="ts">
definePageMeta({ middleware: ['auth', 'barber'], layout: 'dashboard' })

interface Day {
  day_of_week: string
  start_time: string
  end_time: string
  is_active: boolean
}

const names: Record<string, string> = {
  monday: 'Lunes',
  tuesday: 'Martes',
  wednesday: 'Miércoles',
  thursday: 'Jueves',
  friday: 'Viernes',
  saturday: 'Sábado',
  sunday: 'Domingo',
}
const order = Object.keys(names)
const { apiFetch } = useApi()

const { data, pending, error } = await useAsyncData<{ schedules: Day[] }>(
  'barber-schedule',
  () => apiFetch('/barber/schedule'),
  { lazy: true },
)

const days = ref<Day[]>([])

watchEffect(() => {
  if (data.value && !days.value.length) {
    days.value = order.map(key =>
      data.value?.schedules.find(d => d.day_of_week === key) ?? {
        day_of_week: key,
        start_time: '09:00',
        end_time: '18:00',
        is_active: key !== 'sunday',
      },
    )
  }
})

const saving = ref(false)
const message = ref('')
const errorMessage = ref('')

function copyToAll(source: Day) {
  days.value = days.value.map(day => ({
    ...day,
    start_time: source.start_time,
    end_time: source.end_time,
    is_active: source.is_active,
  }))
}

async function save() {
  saving.value = true
  message.value = ''
  errorMessage.value = ''

  try {
    await apiFetch('/barber/schedule', {
      method: 'PUT',
      body: {
        schedules: days.value.map(d => ({
          ...d,
          start_time: d.start_time.slice(0, 5),
          end_time: d.end_time.slice(0, 5),
        })),
      },
    })
    message.value = 'Horario actualizado correctamente.'
  } catch (err: unknown) {
    const dataErr = (err as { data?: { message?: string } })?.data
    errorMessage.value = dataErr?.message ?? 'No se pudo guardar el horario.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="p-4 sm:p-6 lg:p-8">
    <header class="mb-6">
      <p class="text-xs uppercase tracking-widest text-muted">Mi espacio</p>
      <h1 class="mt-1 text-2xl font-semibold text-ink">
        Mi <span class="text-gold">Horario Laboral</span>
      </h1>
      <p class="mt-1 text-sm text-muted">Define tus días laborales y horas de atención para que los clientes puedan agendar.</p>
    </header>

    <div v-if="pending" class="flex items-center gap-3 py-8 text-sm text-muted">
      <div class="h-5 w-5 animate-spin rounded-full border-2 border-gold border-t-transparent" />
      <span>Cargando horario…</span>
    </div>

    <p v-else-if="error" class="text-sm text-red-400">No se pudo cargar tu horario.</p>

    <form v-else class="max-w-3xl space-y-4" @submit.prevent="save">
      <article
        v-for="day in days"
        :key="day.day_of_week"
        :class="[
          'ui-card grid gap-4 p-5 transition-opacity sm:grid-cols-[160px_1fr_1fr_auto] sm:items-center',
          { 'opacity-60': !day.is_active }
        ]"
      >
        <label :for="`active-${day.day_of_week}`" class="flex cursor-pointer items-center gap-3 font-bold text-ink">
          <input
            :id="`active-${day.day_of_week}`"
            v-model="day.is_active"
            type="checkbox"
            class="h-5 w-5 rounded border-line text-gold focus:ring-gold"
          >
          <div>
            <span>{{ names[day.day_of_week] }}</span>
            <span class="block text-xs font-normal text-muted">{{ day.is_active ? 'Laboral' : 'Descanso' }}</span>
          </div>
        </label>

        <div>
          <label :for="`start-${day.day_of_week}`" class="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">Apertura</label>
          <input
            :id="`start-${day.day_of_week}`"
            v-model="day.start_time"
            :disabled="!day.is_active"
            type="time"
            required
            class="w-full rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink disabled:opacity-50"
          >
        </div>

        <div>
          <label :for="`end-${day.day_of_week}`" class="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">Cierre</label>
          <input
            :id="`end-${day.day_of_week}`"
            v-model="day.end_time"
            :disabled="!day.is_active"
            type="time"
            required
            class="w-full rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink disabled:opacity-50"
          >
        </div>

        <button
          type="button"
          class="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-gold hover:bg-gold/10"
          @click="copyToAll(day)"
        >
          Copiar a todos
        </button>
      </article>

      <p v-if="message" class="text-sm font-medium text-emerald-400">{{ message }}</p>
      <p v-if="errorMessage" class="text-sm font-medium text-red-400">{{ errorMessage }}</p>

      <button
        type="submit"
        :disabled="saving"
        class="rounded-lg bg-gold px-6 py-2.5 text-sm font-bold text-black hover:bg-gold-dim disabled:opacity-50"
      >
        {{ saving ? 'Guardando horario…' : 'Guardar horario' }}
      </button>
    </form>
  </div>
</template>
