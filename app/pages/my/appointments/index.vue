<script setup lang="ts">
/*
 * Fase 9.8 — "Mis Citas" del cliente, puerto de Client\ClientAppointmentController
 * (web): historial propio con stats/próxima cita, reagendar (bloqueado si la
 * cita ya no está pendiente/confirmada o ya inició) y cancelar respetando la
 * política de cancelación del negocio (BarbershopSetting.politica_cancelacion).
 *
 * La compra de productos como add-on al reservar (StoreClientAppointmentRequest
 * `productos[]`) se omite a propósito: Tienda/Carrito (Fase 9.4) ya cubre por
 * completo la compra de productos, y duplicarla aquí sería redundante.
 */
definePageMeta({ middleware: ['auth', 'client'], layout: 'dashboard' })

interface AppointmentRow {
  id: string
  code: string | null
  fecha: string
  hora_inicio: string
  hora_fin: string
  estado: string
  notas: string | null
  precio_cobrado: number | null
  barber: { id: string | null, slug: string | null, user: { name: string | null } }
  service: { id: string | null, nombre: string | null, precio: number | null, duracion_min: number | null }
}

interface Stats { total: number, proximas: number, completadas: number, canceladas: number }

const ESTADO_LABEL: Record<string, string> = {
  pendiente: 'Pendiente', confirmada: 'Confirmada', en_proceso: 'En Proceso',
  completada: 'Completada', cancelada: 'Cancelada', no_asistio: 'No Asistió',
}
const ESTADO_CLASS: Record<string, string> = {
  pendiente: 'border-amber-500/25 bg-amber-500/10 text-amber-300',
  confirmada: 'border-blue-500/25 bg-blue-500/10 text-blue-300',
  en_proceso: 'border-sky-500/25 bg-sky-500/10 text-sky-300',
  completada: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300',
  cancelada: 'border-red-500/25 bg-red-500/10 text-red-400',
  no_asistio: 'border-orange-500/25 bg-orange-500/10 text-orange-300',
}

const { apiFetch } = useApi()

const { data: response, pending, error, refresh } = await useAsyncData(
  'my-appointments',
  () => apiFetch<{ data: AppointmentRow[], stats: Stats, next: AppointmentRow | null, cancellation_policy_hours: number }>('/appointments'),
)
const appointments = computed(() => response.value?.data ?? [])
const stats = computed<Stats>(() => response.value?.stats ?? { total: 0, proximas: 0, completadas: 0, canceladas: 0 })
const next = computed(() => response.value?.next ?? null)
const policyHours = computed(() => response.value?.cancellation_policy_hours ?? 24)

interface Barber { id: string, name: string }
interface Service { id: string, nombre: string, precio: number, duracion_min: number }

const { data: barbersRes } = await useAsyncData('my-appointments-barbers', () =>
  apiFetch<{ data: Array<{ id: string, user: { name: string } | null }> }>('/barbers'))
const barbers = computed<Barber[]>(() => (barbersRes.value?.data ?? []).map((b) => ({ id: b.id, name: b.user?.name ?? 'Barbero' })))

const { data: servicesRes } = await useAsyncData('my-appointments-services', () =>
  apiFetch<{ data: Service[] }>('/services'))
const services = computed(() => servicesRes.value?.data ?? [])

function canManage(appt: AppointmentRow) {
  if (!['pendiente', 'confirmada'].includes(appt.estado)) return false
  const startsAt = new Date(`${appt.fecha}T${appt.hora_inicio}`)

  return startsAt.getTime() > Date.now()
}

function fmtDate(fecha: string) {
  return new Date(`${fecha}T00:00:00`).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ── Reagendar ─────────────────────────────────────────────────────────────
const showForm = ref(false)
const editing = ref<AppointmentRow | null>(null)
const form = reactive({ barber_id: '', service_id: '', fecha: '', hora_inicio: '', notas: '' })
const formError = ref('')
const saving = ref(false)

function openReschedule(appt: AppointmentRow) {
  editing.value = appt
  form.barber_id = appt.barber.id ?? ''
  form.service_id = appt.service.id ?? ''
  form.fecha = appt.fecha
  form.hora_inicio = appt.hora_inicio?.slice(0, 5) ?? ''
  form.notas = appt.notas ?? ''
  formError.value = ''
  showForm.value = true
}

async function submitReschedule() {
  if (!editing.value) return

  saving.value = true
  formError.value = ''
  try {
    // Appointment usa HasPublicCode -> getRouteKeyName() = 'code', no 'id'.
    await apiFetch(`/appointments/${editing.value.code}`, {
      method: 'PUT',
      body: { barber_id: form.barber_id, service_id: form.service_id, fecha: form.fecha, hora_inicio: form.hora_inicio, notas: form.notas || undefined },
    })
    showForm.value = false
    await refresh()
  } catch (err: unknown) {
    formError.value = (err as { data?: { message?: string } })?.data?.message ?? 'No se pudo reprogramar la cita.'
  } finally {
    saving.value = false
  }
}

// ── Cancelar ──────────────────────────────────────────────────────────────
const cancelling = ref<string | null>(null)
const cancelError = ref('')

async function cancelAppointment(appt: AppointmentRow) {
  if (!confirm('¿Cancelar esta cita?')) return

  cancelling.value = appt.id
  cancelError.value = ''
  try {
    await apiFetch(`/appointments/${appt.code}`, { method: 'DELETE' })
    await refresh()
  } catch (err: unknown) {
    cancelError.value = (err as { data?: { message?: string } })?.data?.message ?? 'No se pudo cancelar la cita.'
  } finally {
    cancelling.value = null
  }
}
</script>

<template>
  <div class="p-4 sm:p-6 lg:p-8">
    <header class="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p class="text-sm uppercase tracking-widest text-muted">UrbanBlade</p>
        <h1 class="mt-1 text-2xl font-semibold text-ink">Mis <span class="text-gold">Citas</span></h1>
        <p class="mt-1 text-sm text-muted">Puedes reagendar o cancelar hasta {{ policyHours }} horas antes.</p>
      </div>
      <NuxtLink to="/barbers" class="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-black hover:bg-gold-dim">
        Reservar nueva cita
      </NuxtLink>
    </header>

    <section v-if="!pending && !error" class="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div class="ui-card p-4"><p class="text-[10px] font-bold uppercase text-muted">Total</p><p class="mt-1 text-xl font-black text-ink">{{ stats.total }}</p></div>
      <div class="ui-card p-4"><p class="text-[10px] font-bold uppercase text-muted">Próximas</p><p class="mt-1 text-xl font-black text-gold">{{ stats.proximas }}</p></div>
      <div class="ui-card p-4"><p class="text-[10px] font-bold uppercase text-muted">Completadas</p><p class="mt-1 text-xl font-black text-emerald-400">{{ stats.completadas }}</p></div>
      <div class="ui-card p-4"><p class="text-[10px] font-bold uppercase text-muted">Canceladas</p><p class="mt-1 text-xl font-black text-red-400">{{ stats.canceladas }}</p></div>
    </section>

    <section v-if="next" class="mb-6 rounded-2xl border border-gold/30 bg-gold/5 p-5">
      <p class="text-[10px] font-bold uppercase tracking-widest text-gold">Tu próxima cita</p>
      <p class="mt-1 font-black text-ink">{{ next.service.nombre }} con {{ next.barber.user.name }}</p>
      <p class="text-sm text-muted">{{ fmtDate(next.fecha) }} · {{ next.hora_inicio?.slice(0, 5) }}</p>
    </section>

    <p v-if="pending" class="text-sm text-muted">Cargando tus citas…</p>
    <p v-else-if="error" class="text-sm text-red-400">No se pudieron cargar tus citas.</p>
    <p v-else-if="!appointments.length" class="rounded-2xl border border-dashed border-line p-12 text-center text-sm text-muted">
      Todavía no tienes citas.
    </p>

    <p v-if="cancelError" class="mb-3 text-sm text-red-400">{{ cancelError }}</p>

    <div v-else class="space-y-4">
      <div v-for="appt in appointments" :key="appt.id" class="ui-card p-5">
        <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p class="font-black text-ink">{{ appt.service.nombre ?? 'Servicio' }}</p>
            <p class="text-sm text-muted">{{ fmtDate(appt.fecha) }} · {{ appt.hora_inicio?.slice(0, 5) }} con {{ appt.barber.user.name ?? '—' }}</p>
          </div>
          <span class="rounded-full border px-2 py-0.5 text-[10px] font-black uppercase" :class="ESTADO_CLASS[appt.estado]">{{ ESTADO_LABEL[appt.estado] ?? appt.estado }}</span>
        </div>
        <p v-if="appt.notas" class="mb-3 text-sm text-muted">{{ appt.notas }}</p>
        <div v-if="canManage(appt)" class="flex gap-2">
          <button type="button" class="rounded-lg border border-line px-3 py-1.5 text-xs text-muted hover:text-ink" @click="openReschedule(appt)">
            Reagendar
          </button>
          <button
            type="button" :disabled="cancelling === appt.id"
            class="rounded-lg border border-red-500/20 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 disabled:opacity-50"
            @click="cancelAppointment(appt)"
          >
            {{ cancelling === appt.id ? 'Cancelando…' : 'Cancelar' }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="showForm" class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" @click.self="showForm = false">
      <div class="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-line bg-card p-6">
        <h2 class="mb-4 text-lg font-semibold text-ink">Reagendar cita</h2>
        <form class="space-y-3" @submit.prevent="submitReschedule">
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="mb-1 block text-xs text-muted">Barbero</label>
              <select v-model="form.barber_id" required class="w-full rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink">
                <option value="" disabled>Selecciona…</option>
                <option v-for="b in barbers" :key="b.id" :value="b.id">{{ b.name }}</option>
              </select>
            </div>
            <div>
              <label class="mb-1 block text-xs text-muted">Servicio</label>
              <select v-model="form.service_id" required class="w-full rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink">
                <option value="" disabled>Selecciona…</option>
                <option v-for="s in services" :key="s.id" :value="s.id">{{ s.nombre }} — ${{ s.precio }}</option>
              </select>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="mb-1 block text-xs text-muted">Fecha</label>
              <input v-model="form.fecha" type="date" required class="w-full rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink">
            </div>
            <div>
              <label class="mb-1 block text-xs text-muted">Hora</label>
              <input v-model="form.hora_inicio" type="time" required class="w-full rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink">
            </div>
          </div>
          <div>
            <label class="mb-1 block text-xs text-muted">Notas</label>
            <textarea v-model="form.notas" rows="2" class="w-full rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink" />
          </div>
          <p v-if="formError" class="text-sm text-red-400">{{ formError }}</p>
          <div class="mt-5 flex gap-3">
            <button type="submit" :disabled="saving" class="flex-1 rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-black hover:bg-gold-dim disabled:opacity-50">
              {{ saving ? 'Guardando…' : 'Reprogramar' }}
            </button>
            <button type="button" class="rounded-lg border border-line px-4 py-2 text-sm text-muted hover:text-ink" @click="showForm = false">Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
