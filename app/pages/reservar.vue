<script setup lang="ts">
/*
 * Reserva pública (P0-2 de urbanblade-market-web): servicio → barbero →
 * horario real → confirmación, desde un enlace o QR, SIN exigir cuenta para
 * ver disponibilidad. Hasta ahora el único camino para reservar era
 * /my/appointments, detrás de middleware ['auth','client'], así que cada CTA
 * "Reservar" de la landing mandaba a /register: el visitante chocaba con un
 * muro de registro antes de ver un solo horario.
 *
 * La cuenta se pide solo en el último paso, conservando la selección en la
 * query (?servicio&barbero&fecha&hora) para que el viaje al login la
 * devuelva intacta y para que un enlace compartido llegue con el servicio ya
 * elegido.
 *
 * Endpoints: todos públicos salvo el POST final.
 *   GET /barbershop, /services, /barbers, /availability/slots  → sin token
 *   POST /appointments                                          → con token
 */
definePageMeta({ layout: 'public' })

useSeoMeta({
  title: 'Reservar cita — UrbanBlade',
  description: 'Elige servicio, barbero y horario disponible. Reserva tu cita en menos de un minuto.',
})

interface ServiceRow {
  id: string
  nombre: string
  categoria: string | null
  precio: number
  duracion_min: number
  descripcion: string | null
}
interface BarberRow {
  id: string
  slug: string | null
  user: { id: string, name: string } | null
  especialidades: string | null
  foto: string | null
}
interface Slot { time: string, label: string }
interface Barbershop {
  nombre: string | null
  direccion: string | null
  telefono: string | null
  horario_apertura: string | null
  horario_cierre: string | null
  politica_cancelacion: number | null
}

const { apiFetch } = useApi()
const { isAuthenticated, hasRole } = useAuth()
const route = useRoute()

// ── Estado del asistente ──────────────────────────────────────────────────
// La query SOLO se lee al entrar (enlace/QR con ?servicio=, y el regreso del
// login) y se vuelve a escribir UNA vez, al saltar al login (ver currentUrl()).
// Deliberadamente NO se espeja en la URL en cada selección: app.vue monta la
// página con :key="route.fullPath", así que cada cambio de query remonta el
// componente completo, vuelve a pedir los catálogos y reproduce la transición
// de página -- un remonte por cada toque del visitante.
const serviceId = ref(typeof route.query.servicio === 'string' ? route.query.servicio : '')
const barberId = ref(typeof route.query.barbero === 'string' ? route.query.barbero : '')
const date = ref(typeof route.query.fecha === 'string' ? route.query.fecha : '')
const time = ref(typeof route.query.hora === 'string' ? route.query.hora : '')

// ── Datos públicos ────────────────────────────────────────────────────────
const { data: shopData } = await useAsyncData<{ data: Barbershop }>(
  'reservar-barbershop',
  () => apiFetch('/barbershop'),
)
const shop = computed(() => shopData.value?.data ?? null)

const { data: servicesData, pending: servicesPending, error: servicesError } = await useAsyncData<{ data: ServiceRow[] }>(
  'reservar-services',
  () => apiFetch('/services'),
)
const services = computed(() => servicesData.value?.data ?? [])

const { data: barbersData, pending: barbersPending, error: barbersError } = await useAsyncData<{ data: BarberRow[] }>(
  'reservar-barbers',
  () => apiFetch('/barbers'),
)
const barbers = computed(() => barbersData.value?.data ?? [])

const selectedService = computed(() => services.value.find(s => s.id === serviceId.value) ?? null)
const selectedBarber = computed(() => barbers.value.find(b => b.id === barberId.value) ?? null)

// ── Días ofrecidos ────────────────────────────────────────────────────────
// Fechas armadas en horario local, nunca con toISOString(): el backend valida
// 'after_or_equal:today' contra America/Mexico_City, y en UTC-6 el ISO de
// "hoy por la noche" ya cae en mañana.
function localISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const days = computed(() => Array.from({ length: 14 }, (_, i) => {
  const d = new Date()
  d.setDate(d.getDate() + i)

  return {
    iso: localISO(d),
    weekday: d.toLocaleDateString('es-MX', { weekday: 'short' }),
    day: d.getDate(),
    month: d.toLocaleDateString('es-MX', { month: 'short' }),
    isToday: i === 0,
  }
}))

// ── Horarios reales ───────────────────────────────────────────────────────
const slots = ref<Slot[]>([])
const slotsPending = ref(false)
const slotsFailed = ref(false)

async function loadSlots() {
  if (!serviceId.value || !barberId.value || !date.value) {
    slots.value = []

    return
  }
  slotsPending.value = true
  slotsFailed.value = false
  try {
    const res = await apiFetch<{ slots: Slot[] }>('/availability/slots', {
      query: { barber_id: barberId.value, service_id: serviceId.value, date: date.value },
    })
    slots.value = res.slots ?? []
    if (time.value && !slots.value.some(s => s.time === time.value)) {
      time.value = ''
    }
  }
  catch {
    slotsFailed.value = true
    slots.value = []
  }
  finally {
    slotsPending.value = false
  }
}
watch([serviceId, barberId, date], loadSlots, { immediate: true })

// ── Pasos ─────────────────────────────────────────────────────────────────
const STEPS = ['Servicio', 'Barbero', 'Horario', 'Confirmar'] as const
const step = computed(() => {
  if (!serviceId.value) return 0
  if (!barberId.value) return 1
  if (!date.value || !time.value) return 2

  return 3
})

function pickService(id: string) {
  serviceId.value = id
  time.value = ''
}
function pickBarber(id: string) {
  barberId.value = id
  time.value = ''
}
function goToStep(target: number) {
  // Volver atrás limpia solo lo que queda por debajo, para no perder de más.
  if (target <= 0) { serviceId.value = ''; barberId.value = ''; date.value = ''; time.value = '' }
  else if (target === 1) { barberId.value = ''; date.value = ''; time.value = '' }
  else if (target === 2) { time.value = '' }
}

// ── Confirmación ──────────────────────────────────────────────────────────
// El backend solo deja reservar para sí mismo al rol cliente; admin y
// recepción necesitan client_id (lo hacen desde /appointments) y un barbero
// recibe 403. Se detecta antes de enviar para no mostrar un error críptico.
const isStaff = computed(() => hasRole('administrador') || hasRole('recepcionista'))
const isBarber = computed(() => hasRole('barbero'))
const canBookHere = computed(() => !isAuthenticated.value || (!isStaff.value && !isBarber.value))

const saving = ref(false)
const submitError = ref('')
const confirmedCode = ref('')

function currentUrl() {
  const q = new URLSearchParams({
    servicio: serviceId.value,
    barbero: barberId.value,
    fecha: date.value,
    hora: time.value,
  }).toString()

  return `/reservar?${q}`
}

async function confirm() {
  submitError.value = ''
  if (!isAuthenticated.value) {
    // Única puerta de sesión del flujo, y solo al final: la selección viaja
    // en ?redirect para volver exactamente a este punto.
    await navigateTo(`/login?redirect=${encodeURIComponent(currentUrl())}`)

    return
  }

  saving.value = true
  try {
    const res = await apiFetch<{ data: { code: string } }>('/appointments', {
      method: 'POST',
      body: {
        barber_id: barberId.value,
        service_id: serviceId.value,
        fecha: date.value,
        hora_inicio: time.value,
      },
    })
    confirmedCode.value = res.data?.code ?? ''
  }
  catch (err: unknown) {
    // El 422 del backend trae el motivo real ("El barbero ya tiene una cita
    // en ese horario.") y es la autoridad sobre conflictos: se muestra tal
    // cual y se refrescan los horarios para que el usuario reelija.
    submitError.value = (err as { data?: { message?: string } })?.data?.message
      ?? 'No se pudo confirmar la cita. Intenta con otro horario.'
    await loadSlots()
    time.value = ''
  }
  finally {
    saving.value = false
  }
}

function currency(n: number) {
  return `$${Math.round(n).toLocaleString('es-MX')}`
}
function prettyDate(iso: string) {
  // Sin guarda, un iso vacío produce "Invalid Date" visible en pantalla.
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return ''

  return new Date(y, m - 1, d).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })
}
</script>

<template>
  <div class="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
    <!-- Confirmación -->
    <section v-if="confirmedCode" class="ui-card p-6 text-center sm:p-10">
      <BrandMascot mascot="bladebot" state="success" size="md" class="mx-auto" />
      <h1 class="mt-4 text-2xl font-black uppercase tracking-tight text-ink">
        Cita confirmada
      </h1>
      <p class="mt-2 text-sm text-muted">
        Tu código de cita es
        <strong class="font-black tracking-widest text-gold">{{ confirmedCode }}</strong>
      </p>
      <dl class="mx-auto mt-6 max-w-sm space-y-2 text-left text-sm">
        <div class="flex justify-between gap-4 border-b border-line pb-2">
          <dt class="text-muted">Servicio</dt>
          <dd class="text-right font-bold text-ink">{{ selectedService?.nombre }}</dd>
        </div>
        <div class="flex justify-between gap-4 border-b border-line pb-2">
          <dt class="text-muted">Barbero</dt>
          <dd class="text-right font-bold text-ink">{{ selectedBarber?.user?.name }}</dd>
        </div>
        <div class="flex justify-between gap-4">
          <dt class="text-muted">Cuándo</dt>
          <dd class="text-right font-bold text-ink">{{ prettyDate(date) }} · {{ time }}</dd>
        </div>
      </dl>
      <p v-if="shop?.politica_cancelacion" class="mt-6 text-xs leading-5 text-muted">
        Puedes cancelar o reprogramar hasta {{ shop.politica_cancelacion }} horas antes de tu cita.
      </p>
      <div class="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <NuxtLink to="/my/appointments" class="ui-btn px-8 py-3">Ver mis citas</NuxtLink>
        <NuxtLink to="/" class="ui-btn-secondary px-8 py-3">Volver al inicio</NuxtLink>
      </div>
    </section>

    <template v-else>
      <header class="mb-8">
        <p class="text-[10px] font-black uppercase tracking-[0.2em] text-gold">
          {{ shop?.nombre || 'UrbanBlade' }}
        </p>
        <h1 class="mt-2 text-3xl font-black uppercase tracking-tight text-ink">
          Reserva tu cita
        </h1>
        <p v-if="shop?.direccion || shop?.horario_apertura" class="mt-2 text-sm text-muted">
          <span v-if="shop?.direccion">{{ shop.direccion }}</span>
          <span v-if="shop?.direccion && shop?.horario_apertura" aria-hidden="true"> · </span>
          <span v-if="shop?.horario_apertura && shop?.horario_cierre">
            {{ shop.horario_apertura }} a {{ shop.horario_cierre }}
          </span>
        </p>
      </header>

      <!-- Progreso -->
      <ol class="mb-8 flex items-center gap-1 text-[10px] font-black uppercase tracking-widest sm:gap-2">
        <li v-for="(label, i) in STEPS" :key="label" class="flex flex-1 items-center gap-1 sm:gap-2">
          <button
            type="button"
            class="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border px-2 py-2 transition-colors sm:px-3"
            :class="i === step
              ? 'border-gold/40 bg-gold/10 text-gold'
              : i < step ? 'border-line text-ink hover:border-gold/30' : 'border-line text-muted'"
            :disabled="i > step"
            :aria-current="i === step ? 'step' : undefined"
            @click="goToStep(i)"
          >
            <span class="grid h-5 w-5 place-items-center rounded-full border border-current text-[9px]">{{ i + 1 }}</span>
            <span class="hidden sm:inline">{{ label }}</span>
          </button>
        </li>
      </ol>

      <!-- Paso 1: servicio -->
      <section v-if="step === 0" aria-labelledby="paso-servicio">
        <h2 id="paso-servicio" class="mb-4 text-sm font-black uppercase tracking-widest text-ink">
          1. Elige tu servicio
        </h2>
        <BrandStatePanel v-if="servicesPending" mascot="bladebot" state="waiting" title="Cargando servicios…" />
        <BrandStatePanel
          v-else-if="servicesError" mascot="bruno" state="error" tone="danger"
          title="No se pudo cargar el catálogo" description="Revisa tu conexión e inténtalo nuevamente."
        />
        <BrandStatePanel
          v-else-if="!services.length" mascot="nava" state="empty"
          title="Aún no hay servicios publicados" description="Vuelve pronto o comunícate con la barbería."
        />
        <div v-else class="grid gap-3 sm:grid-cols-2">
          <button
            v-for="service in services" :key="service.id" type="button"
            class="ui-card flex min-h-11 items-center justify-between gap-4 p-4 text-left transition-colors hover:border-gold/40"
            @click="pickService(service.id)"
          >
            <span class="min-w-0">
              <span class="block truncate text-sm font-black text-ink">{{ service.nombre }}</span>
              <span class="mt-0.5 block text-xs text-muted">{{ service.duracion_min }} min</span>
            </span>
            <span class="shrink-0 text-sm font-black text-gold">{{ currency(service.precio) }}</span>
          </button>
        </div>
      </section>

      <!-- Paso 2: barbero -->
      <section v-if="step === 1" aria-labelledby="paso-barbero">
        <h2 id="paso-barbero" class="mb-4 text-sm font-black uppercase tracking-widest text-ink">
          2. Elige tu barbero
        </h2>
        <BrandStatePanel v-if="barbersPending" mascot="bladebot" state="waiting" title="Cargando barberos…" />
        <BrandStatePanel
          v-else-if="barbersError" mascot="bruno" state="error" tone="danger"
          title="No se pudo cargar el equipo" description="Revisa tu conexión e inténtalo nuevamente."
        />
        <BrandStatePanel
          v-else-if="!barbers.length" mascot="nava" state="empty"
          title="Aún no hay barberos activos" description="Vuelve pronto o comunícate con la barbería."
        />
        <div v-else class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <button
            v-for="barber in barbers" :key="barber.id" type="button"
            class="ui-card flex min-h-11 items-center gap-3 p-4 text-left transition-colors hover:border-gold/40"
            @click="pickBarber(barber.id)"
          >
            <img
              v-if="barber.foto" :src="barber.foto" :alt="`Foto de ${barber.user?.name}`"
              class="h-12 w-12 shrink-0 rounded-full object-cover" loading="lazy" decoding="async"
            >
            <span v-else class="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-gold/15 text-xs font-black text-gold" aria-hidden="true">
              {{ (barber.user?.name ?? '?').slice(0, 1) }}
            </span>
            <span class="min-w-0">
              <span class="block truncate text-sm font-black text-ink">{{ barber.user?.name }}</span>
              <span class="mt-0.5 block truncate text-xs text-muted">{{ barber.especialidades || 'Barbero' }}</span>
            </span>
          </button>
        </div>
      </section>

      <!-- Paso 3: horario -->
      <section v-if="step === 2" aria-labelledby="paso-horario">
        <h2 id="paso-horario" class="mb-4 text-sm font-black uppercase tracking-widest text-ink">
          3. Elige día y hora
        </h2>

        <div class="-mx-1 mb-5 flex gap-2 overflow-x-auto px-1 pb-2" role="group" aria-label="Elegir día">
          <button
            v-for="d in days" :key="d.iso" type="button"
            class="flex min-h-11 w-16 shrink-0 flex-col items-center justify-center rounded-xl border py-2 transition-colors"
            :class="date === d.iso ? 'border-gold bg-gold/10 text-gold' : 'border-line text-muted hover:border-gold/30'"
            :aria-pressed="date === d.iso"
            @click="date = d.iso; time = ''"
          >
            <span class="text-[9px] font-black uppercase tracking-widest">{{ d.isToday ? 'Hoy' : d.weekday }}</span>
            <span class="text-lg font-black leading-none text-ink" :class="date === d.iso && 'text-gold'">{{ d.day }}</span>
            <span class="text-[9px] uppercase">{{ d.month }}</span>
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
        <BrandStatePanel
          v-else-if="!slots.length" mascot="nava" state="empty"
          title="Sin horarios libres ese día"
          description="Prueba con otra fecha o con otro barbero del equipo."
        />
        <div v-else class="grid grid-cols-3 gap-2 sm:grid-cols-5">
          <button
            v-for="slot in slots" :key="slot.time" type="button"
            class="min-h-11 rounded-xl border px-2 py-2 text-sm font-bold transition-colors"
            :class="time === slot.time ? 'border-gold bg-gold/10 text-gold' : 'border-line text-ink hover:border-gold/30'"
            :aria-pressed="time === slot.time"
            @click="time = slot.time"
          >
            {{ slot.time }}
          </button>
        </div>
      </section>

      <!-- Paso 4: confirmar -->
      <section v-if="step === 3" aria-labelledby="paso-confirmar">
        <h2 id="paso-confirmar" class="mb-4 text-sm font-black uppercase tracking-widest text-ink">
          4. Confirma tu cita
        </h2>
        <div class="ui-card p-5">
          <dl class="space-y-3 text-sm">
            <div class="flex items-start justify-between gap-4">
              <dt class="text-muted">Servicio</dt>
              <dd class="text-right font-bold text-ink">
                {{ selectedService?.nombre }}
                <span class="block text-xs font-normal text-muted">{{ selectedService?.duracion_min }} min</span>
              </dd>
            </div>
            <div class="flex items-start justify-between gap-4">
              <dt class="text-muted">Barbero</dt>
              <dd class="text-right font-bold text-ink">{{ selectedBarber?.user?.name }}</dd>
            </div>
            <div class="flex items-start justify-between gap-4">
              <dt class="text-muted">Cuándo</dt>
              <dd class="text-right font-bold text-ink">{{ prettyDate(date) }} · {{ time }}</dd>
            </div>
            <div class="flex items-start justify-between gap-4 border-t border-line pt-3">
              <dt class="font-black uppercase tracking-widest text-ink">Total</dt>
              <dd class="text-right text-lg font-black text-gold">{{ currency(selectedService?.precio ?? 0) }}</dd>
            </div>
          </dl>

          <p v-if="shop?.politica_cancelacion" class="mt-4 border-t border-line pt-4 text-xs leading-5 text-muted">
            Puedes cancelar o reprogramar sin costo hasta
            {{ shop.politica_cancelacion }} horas antes de tu cita.
          </p>

          <p v-if="submitError" role="alert" class="mt-4 text-sm font-bold text-red-400">
            {{ submitError }}
          </p>

          <!-- Staff y barberos no pueden reservar para sí mismos en el backend -->
          <div v-if="!canBookHere" class="mt-5 rounded-xl border border-dashed border-line p-4 text-center">
            <p class="text-sm text-muted">
              Tu cuenta es de personal de la barbería. Las citas a nombre de un cliente se agendan desde la agenda del panel.
            </p>
            <NuxtLink to="/appointments" class="ui-btn mt-3 inline-flex px-6 py-2.5">Ir a la agenda</NuxtLink>
          </div>

          <template v-else>
            <button
              type="button" class="ui-btn mt-5 w-full py-4 text-[12px] tracking-[0.15em]"
              :disabled="saving" @click="confirm"
            >
              {{ saving ? 'Confirmando…' : isAuthenticated ? 'Confirmar cita' : 'Continuar y confirmar' }}
            </button>
            <p v-if="!isAuthenticated" class="mt-3 text-center text-xs text-muted">
              Te pediremos iniciar sesión o crear tu cuenta solo para guardar esta cita. No perderás lo que elegiste.
            </p>
          </template>
        </div>
      </section>
    </template>
  </div>
</template>
