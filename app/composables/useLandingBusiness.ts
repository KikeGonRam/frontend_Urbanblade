import type { LandingBarbershop, LandingContactRow, LandingSocial } from '~/types/landing'

/*
 * Datos de contacto derivados de la ficha del negocio (GET /barbershop). Antes eran literales
 * en la página, así que cualquier barbería que instalara UrbanBlade publicaba datos de contacto
 * ajenos aunque ya hubiera capturado los suyos en /settings. Cada dato se oculta si no se capturó.
 */

// Solo se pintan las redes realmente capturadas: un ícono que lleva a "#" se ve peor que no mostrarlo.
const SOCIAL_BASE: Record<string, string> = {
  instagram: 'https://instagram.com/',
  facebook: 'https://facebook.com/',
  tiktok: 'https://tiktok.com/@',
}

// Mismo horario todos los días (la ficha solo guarda una apertura y un cierre): se repite para cada
// día en vez de inventar un horario distinto sin datos.
const DIAS_SEMANA = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export function useLandingBusiness(shop: Readonly<Ref<LandingBarbershop | null>>) {
  const contactInfo = computed(() => {
    const rows: LandingContactRow[] = []
    if (shop.value?.direccion) rows.push({ label: 'Ubicación', lines: [shop.value.direccion] })
    if (shop.value?.telefono) rows.push({ label: 'Contacto', lines: [shop.value.telefono] })
    if (shop.value?.horario_apertura && shop.value?.horario_cierre) {
      rows.push({ label: 'Horario', lines: [`${shop.value.horario_apertura} – ${shop.value.horario_cierre}`] })
    }
    return rows
  })

  const socials = computed<LandingSocial[]>(() =>
    Object.entries(shop.value?.redes_sociales ?? {})
      .filter((entry): entry is [string, string] => Boolean(entry[1]) && entry[0] in SOCIAL_BASE)
      .map(([network, handle]) => ({
        network,
        // Acepta tanto "urbanblade" como una URL completa ya capturada.
        url: handle.startsWith('http') ? handle : `${SOCIAL_BASE[network]}${handle.replace(/^@/, '')}`,
      })),
  )

  const mapAddress = computed(() => shop.value?.direccion ?? '')

  const openingHours = computed(() => {
    if (!shop.value?.horario_apertura || !shop.value?.horario_cierre) return null
    return {
      '@type': 'OpeningHoursSpecification',
      'dayOfWeek': DIAS_SEMANA,
      'opens': shop.value.horario_apertura,
      'closes': shop.value.horario_cierre,
    }
  })

  return { contactInfo, socials, mapAddress, openingHours }
}
