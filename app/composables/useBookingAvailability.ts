import type { ComputedRef, Ref } from 'vue'
import type { DayOption, Slot, SlotGroup } from '~/types/booking'

export interface BookingAvailabilityOptions {
  serviceId: Ref<string>
  barberId: Ref<string>
  date: Ref<string>
  time: Ref<string>
  /** URL de /reservar con la selección actual (para volver tras el login). */
  currentUrl: () => string
}

export interface BookingAvailability {
  days: ComputedRef<DayOption[]>
  slots: Ref<Slot[]>
  slotsPending: Ref<boolean>
  slotsFailed: Ref<boolean>
  groupedSlots: ComputedRef<SlotGroup[]>
  loadSlots: () => Promise<void>
  joiningWaitlist: Ref<boolean>
  waitlistJoined: Ref<boolean>
  waitlistError: Ref<string>
  joinWaitlist: () => Promise<void>
}

// Agrupar horarios por franja del día -- una sola lista plana de 20+ botones
// se siente vacia/monotona aunque haya bastante disponibilidad; agruparlos
// con un encabezado da la sensacion de "hay opciones organizadas" en vez de
// "aqui hay una lista".
const SLOT_GROUPS = [
  { key: 'manana', label: 'Mañana', max: 12 * 60 },
  { key: 'tarde', label: 'Tarde', max: 18 * 60 },
  { key: 'noche', label: 'Noche', max: Infinity },
] as const

/** Días ofrecidos, horarios reales del servidor y lista de espera de la reserva. */
export function useBookingAvailability(options: BookingAvailabilityOptions): BookingAvailability {
  const { serviceId, barberId, date, time, currentUrl } = options
  const { apiFetch } = useApi()
  const { isAuthenticated } = useAuth()

  // ── Días ofrecidos ───────────────────────────────────────────────────────
  const days = computed<DayOption[]>(() => Array.from({ length: 14 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() + i)

    return {
      iso: bookingLocalISO(d),
      weekday: d.toLocaleDateString('es-MX', { weekday: 'short' }),
      day: d.getDate(),
      month: d.toLocaleDateString('es-MX', { month: 'short' }),
      isToday: i === 0,
    }
  }))

  // ── Horarios reales ──────────────────────────────────────────────────────
  const slots = ref<Slot[]>([])
  const slotsPending = ref(false)
  const slotsFailed = ref(false)
  let slotsRequest = 0

  async function loadSlots() {
    const request = ++slotsRequest
    if (!serviceId.value || !barberId.value || !date.value) {
      slots.value = []
      slotsPending.value = false
      return
    }
    slotsPending.value = true
    slotsFailed.value = false
    try {
      const res = await apiFetch<{ slots: Slot[] }>('/availability/slots', {
        query: { barber_id: barberId.value, service_id: serviceId.value, date: date.value },
      })
      if (request !== slotsRequest) return
      slots.value = res.slots ?? []
      if (time.value && !slots.value.some(s => s.time === time.value)) {
        time.value = ''
      }
    }
    catch {
      if (request !== slotsRequest) return
      slotsFailed.value = true
      slots.value = []
    }
    finally {
      if (request === slotsRequest) slotsPending.value = false
    }
  }
  watch([serviceId, barberId, date], loadSlots, { immediate: true })

  const groupedSlots = computed<SlotGroup[]>(() => {
    const groups: SlotGroup[] = SLOT_GROUPS.map(g => ({ ...g, slots: [] }))
    for (const slot of slots.value) {
      const minutes = bookingSlotMinutes(slot.time)
      const group = groups.find(g => minutes < g.max) ?? groups[groups.length - 1]!
      group.slots.push(slot)
    }
    return groups.filter(g => g.slots.length)
  })

  // ── Lista de espera (cuando el día elegido ya no tiene horarios) ─────────
  // Quién puede reservar (canBookHere) lo decide la plantilla: solo cliente o invitado.
  const joiningWaitlist = ref(false)
  const waitlistJoined = ref(false)
  const waitlistError = ref('')
  watch([serviceId, barberId, date], () => {
    waitlistJoined.value = false
    waitlistError.value = ''
  })

  async function joinWaitlist() {
    if (joiningWaitlist.value || !barberId.value || !serviceId.value || !date.value) return

    if (!isAuthenticated.value) {
      await navigateTo(`/login?redirect=${encodeURIComponent(currentUrl())}`)

      return
    }

    joiningWaitlist.value = true
    waitlistError.value = ''
    try {
      await apiFetch('/waitlist', {
        method: 'POST',
        body: { barber_id: barberId.value, service_id: serviceId.value, fecha: date.value },
      })
      waitlistJoined.value = true
    }
    catch (err: unknown) {
      waitlistError.value = (err as { data?: { message?: string } })?.data?.message
        ?? 'No se pudo anotar en la lista de espera.'
    }
    finally {
      joiningWaitlist.value = false
    }
  }

  return {
    days,
    slots,
    slotsPending,
    slotsFailed,
    groupedSlots,
    loadSlots,
    joiningWaitlist,
    waitlistJoined,
    waitlistError,
    joinWaitlist,
  }
}
