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
import { loadStripe, type Stripe, type StripeCardElement, type StripeElements } from '@stripe/stripe-js'

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
  has_payment?: boolean
  is_chargeable?: boolean
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
const config = useRuntimeConfig()

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

function canPay(appt: AppointmentRow) {
  return Boolean(appt.is_chargeable) && !appt.has_payment
}

function fmtDate(fecha: string) {
  return new Date(`${fecha}T00:00:00`).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ── Reservar / Reagendar ──────────────────────────────────────────────────
// El mismo modal sirve para ambos: editing === null significa "cita nueva".
// AppointmentController::store() ya acepta el rol cliente y reserva a nombre
// del usuario autenticado (crea su perfil Client si aún no existe), así que
// aquí NO se manda client_id — mandarlo sería además ignorado.
const showForm = ref(false)
const editing = ref<AppointmentRow | null>(null)
const form = reactive({ barber_id: '', service_id: '', fecha: '', hora_inicio: '', notas: '' })
const formError = ref('')
const saving = ref(false)

const isEditing = computed(() => editing.value !== null)

function todayIso() {
  const now = new Date()

  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function openCreate(barberId = '') {
  editing.value = null
  form.barber_id = barberId
  form.service_id = ''
  // El backend valida fecha con after_or_equal:today, así que arrancar en hoy
  // evita el 422 más común por dejar el campo en una fecha pasada.
  form.fecha = todayIso()
  form.hora_inicio = ''
  form.notas = ''
  formError.value = ''
  showForm.value = true
}

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

async function submitForm() {
  saving.value = true
  formError.value = ''

  const body = {
    barber_id: form.barber_id,
    service_id: form.service_id,
    fecha: form.fecha,
    hora_inicio: form.hora_inicio,
    notas: form.notas || undefined,
  }

  try {
    if (editing.value) {
      // Appointment usa HasPublicCode -> getRouteKeyName() = 'code', no 'id'.
      await apiFetch(`/appointments/${editing.value.code}`, { method: 'PUT', body })
    } else {
      await apiFetch('/appointments', { method: 'POST', body })
    }
    showForm.value = false
    await refresh()
  } catch (err: unknown) {
    // El 422 del backend trae el motivo real y accionable ("El barbero ya
    // tiene una cita en ese horario.", que respalda el índice único de
    // Fase 3), así que se muestra tal cual en vez de un mensaje genérico.
    formError.value = (err as { data?: { message?: string } })?.data?.message
      ?? (editing.value ? 'No se pudo reprogramar la cita.' : 'No se pudo reservar la cita.')
  } finally {
    saving.value = false
  }
}

// Entrada desde la ficha del barbero (/barbers/[slug] → "Reservar con X"):
// abre el modal con ese barbero ya seleccionado.
const route = useRoute()
onMounted(() => {
  const barberId = typeof route.query.barber === 'string' ? route.query.barber : ''
  if (barberId) openCreate(barberId)
})

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

// ── Pagar con tarjeta (autopago, Fase B) ─────────────────────────────────
// Mismo patrón que payments/index.vue (staff) para el Stripe Element, pero
// sin llamar a POST /payments al final: un cliente no tiene permiso ahí, y
// no lo necesita -- StripeWebhookController::onSucceeded() en barber ya
// registra el Payment en cuanto Stripe confirma el cobro, sin importar quién
// creó el PaymentIntent. Por eso aquí solo hace falta refrescar el listado
// hasta que has_payment se ponga en true.
let stripe: Stripe | null = null
let elements: StripeElements | null = null
let cardElement: StripeCardElement | null = null
const cardElementRef = ref<HTMLDivElement | null>(null)
const stripeConfigured = Boolean(config.public.stripeKey)

const showPay = ref(false)
const payingAppt = ref<AppointmentRow | null>(null)
const payError = ref('')
const payProcessing = ref(false)
const payConfirming = ref(false)
const paySucceeded = ref(false)

async function openPay(appt: AppointmentRow) {
  payingAppt.value = appt
  payError.value = ''
  paySucceeded.value = false
  showPay.value = true
  await nextTick()
  await ensureStripeMounted()
}

function closePay() {
  showPay.value = false
  payingAppt.value = null
  teardownStripe()
}

async function ensureStripeMounted() {
  if (!stripeConfigured || cardElement) return

  stripe = await loadStripe(config.public.stripeKey)
  if (!stripe) return

  elements = stripe.elements()
  cardElement = elements.create('card', {
    style: { base: { fontFamily: 'Figtree, sans-serif', fontSize: '15px', color: 'inherit' }, invalid: { color: '#f87171' } },
  })
  if (cardElementRef.value) cardElement.mount(cardElementRef.value)
  cardElement.on('change', ({ error: elError }) => { payError.value = elError?.message ?? '' })
}

function teardownStripe() {
  cardElement?.unmount()
  cardElement = null
  elements = null
  payError.value = ''
}

async function payWithCard() {
  if (!payingAppt.value || !stripe || !cardElement) return

  payProcessing.value = true
  payError.value = ''
  try {
    const intentRes = await apiFetch<{ data: { client_secret: string } }>('/payments/stripe-intent', {
      method: 'POST',
      body: { appointment_id: payingAppt.value.id },
    })

    const result = await stripe.confirmCardPayment(intentRes.data.client_secret, {
      payment_method: { card: cardElement },
    })

    if (result.error) {
      payError.value = result.error.message ?? 'Error al procesar el pago.'

      return
    }

    if (result.paymentIntent?.status === 'succeeded') {
      paySucceeded.value = true
      await waitForPaymentToRegister()
    }
  } catch (err: unknown) {
    payError.value = (err as { data?: { message?: string } })?.data?.message ?? 'No se pudo conectar con Stripe.'
  } finally {
    payProcessing.value = false
  }
}

// El webhook de Stripe registra el pago de forma asíncrona (normalmente en
// segundos) -- se reintenta el refresh unas cuantas veces en vez de asumir
// que ya está listo justo después de confirmar el cobro con Stripe.
async function waitForPaymentToRegister() {
  const appointmentId = payingAppt.value?.id
  if (!appointmentId) return

  payConfirming.value = true
  try {
    for (let attempt = 0; attempt < 5; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 2000))
      await refresh()
      const updated = appointments.value.find((a) => a.id === appointmentId)
      if (updated?.has_payment) {
        closePay()

        return
      }
    }
  } finally {
    payConfirming.value = false
  }
}

onUnmounted(() => teardownStripe())
</script>

<template>
  <div class="p-4 sm:p-6 lg:p-8">
    <header class="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p class="text-sm uppercase tracking-widest text-muted">UrbanBlade</p>
        <h1 class="mt-1 text-2xl font-semibold text-ink">Mis <span class="text-gold">Citas</span></h1>
        <p class="mt-1 text-sm text-muted">Puedes reagendar o cancelar hasta {{ policyHours }} horas antes.</p>
      </div>
      <div class="flex items-center gap-2">
        <NuxtLink to="/barbers" class="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-muted hover:text-ink">
          Ver barberos
        </NuxtLink>
        <button type="button" class="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-black hover:bg-gold-dim" @click="openCreate()">
          Reservar nueva cita
        </button>
      </div>
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
        <div class="flex flex-wrap gap-2">
          <button
            v-if="canPay(appt) && stripeConfigured" type="button"
            class="rounded-lg bg-gold px-3 py-1.5 text-xs font-semibold text-black hover:bg-gold-dim"
            @click="openPay(appt)"
          >
            Pagar con tarjeta
          </button>
          <template v-if="canManage(appt)">
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
          </template>
        </div>
      </div>
    </div>

    <div v-if="showForm" class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" @click.self="showForm = false">
      <div class="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-line bg-card p-6">
        <h2 class="mb-4 text-lg font-semibold text-ink">{{ isEditing ? 'Reagendar cita' : 'Reservar cita' }}</h2>
        <form class="space-y-3" @submit.prevent="submitForm">
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
              {{ saving ? 'Guardando…' : isEditing ? 'Reprogramar' : 'Reservar' }}
            </button>
            <button type="button" class="rounded-lg border border-line px-4 py-2 text-sm text-muted hover:text-ink" @click="showForm = false">Cancelar</button>
          </div>
        </form>
      </div>
    </div>

    <div v-if="showPay" class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" @click.self="!payProcessing && !payConfirming && closePay()">
      <div class="w-full max-w-sm rounded-2xl border border-line bg-card p-6">
        <h2 class="mb-1 text-lg font-semibold text-ink">Pagar con tarjeta</h2>
        <p class="mb-4 text-sm text-muted">
          {{ payingAppt?.service.nombre }} · {{ payingAppt ? fmtDate(payingAppt.fecha) : '' }}
        </p>

        <template v-if="!paySucceeded">
          <div ref="cardElementRef" class="rounded-lg border border-line bg-main px-3 py-3" />
          <p v-if="payError" class="mt-2 text-sm text-red-400">{{ payError }}</p>
          <p class="mt-2 text-[11px] text-muted">Beta: el monto se calcula del lado del servidor, nunca se envía desde aquí.</p>
          <div class="mt-5 flex gap-3">
            <button
              type="button" :disabled="payProcessing" class="flex-1 rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-black hover:bg-gold-dim disabled:opacity-50"
              @click="payWithCard"
            >
              {{ payProcessing ? 'Procesando…' : 'Pagar' }}
            </button>
            <button type="button" :disabled="payProcessing" class="rounded-lg border border-line px-4 py-2 text-sm text-muted hover:text-ink" @click="closePay">
              Cancelar
            </button>
          </div>
        </template>

        <template v-else>
          <div class="rounded-lg border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm text-emerald-300">
            Pago recibido. {{ payConfirming ? 'Confirmando con el sistema…' : 'Listo.' }}
          </div>
          <button type="button" class="mt-4 w-full rounded-lg border border-line px-4 py-2 text-sm text-muted hover:text-ink" @click="closePay">
            Cerrar
          </button>
        </template>
      </div>
    </div>
  </div>
</template>
