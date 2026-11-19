import type { ComputedRef, Ref } from 'vue'
import type { BarberRow, ServiceRow } from '~/types/booking'
import type { BookingAvailability } from '~/composables/useBookingAvailability'
import type { BookingCatalog } from '~/composables/useBookingCatalog'
import type { BookingPayment } from '~/composables/useBookingPayment'
import type { BookingPricing } from '~/composables/useBookingPricing'

export const BOOKING_STEPS = ['Servicio', 'Barbero', 'Horario', 'Confirmar'] as const

export interface BookingWizardOptions {
  /** Barbero preseleccionado (p. ej. desde la ficha del barbero). */
  initialBarber: string
  onBusy: (value: boolean) => void
  onConfirmed: (code: string) => void
}

export interface BookingWizard {
  catalog: BookingCatalog
  availability: BookingAvailability
  pricing: BookingPricing
  payment: BookingPayment
  serviceId: Ref<string>
  barberId: Ref<string>
  date: Ref<string>
  time: Ref<string>
  notes: Ref<string>
  step: ComputedRef<number>
  selectedService: ComputedRef<ServiceRow | null>
  selectedBarber: ComputedRef<BarberRow | null>
  canBookHere: ComputedRef<boolean>
  saving: Ref<boolean>
  submitError: Ref<string>
  submitErrorEl: Ref<HTMLElement | null>
  confirmedCode: Ref<string>
  productsWarning: Ref<string>
  acceptsNoShowFee: Ref<boolean>
  pickService: (id: string) => void
  pickBarber: (id: string) => void
  pickDate: (iso: string) => void
  pickTime: (value: string) => void
  goToStep: (target: number) => void
  confirm: () => Promise<void>
  /** Se resuelve cuando los catálogos públicos ya cargaron (para `await` en el setup). */
  ready: Promise<unknown>
}

/**
 * Máquina de pasos y confirmación de la reserva. Compone catálogo, disponibilidad, totales y pago;
 * el servidor es la autoridad de precios, horarios y conflictos (422).
 */
export function useBookingWizard(options: BookingWizardOptions): BookingWizard {
  const { apiFetch } = useApi()
  const { isAuthenticated, hasRole } = useAuth()
  const route = useRoute()

  // ── Estado del asistente ────────────────────────────────────────────────
  // La query SOLO se lee al entrar (enlace/QR con ?servicio=, y el regreso del
  // login) y se vuelve a escribir UNA vez, al saltar al login (ver currentUrl()).
  // Deliberadamente NO se espeja en la URL en cada selección: app.vue monta la
  // página con :key="route.fullPath", así que cada cambio de query remonta el
  // componente completo, vuelve a pedir los catálogos y reproduce la transición
  // de página -- un remonte por cada toque del visitante.
  const serviceId = ref(typeof route.query.servicio === 'string' ? route.query.servicio : '')
  const barberId = ref(options.initialBarber || (typeof route.query.barbero === 'string' ? route.query.barbero : ''))
  const date = ref(typeof route.query.fecha === 'string' ? route.query.fecha : '')
  const time = ref(typeof route.query.hora === 'string' ? route.query.hora : '')
  const notes = ref('')
  const activeStep = ref<number | null>(null)

  const catalog = useBookingCatalog()
  const selectedService = computed(() => catalog.services.value.find(s => s.id === serviceId.value) ?? null)
  const selectedBarber = computed(() => catalog.barbers.value.find(b => b.id === barberId.value) ?? null)

  function currentUrl() {
    const q = new URLSearchParams({
      servicio: serviceId.value,
      barbero: barberId.value,
      fecha: date.value,
      hora: time.value,
    }).toString()

    return `/reservar?${q}`
  }

  const availability = useBookingAvailability({ serviceId, barberId, date, time, currentUrl })
  const pricing = useBookingPricing(selectedService, catalog.suggestedProducts)
  const payment = useBookingPayment()

  // ── Pasos ───────────────────────────────────────────────────────────────
  const step = computed(() => {
    if (activeStep.value !== null) return activeStep.value
    if (!serviceId.value) return 0
    if (!barberId.value) return 1
    if (!date.value || !time.value) return 2

    return 3
  })

  function pickService(id: string) {
    activeStep.value = null
    serviceId.value = id
    time.value = ''
  }
  function pickBarber(id: string) {
    activeStep.value = null
    barberId.value = id
    time.value = ''
  }
  function pickDate(iso: string) {
    date.value = iso
    time.value = ''
    activeStep.value = null
  }
  function pickTime(value: string) {
    time.value = value
    activeStep.value = null
  }
  function goToStep(target: number) {
    // Revisar un paso no destruye el borrador. Cambiar la selección invalida la hora.
    activeStep.value = target
  }

  // ── Confirmación ────────────────────────────────────────────────────────
  // El backend solo deja reservar para sí mismo al rol cliente; admin y
  // recepción necesitan client_id (lo hacen desde /appointments) y un barbero
  // recibe 403. Se detecta antes de enviar para no mostrar un error críptico.
  const canBookHere = computed(() => !isAuthenticated.value || hasRole('cliente'))

  const saving = ref(false)
  watch(saving, value => options.onBusy(value))
  const submitError = ref('')
  const submitErrorEl = ref<HTMLElement | null>(null)
  const confirmedCode = ref('')
  const productsWarning = ref('')
  // El cliente acepta el cargo por inasistencia en el último paso (el backend guarda cuándo lo aceptó).
  const acceptsNoShowFee = ref(false)

  async function confirm() {
    if (saving.value || availability.slotsPending.value || !selectedService.value || !selectedBarber.value || !time.value) return
    submitError.value = ''
    if (!isAuthenticated.value) {
      // Única puerta de sesión del flujo, y solo al final: la selección viaja
      // en ?redirect para volver exactamente a este punto.
      await navigateTo(`/login?redirect=${encodeURIComponent(currentUrl())}`)

      return
    }
    if (!acceptsNoShowFee.value) {
      submitError.value = 'Para reservar acepta el cargo por inasistencia.'

      return
    }
    if (payment.payChoice.value === 'ahora_tarjeta' && !payment.isCardReady()) {
      submitError.value = 'El formulario de tarjeta todavía no está listo. Espera un momento e intenta de nuevo.'

      return
    }
    if (payment.payChoice.value === 'ahora_transferencia' && !payment.transferReceipt.value) {
      submitError.value = 'Sube tu comprobante de transferencia para continuar.'

      return
    }

    saving.value = true
    try {
      const res = await apiFetch<{ data: { code: string }, productos_error?: string | null }>('/appointments', {
        method: 'POST',
        body: {
          barber_id: barberId.value,
          service_id: serviceId.value,
          fecha: date.value,
          hora_inicio: time.value,
          notas: notes.value || undefined,
          productos: pricing.selectedProducts.value.length
            ? pricing.selectedProducts.value.map(p => ({ product_id: p.id, cantidad: 1 }))
            : undefined,
          propina_sugerida: pricing.tipAmount.value > 0 ? pricing.tipAmount.value : undefined,
          pagar_ahora: payment.payChoice.value !== 'despues' || undefined,
          acepta_cargo_inasistencia: acceptsNoShowFee.value || undefined,
        },
      })
      const code = res.data?.code ?? ''
      // La cita ya quedo creada aunque los productos fallen (ver backend): se
      // avisa aparte en vez de tratarlo como un error de la reserva completa.
      productsWarning.value = res.productos_error ?? ''

      // El cobro (si eligio pagar ahora) va DESPUES de crear la cita: reutiliza
      // los mismos endpoints del deposito anti-no-show. Si el cobro falla, la
      // cita ya quedo reservada -- se avisa aparte, nunca se revierte la cita.
      // IMPORTANTE: confirmedCode se asigna DESPUES de cobrar. Asignarlo antes
      // cambia la vista a "cita registrada", que desmonta el campo de tarjeta
      // de Stripe y el confirmCardPayment falla con "Element not mounted"
      // (detectado en una prueba real en AWS).
      if (code && payment.payChoice.value !== 'despues') {
        await payment.chargeBookingPayment(code)
      }

      confirmedCode.value = code
      if (code) options.onConfirmed(code)
    }
    catch (err: unknown) {
      // El 422 del backend trae el motivo real ("El barbero ya tiene una cita
      // en ese horario.") y es la autoridad sobre conflictos: se muestra tal
      // cual y se refrescan los horarios para que el usuario reelija.
      submitError.value = (err as { data?: { message?: string } })?.data?.message
        ?? 'No se pudo confirmar la cita. Intenta con otro horario.'
      await availability.loadSlots()
      time.value = ''
      activeStep.value = null
      // El mensaje vive arriba de los pasos: si la persona estaba abajo no lo veía y solo notaba que el
      // asistente regresaba al horario. Se lleva a la vista para que sepa por qué.
      await nextTick()
      submitErrorEl.value?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
    finally {
      saving.value = false
    }
  }

  return {
    catalog,
    availability,
    pricing,
    payment,
    serviceId,
    barberId,
    date,
    time,
    notes,
    step,
    selectedService,
    selectedBarber,
    canBookHere,
    saving,
    submitError,
    submitErrorEl,
    confirmedCode,
    productsWarning,
    acceptsNoShowFee,
    pickService,
    pickBarber,
    pickDate,
    pickTime,
    goToStep,
    confirm,
    ready: catalog.ready,
  }
}
