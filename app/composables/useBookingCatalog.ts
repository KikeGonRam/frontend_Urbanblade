import type { ComputedRef, Ref } from 'vue'
import type { BarberRow, Barbershop, ProductRow, ServiceRow } from '~/types/booking'

export interface BookingCatalog {
  shop: ComputedRef<Barbershop | null>
  services: ComputedRef<ServiceRow[]>
  servicesPending: Ref<boolean>
  servicesError: Ref<unknown>
  barbers: ComputedRef<BarberRow[]>
  barbersPending: Ref<boolean>
  barbersError: Ref<unknown>
  orderedBarbers: ComputedRef<BarberRow[]>
  suggestedProducts: ComputedRef<ProductRow[]>
  favoriteSaving: Ref<boolean>
  toggleFavorite: (barber: BarberRow) => Promise<void>
  /** Se resuelve cuando los cuatro catálogos públicos ya respondieron (para `await` en el setup). */
  ready: Promise<unknown>
}

/**
 * Catálogos públicos del asistente de reserva (barbería, servicios, barberos y productos sugeridos)
 * más el barbero favorito. Es síncrono a propósito: los `useAsyncData` se registran dentro del setup
 * del componente y quien llama espera `ready`.
 */
export function useBookingCatalog(): BookingCatalog {
  const { apiFetch } = useApi()
  const { isAuthenticated } = useAuth()

  const shopRequest = useAsyncData<{ data: Barbershop }>(
    'reservar-barbershop',
    () => apiFetch('/barbershop'),
  )
  const shop = computed(() => shopRequest.data.value?.data ?? null)

  const servicesRequest = useAsyncData<{ data: ServiceRow[] }>(
    'reservar-services',
    () => apiFetch('/services'),
  )
  const services = computed(() => servicesRequest.data.value?.data ?? [])

  const barbersRequest = useAsyncData<{ data: BarberRow[] }>(
    'reservar-barbers',
    () => apiFetch('/barbers'),
  )
  const barbers = computed(() => barbersRequest.data.value?.data ?? [])

  // Productos sugeridos (paso de confirmar). Reutiliza el mismo catalogo publico de la tienda
  // (GET /products) -- no es un catalogo aparte, solo se sugieren 4 con stock disponible para no
  // abrumar el paso de confirmar con la tienda completa.
  const productsRequest = useAsyncData<{ data: ProductRow[] }>(
    'reservar-products',
    () => apiFetch('/products'),
  )
  const suggestedProducts = computed(() =>
    (productsRequest.data.value?.data ?? []).filter(p => p.stock_actual > 0).slice(0, 4),
  )

  // ── Barbero favorito ───────────────────────────────────────────────────
  // El favorito va primero en la lista (auditoría UX, prioridad 4): el clic más probable queda arriba. El orden
  // relativo del resto no cambia (sort estable).
  const orderedBarbers = computed(() => [...barbers.value].sort((a, b) => Number(b.es_favorito) - Number(a.es_favorito)))
  // Solo preferencia de UI (pre-destacarlo), nunca bloquea reservar con otro.
  // Optimista: actualiza el heart al instante y revierte si el PUT falla, en
  // vez de esperar el round-trip antes de reflejar el click.
  const favoriteSaving = ref(false)
  async function toggleFavorite(barber: BarberRow) {
    if (!isAuthenticated.value || favoriteSaving.value) return
    const next = !barber.es_favorito
    const previous = barbers.value.map(b => ({ id: b.id, es_favorito: b.es_favorito }))
    for (const b of barbers.value) b.es_favorito = b.id === barber.id ? next : false
    favoriteSaving.value = true
    try {
      await apiFetch('/profile/favorite-barber', {
        method: 'PUT',
        body: { barber_id: next ? barber.id : null },
      })
    }
    catch {
      for (const b of barbers.value) {
        const found = previous.find(p => p.id === b.id)
        if (found) b.es_favorito = found.es_favorito
      }
    }
    finally {
      favoriteSaving.value = false
    }
  }

  return {
    shop,
    services,
    servicesPending: servicesRequest.pending,
    servicesError: servicesRequest.error,
    barbers,
    barbersPending: barbersRequest.pending,
    barbersError: barbersRequest.error,
    orderedBarbers,
    suggestedProducts,
    favoriteSaving,
    toggleFavorite,
    ready: Promise.all([shopRequest, servicesRequest, barbersRequest, productsRequest]),
  }
}
