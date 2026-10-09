<script setup lang="ts">
/*
 * Agenda del barbero (flujo de citas V2). Por estado:
 *  - Pendiente: aprobar o rechazar (solo el barbero la aprueba; recepción/admin quedan de respaldo).
 *  - Confirmada: iniciar (el backend exige que sea hoy y que el pago esté resuelto: si no, el botón queda deshabilitado
 *    con el motivo), marcar «no asistió» (genera el cargo por inasistencia) o cancelar.
 *  - En proceso: cuenta regresiva, terminar ahora o agregar tiempo (+10 / +15); al terminar se muestra el ticket.
 *  - Completada: ver el ticket.
 */
definePageMeta({ middleware: ['auth', 'barber'], layout: 'dashboard' })

interface Appointment {
  id: string
  code: string
  hora_inicio: string
  hora_fin: string
  estado: string
  client: { user: { name: string | null } }
  service: { nombre: string | null }
  pago_resuelto: boolean | null
  puede_iniciar: boolean | null
  motivo_no_iniciar: string | null
  fin_estimado: string | null
  minutos_extra: number | null
}
interface AgendaResponse { data: Appointment[], range: { label: string }, stats: Record<string, number> }

const { apiFetch } = useApi()
const { confirm } = useConfirm()

const period = ref<'day' | 'week'>('day')
const estado = ref('')
const offset = ref(0)
const busyCode = ref('')
const message = ref('')
const ticket = ref<ServiceTicket | null>(null)

const { data: response, pending, error, refresh } = await useAsyncData<AgendaResponse>(
  'barber-agenda',
  () => apiFetch('/barber/agenda', { query: { period: period.value, estado: estado.value || undefined, offset: offset.value } }),
  { watch: [period, estado, offset], lazy: true },
)
const appointments = computed(() => response.value?.data ?? [])
const stats = computed(() => response.value?.stats ?? {})

const labels: Record<string, string> = {
  pendiente: 'Pendiente',
  confirmada: 'Confirmada',
  en_proceso: 'En proceso',
  completada: 'Completada',
  cancelada: 'Cancelada',
  no_asistio: 'No asistió',
}
const classes: Record<string, string> = {
  pendiente: 'text-amber-300 bg-amber-500/10',
  confirmada: 'text-blue-300 bg-blue-500/10',
  en_proceso: 'text-sky-300 bg-sky-500/10',
  completada: 'text-emerald-300 bg-emerald-500/10',
  cancelada: 'text-red-400 bg-red-500/10',
  no_asistio: 'text-orange-300 bg-orange-500/10',
}
const toneClass = { ok: 'text-sky-300', soon: 'text-amber-300', over: 'text-red-400' } as const

// Reloj para la cuenta regresiva y recarga periódica de la agenda (un cambio hecho por recepción o el cliente aparece solo).
const now = ref(new Date())
let tick: ReturnType<typeof setInterval> | undefined
let reload: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  tick = setInterval(() => { now.value = new Date() }, 15000)
  reload = setInterval(() => { if (!busyCode.value) void refresh() }, 60000)
})
onBeforeUnmount(() => {
  clearInterval(tick)
  clearInterval(reload)
})

function left(appt: Appointment): number | null {
  return minutesLeft(appt.fin_estimado, now.value)
}

async function changeStatus(appt: Appointment, status: string) {
  busyCode.value = appt.code
  message.value = ''
  try {
    const res = await apiFetch<{ ticket?: ServiceTicket | null }>(`/appointments/${appt.code}/status`, { method: 'PATCH', body: { estado: status } })
    message.value = status === 'completada' ? 'Servicio terminado.' : 'Estado actualizado.'
    if (status === 'completada' && res.ticket) ticket.value = res.ticket
    await refresh()
  } catch (err: unknown) {
    message.value = apiMessage(err, 'No se pudo actualizar la cita.')
  } finally {
    busyCode.value = ''
  }
}

async function reject(appt: Appointment) {
  const ok = await confirm({
    title: 'Rechazar cita',
    message: `¿Rechazar la cita de ${appt.client.user.name ?? 'este cliente'}? Se cancelará y se le avisará.`,
    confirmText: 'Rechazar',
    isDanger: true,
  })
  if (ok) await changeStatus(appt, 'cancelada')
}

async function noShow(appt: Appointment) {
  const ok = await confirm({
    title: 'Marcar como no asistió',
    message: `${appt.client.user.name ?? 'El cliente'} no llegó. Se le generará un cargo por inasistencia (se cobra a su tarjeta guardada o queda como adeudo en recepción). ¿Continuar?`,
    confirmText: 'No asistió',
    isDanger: true,
  })
  if (ok) await changeStatus(appt, 'no_asistio')
}

async function extend(appt: Appointment, minutos: number, forzar = false) {
  busyCode.value = appt.code
  message.value = ''
  try {
    await apiFetch(`/appointments/${appt.code}/extend`, { method: 'POST', body: { minutos, forzar } })
    message.value = `Se agregaron ${minutos} minutos. Avisamos al cliente.`
    await refresh()
  } catch (err: unknown) {
    if (!forzar && canForceExtend(err)) {
      const ok = await confirm({
        title: 'Choca con la siguiente cita',
        message: apiMessage(err, 'Agregar ese tiempo choca con la siguiente cita.'),
        confirmText: 'Extender de todos modos',
        isDanger: true,
      })
      busyCode.value = ''
      if (ok) await extend(appt, minutos, true)
      return
    }
    message.value = apiMessage(err, 'No se pudo agregar tiempo.')
  } finally {
    busyCode.value = ''
  }
}

async function openTicket(appt: Appointment) {
  busyCode.value = appt.code
  message.value = ''
  try {
    const res = await apiFetch<{ data: ServiceTicket }>(`/appointments/${appt.code}/ticket`)
    ticket.value = res.data
  } catch (err: unknown) {
    message.value = apiMessage(err, 'Esta cita todavía no tiene ticket.')
  } finally {
    busyCode.value = ''
  }
}
</script>

<template>
  <div class="p-4 sm:p-6 lg:p-8">
    <header class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p class="text-xs uppercase tracking-widest text-muted">Mi espacio</p>
        <h1 class="mt-1 text-2xl font-semibold text-ink">Mi <span class="text-gold">Agenda</span></h1>
        <p class="mt-1 text-sm text-muted">{{ response?.range.label ?? 'Tus citas programadas' }}</p>
      </div>
      <div class="flex gap-2">
        <button class="rounded-lg border border-line px-3 py-2 text-sm text-muted" @click="offset -= period === 'week' ? 7 : 1">Anterior</button>
        <button class="rounded-lg border border-line px-3 py-2 text-sm text-ink" @click="offset = 0">Hoy</button>
        <button class="rounded-lg border border-line px-3 py-2 text-sm text-muted" @click="offset += period === 'week' ? 7 : 1">Siguiente</button>
      </div>
    </header>

    <section class="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
      <div
        v-for="card in [{ k: 'total_period', l: 'En periodo' }, { k: 'completed_period', l: 'Completadas' }, { k: 'productivity', l: 'Productividad', s: '%' }, { k: 'income_total', l: 'Ingreso histórico', s: '$' }]"
        :key="card.k"
        class="ui-card p-4"
      >
        <p class="text-xs uppercase text-muted">{{ card.l }}</p>
        <p class="mt-2 text-2xl font-black text-ink">{{ card.s === '$' ? '$' : '' }}{{ stats[card.k] ?? 0 }}{{ card.s === '%' ? '%' : '' }}</p>
      </div>
    </section>

    <div class="mb-5 flex gap-3">
      <label for="agenda-periodo" class="sr-only">Periodo</label>
      <select id="agenda-periodo" v-model="period" class="rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink">
        <option value="day">Día</option>
        <option value="week">Semana</option>
      </select>
      <label for="agenda-estado" class="sr-only">Filtrar por estado</label>
      <select id="agenda-estado" v-model="estado" class="rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink">
        <option value="">Todos los estados</option>
        <option v-for="(label, key) in labels" :key="key" :value="key">{{ label }}</option>
      </select>
    </div>

    <output v-if="message" class="mb-4 block text-sm text-gold">{{ message }}</output>
    <p v-if="pending" class="text-sm text-muted">Cargando agenda...</p>
    <p v-else-if="error" class="text-sm text-red-400">No se pudo cargar la agenda.</p>

    <section v-else class="space-y-3">
      <article v-for="appt in appointments" :key="appt.id" class="ui-card flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
        <div class="w-24 shrink-0">
          <p class="font-black text-gold">{{ appt.hora_inicio.slice(0, 5) }}</p>
          <p class="text-xs text-muted">{{ appt.hora_fin.slice(0, 5) }}</p>
        </div>

        <div class="min-w-0 flex-1">
          <p class="font-bold text-ink">{{ appt.client.user.name ?? 'Cliente' }}</p>
          <p class="text-sm text-muted">{{ appt.service.nombre ?? 'Servicio' }}</p>

          <p v-if="appt.estado === 'en_proceso'" class="mt-1 text-sm font-bold" :class="toneClass[remainingTone(left(appt))]" aria-live="polite">
            {{ remainingLabel(left(appt)) }}<span v-if="appt.minutos_extra" class="font-normal text-muted"> · +{{ appt.minutos_extra }} min agregados</span>
          </p>
          <p v-else-if="appt.estado === 'confirmada' && appt.puede_iniciar === false && appt.motivo_no_iniciar" class="mt-1 text-xs text-amber-300">
            {{ appt.motivo_no_iniciar }}
          </p>
        </div>

        <span class="rounded-full px-3 py-1 text-xs font-bold" :class="classes[appt.estado]">{{ labels[appt.estado] ?? appt.estado }}</span>

        <div class="flex flex-wrap gap-2">
          <template v-if="appt.estado === 'pendiente'">
            <button :disabled="busyCode === appt.code" class="rounded-lg bg-gold px-3 py-2 text-xs font-bold text-black disabled:opacity-50" @click="changeStatus(appt, 'confirmada')">Aprobar</button>
            <button :disabled="busyCode === appt.code" class="rounded-lg border border-red-500/20 px-3 py-2 text-xs text-red-400 disabled:opacity-50" @click="reject(appt)">Rechazar</button>
          </template>

          <template v-else-if="appt.estado === 'confirmada'">
            <button
              :disabled="busyCode === appt.code || appt.puede_iniciar === false"
              :title="appt.puede_iniciar === false ? (appt.motivo_no_iniciar ?? '') : ''"
              class="rounded-lg bg-gold px-3 py-2 text-xs font-bold text-black disabled:opacity-40"
              @click="changeStatus(appt, 'en_proceso')"
            >
              Iniciar
            </button>
            <button :disabled="busyCode === appt.code" class="rounded-lg border border-orange-500/30 px-3 py-2 text-xs text-orange-300 disabled:opacity-50" @click="noShow(appt)">No asistió</button>
            <button :disabled="busyCode === appt.code" class="rounded-lg border border-red-500/20 px-3 py-2 text-xs text-red-400 disabled:opacity-50" @click="changeStatus(appt, 'cancelada')">Cancelar</button>
          </template>

          <template v-else-if="appt.estado === 'en_proceso'">
            <button :disabled="busyCode === appt.code" class="rounded-lg bg-gold px-3 py-2 text-xs font-bold text-black disabled:opacity-50" @click="changeStatus(appt, 'completada')">Terminar ahora</button>
            <button
              v-for="minutos in EXTEND_OPTIONS"
              :key="minutos"
              :disabled="busyCode === appt.code"
              class="rounded-lg border border-sky-500/30 px-3 py-2 text-xs font-bold text-sky-300 disabled:opacity-50"
              @click="extend(appt, minutos)"
            >
              +{{ minutos }} min
            </button>
          </template>

          <button v-else-if="appt.estado === 'completada'" :disabled="busyCode === appt.code" class="rounded-lg border border-emerald-500/30 px-3 py-2 text-xs font-bold text-emerald-300 disabled:opacity-50" @click="openTicket(appt)">
            Ver ticket
          </button>
        </div>
      </article>

      <div v-if="!appointments.length" class="ui-card py-16 text-center text-sm text-muted">No hay citas en este periodo.</div>
    </section>

    <UiServiceTicketModal v-if="ticket" :ticket="ticket" @close="ticket = null" />
  </div>
</template>
