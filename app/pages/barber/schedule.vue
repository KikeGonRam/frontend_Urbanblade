<script setup lang="ts">
definePageMeta({ middleware: ['auth', 'barber'], layout: 'dashboard' })

useSeoMeta({ title: 'Mi horario — UrbanBlade', robots: 'noindex' })

// La API guarda una fila por franja; aquí cada día agrupa hasta dos (p. ej. 09-14 y 16-20, con descanso en medio).
interface Row {
  day_of_week: string
  start_time: string
  end_time: string
  is_active: boolean
}
interface Range {
  start_time: string
  end_time: string
}
interface Day {
  day_of_week: string
  is_active: boolean
  ranges: Range[]
}
const MAX_RANGES = 2

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

const { data, pending, error, refresh } = await useAsyncData<{ schedules: Row[] }>(
  'barber-schedule',
  () => apiFetch('/barber/schedule'),
  { lazy: true },
)

const days = ref<Day[]>([])

watchEffect(() => {
  if (data.value && !days.value.length) {
    days.value = order.map((key) => {
      const rows = (data.value?.schedules ?? []).filter(d => d.day_of_week === key)
      if (!rows.length) {
        return { day_of_week: key, is_active: key !== 'sunday', ranges: [{ start_time: '09:00', end_time: '18:00' }] }
      }

      return {
        day_of_week: key,
        is_active: rows.some(row => row.is_active),
        ranges: rows
          .map(row => ({ start_time: row.start_time.slice(0, 5), end_time: row.end_time.slice(0, 5) }))
          .sort((a, b) => a.start_time.localeCompare(b.start_time))
          .slice(0, MAX_RANGES),
      }
    })
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
  return day.is_active ? day.ranges.reduce((sum, r) => sum + Math.max(0, minutes(r.end_time) - minutes(r.start_time)), 0) : 0
}

const activeDays = computed(() => days.value.filter(d => d.is_active).length)
const weeklyHours = computed(() => Math.round((days.value.reduce((sum, d) => sum + spanMinutes(d), 0) / 60) * 10) / 10)

function barStyle(range: Range) {
  const from = Math.max(AXIS_START, minutes(range.start_time))
  const to = Math.min(AXIS_END, minutes(range.end_time))
  const total = AXIS_END - AXIS_START

  return { left: `${((from - AXIS_START) / total) * 100}%`, width: `${(Math.max(0, to - from) / total) * 100}%` }
}

function copyToAll(source: Day) {
  days.value = days.value.map(day => ({
    ...day,
    is_active: source.is_active,
    ranges: source.ranges.map(range => ({ ...range })),
  }))
}

function hhmm(total: number): string {
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

function addRange(day: Day) {
  if (day.ranges.length >= MAX_RANGES) return
  const last = day.ranges[day.ranges.length - 1]
  // Segunda franja sugerida: arranca una hora después de que termina la primera.
  const from = Math.min(minutes(last ? last.end_time : '09:00') + 60, 22 * 60)
  day.ranges.push({ start_time: hhmm(from), end_time: hhmm(Math.min(from + 4 * 60, 23 * 60 + 59)) })
}

function removeRange(day: Day, index: number) {
  if (day.ranges.length > 1) day.ranges.splice(index, 1)
}

async function save() {
  saving.value = true
  message.value = ''
  errorMessage.value = ''

  try {
    await apiFetch('/barber/schedule', {
      method: 'PUT',
      body: {
        schedules: days.value.flatMap(d => d.ranges.map(range => ({
          day_of_week: d.day_of_week,
          is_active: d.is_active,
          start_time: range.start_time.slice(0, 5),
          end_time: range.end_time.slice(0, 5),
        }))),
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
          'ui-card grid gap-4 p-5 transition-opacity sm:grid-cols-[160px_1fr_auto] sm:items-start',
          { 'opacity-60': !day.is_active }
        ]"
      >
        <UiSwitch
          v-model="day.is_active"
          :label="names[day.day_of_week] ?? ''"
          :description="day.is_active ? 'Laboral' : 'Descanso'"
        />

        <div class="space-y-3">
          <div
            v-for="(range, index) in day.ranges"
            :key="index"
            class="grid grid-cols-[1fr_1fr_auto] items-end gap-3"
          >
            <div>
              <label :for="(index === 0 ? `start-${day.day_of_week}` : `start-${day.day_of_week}-${index}`)" class="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">
                {{ index === 0 ? 'Apertura' : 'Reapertura' }}
              </label>
              <input
                :id="(index === 0 ? `start-${day.day_of_week}` : `start-${day.day_of_week}-${index}`)"
                v-model="range.start_time"
                :disabled="!day.is_active"
                type="time"
                required
                class="w-full rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink disabled:opacity-50"
              >
            </div>
            <div>
              <label :for="(index === 0 ? `end-${day.day_of_week}` : `end-${day.day_of_week}-${index}`)" class="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">
                {{ index === 0 && day.ranges.length > 1 ? 'Descanso desde' : 'Cierre' }}
              </label>
              <input
                :id="(index === 0 ? `end-${day.day_of_week}` : `end-${day.day_of_week}-${index}`)"
                v-model="range.end_time"
                :disabled="!day.is_active"
                type="time"
                required
                class="w-full rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink disabled:opacity-50"
              >
            </div>
            <button
              v-if="index > 0"
              type="button"
              class="min-h-10 rounded-lg border border-line px-3 py-1.5 text-xs text-muted hover:text-danger"
              :disabled="!day.is_active"
              :aria-label="`Quitar la segunda franja del ${names[day.day_of_week] ?? 'día'}`"
              @click="removeRange(day, index)"
            >
              Quitar
            </button>
            <span v-else />
          </div>
          <button
            v-if="day.ranges.length < MAX_RANGES"
            type="button"
            class="text-xs font-semibold text-gold hover:underline disabled:opacity-50"
            :disabled="!day.is_active"
            @click="addRange(day)"
          >
            + Agregar descanso (segunda franja)
          </button>
        </div>

        <button
          type="button"
          class="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-gold hover:bg-gold/10 min-h-10"
          @click="copyToAll(day)"
        >
          Aplicar a todos los días
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
              <template v-if="day.is_active">
                <span v-for="(range, index) in day.ranges" :key="index" class="absolute inset-y-0 rounded-full bg-gold" :style="barStyle(range)" />
              </template>
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
