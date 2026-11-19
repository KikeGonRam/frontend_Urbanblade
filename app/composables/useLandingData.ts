import type { LandingBarber, LandingBarbershop, LandingPublicStats, LandingService, LandingStat } from '~/types/landing'

/**
 * Datos públicos de la portada. /services, /barbers y /barbershop no llevan token.
 *
 * Servicios y maestros son listas grandes: se piden solo en cliente (server:false) para no
 * retrasar el primer byte. La ficha del negocio sí se resuelve en el servidor porque alimenta
 * el teléfono, la dirección, el horario y las redes del JSON-LD (con server:false, Google y
 * cualquier lector sin JavaScript recibían un negocio vacío).
 *
 * Las tres peticiones se lanzan a la vez; la página espera `ready` en su setup, igual que antes
 * esperaba cada una, pero sin encadenarlas una tras otra.
 */
export function useLandingData() {
  const { apiFetch } = useApi()

  const servicesReq = useAsyncData<{ data: LandingService[] }>(
    'landing-services',
    () => apiFetch('/services'),
    { server: false },
  )
  const barbersReq = useAsyncData<{ data: LandingBarber[] }>(
    'landing-barbers',
    () => apiFetch('/barbers'),
    { server: false },
  )
  const shopReq = useAsyncData<{ data: LandingBarbershop }>(
    'landing-barbershop',
    () => apiFetch('/barbershop'),
  )

  const servicesAll = computed(() => servicesReq.data.value?.data ?? [])
  const barbersAll = computed(() => barbersReq.data.value?.data ?? [])
  const barbers = computed(() => barbersAll.value.slice(0, 4))
  const fewBarbers = computed(() => barbers.value.length <= 2)
  const shop = computed(() => shopReq.data.value?.data ?? null)

  const publicStats = computed<LandingPublicStats>(() => {
    const allBarbers = barbersAll.value
    const totalReviews = allBarbers.reduce((sum, barber) => sum + (barber.total_reviews ?? 0), 0)
    const ratedBarbers = allBarbers.filter(barber => typeof barber.avg_rating === 'number')
    const averageRating = ratedBarbers.length
      ? ratedBarbers.reduce((sum, barber) => sum + Number(barber.avg_rating ?? 0), 0) / ratedBarbers.length
      : 0

    return {
      barbers: allBarbers.length,
      services: servicesAll.value.length,
      reviews: totalReviews,
      rating: averageRating ? averageRating.toFixed(1) : '—',
    }
  })

  const statItems = computed(() => {
    const st = publicStats.value
    const items: LandingStat[] = []
    if (st.barbers > 0) items.push({ value: st.barbers, suffix: '', label: st.barbers === 1 ? 'Maestro activo' : 'Maestros activos' })
    if (st.services > 0) items.push({ value: st.services, suffix: '', label: st.services === 1 ? 'Servicio disponible' : 'Servicios disponibles' })
    if (st.reviews > 0) items.push({ value: st.reviews, suffix: '', label: st.reviews === 1 ? 'Reseña publicada' : 'Reseñas publicadas' })
    if (st.rating !== '—') items.push({ value: st.rating, suffix: '★', label: 'Calificación del equipo' })
    return items
  })

  // Rango de precios real del catálogo (p. ej. "$90 – $450"), no un valor inventado.
  const priceRange = computed(() => {
    const precios = servicesAll.value.map(s => s.precio).filter((p): p is number => typeof p === 'number' && p > 0)
    if (!precios.length) return null
    const min = Math.min(...precios)
    const max = Math.max(...precios)
    return min === max ? `$${min}` : `$${min} – $${max}`
  })

  return {
    ready: Promise.all([servicesReq, barbersReq, shopReq]),
    servicesAll,
    servicesPending: servicesReq.pending,
    barbers,
    barbersPending: barbersReq.pending,
    fewBarbers,
    shop,
    publicStats,
    statItems,
    priceRange,
  }
}
