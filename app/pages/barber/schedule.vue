<script setup lang="ts">
definePageMeta({ middleware: ['auth', 'barber'], layout: 'dashboard' })

useSeoMeta({ title: 'Mi horario — UrbanBlade', robots: 'noindex' })

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

const { data, pending, error, refresh } = await useAsyncData<{ schedules: Day[] }>(
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

// Resumen de la semana: días con atención, horas totales y una barra por día sobre un eje de 6:00 a 24:00.
const AXIS_START = 6 * 60
const AXIS_END = 24 * 60

function minutes(time: string): number {
  const [h = 0, m = 0] = time.split(':').map(Number)

  return h * 60 + m
}

function spanMinutes(day: Day): number {
  return day.is_active ? Math.max(0, minutes(day.end_time) - minutes(day.start_time)) : 0
}

const activeDays = computed(() => days.value.filter(d => d.is_active).length)
const weeklyHours = computed(() => Math.round((days.value.reduce((sum, d) => sum + spanMinutes(d), 0) / 60) * 10) / 10)

function barStyle(day: Day) {
  const from = Math.max(AXIS_START, minutes(day.start_time))
  const to = Math.min(AXIS_END, minutes(day.end_time))
  const total = AXIS_END - AXIS_START

  return { left: `${((from - AXIS_START) / total) * 100}%`, width: `${(Math.max(0, to - from) / total) * 100}%` }
}

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

    <BrandStatePanel
      v-else-if="error"
      mascot="bruno"
      state="error"
      tone="danger"
      title="No se pudo cargar tu horario"
      action-label="Reintentar"
      @action="refresh"
    />

    <form v-else class="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]" @submit.prevent="save">
      <div class="space-y-4">
      <article
        v-for="day in days"
        :key="day.day_of_week"
        :class="[
          'ui-card grid gap-4 p-5 transition-opacity sm:grid-cols-[160px_1fr_1fr_auto] sm:items-center',
          { 'opacity-60': !day.is_active }
        ]"
      >
        <UiSwitch
          v-model="day.is_active"
          :label="names[day.day_of_week] ?? ''"
          :description="day.is_active ? 'Laboral' : 'Descanso'"
        />

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
          class="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-gold hover:bg-gold/10 min-h-10"
          @click="copyToAll(day)"
        >
          Copiar a todos
        </button>
      </article>
      </div>

      <aside class="ui-card space-y-5 p-5 xl:sticky xl:top-6" aria-label="Resumen de tu semana">
        <div>
          <h2 class="text-base font-semibold text-ink">Tu semana</h2>
          <p class="mt-0.5 text-sm text-muted">Así ven tu disponibilidad los clientes.</p>
        </div>

        <dl class="grid grid-cols-2 gap-3">
          <div class="rounded-xl border border-line p-3">
            <dt class="text-[11px] font-bold uppercase tracking-wide text-muted">Días con atención</dt>
            <dd class="mt-1 text-2xl font-semibold tabular-nums text-ink">{{ activeDays }}<span class="text-sm text-muted"> de 7</span></dd>
          </div>
          <div class="rounded-xl border border-line p-3">
            <dt class="text-[11px] font-bold uppercase tracking-wide text-muted">Horas a la semana</dt>
            <dd class="mt-1 text-2xl font-semibold tabular-nums text-gold">{{ weeklyHours }}</dd>
          </div>
        </dl>

        <ul class="space-y-2.5" aria-label="Horario por día">
          <li v-for="day in days" :key="day.day_of_week" class="grid grid-cols-[2.25rem_1fr] items-center gap-2 text-xs">
            <span class="font-semibold text-muted">{{ (names[day.day_of_week] ?? '').slice(0, 3) }}</span>
            <span class="relative block h-2.5 rounded-full bg-ink/10">
              <span v-if="day.is_active" class="absolute inset-y-0 rounded-full bg-gold" :style="barStyle(day)" />
            </span>
          </li>
          <li class="grid grid-cols-[2.25rem_1fr] gap-2 text-[10px] text-muted" aria-hidden="true">
            <span />
            <span class="flex justify-between"><span>6:00</span><span>12:00</span><span>18:00</span><span>24:00</span></span>
          </li>
        </ul>

        <p v-if="message" class="text-sm font-medium text-success" role="status">{{ message }}</p>
        <p v-if="errorMessage" class="text-sm font-medium text-danger" role="alert">{{ errorMessage }}</p>

        <button
          type="submit"
          :disabled="saving"
          class="min-h-11 w-full rounded-xl bg-gold px-6 py-2.5 text-sm font-bold text-black hover:bg-gold-dim disabled:opacity-50"
        >
          {{ saving ? 'Guardando horario…' : 'Guardar horario' }}
        </button>
      </aside>
    </form>
  </div>
</template>
