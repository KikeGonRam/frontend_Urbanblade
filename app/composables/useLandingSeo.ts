import type { LandingBarbershop, LandingPublicStats, LandingSocial } from '~/types/landing'

export const LANDING_HERO_IMG = 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1'
export const LANDING_SITE_URL = 'https://urbanblade.com.mx'

interface LandingSeoSources {
  shop: Readonly<Ref<LandingBarbershop | null>>
  openingHours: Readonly<Ref<Record<string, unknown> | null>>
  priceRange: Readonly<Ref<string | null>>
  socials: Readonly<Ref<LandingSocial[]>>
  publicStats: Readonly<Ref<LandingPublicStats>>
}

/**
 * Metadatos de la portada: título y descripción para buscadores, precarga de la foto del héroe y
 * datos de negocio local (JSON-LD). El JSON-LD usa solo lo que la barbería realmente capturó:
 * nunca se inventan coordenadas, código postal ni horarios.
 *
 * "Santa María Atarasquillo, Lerma" va en el título y la descripción porque para una barbería real
 * la mayoría de las búsquedas que importan llevan una ubicación. El nombre va primero para que la
 * pestaña del navegador y el resultado de marca se sigan viendo igual de claros.
 */
export function useLandingSeo({ shop, openingHours, priceRange, socials, publicStats }: LandingSeoSources) {
  useSeoMeta({
    title: 'UrbanBlade — Barbería en Santa María Atarasquillo, Lerma | Reserva en línea',
    description: 'Barbería en Santa María Atarasquillo, Lerma (Edomex). Reserva tu cita en línea: cortes, barba y grooming de estudio con maestros barberos y horario realmente disponible.',
    ogTitle: 'UrbanBlade — Barbería en Santa María Atarasquillo, Lerma',
    ogDescription: 'Cortes, barba y grooming de estudio en Santa María Atarasquillo, Lerma. Reserva en segundos, sin llamadas.',
    ogType: 'website',
    ogUrl: LANDING_SITE_URL,
    ogLocale: 'es_MX',
    ogImage: `${LANDING_HERO_IMG}?q=75&w=1200&h=630&fit=crop&auto=format`,
    twitterCard: 'summary_large_image',
  })

  // La foto del héroe es lo más grande de la portada: se conecta y se pide antes de que el CSS la descubra.
  // Un teléfono no necesita 1920 px: la variante de 900 px pesa una fracción y mejora el LCP en móvil.
  useHead({
    link: [
      { rel: 'preconnect', href: 'https://images.unsplash.com', crossorigin: '' },
      { rel: 'preload', as: 'image', href: `${LANDING_HERO_IMG}?q=70&w=900&auto=format&fit=max`, media: '(max-width: 767px)', fetchpriority: 'high' },
      { rel: 'preload', as: 'image', href: `${LANDING_HERO_IMG}?q=75&w=1920&auto=format&fit=max`, media: '(min-width: 768px)', fetchpriority: 'high' },
    ],
    script: [{
      type: 'application/ld+json',
      // Se escapa "<" para que un nombre o dirección con "</script>" no cierre la etiqueta.
      innerHTML: computed(() => JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'HairSalon',
        '@id': `${LANDING_SITE_URL}/#negocio`,
        'name': shop.value?.nombre || 'UrbanBlade',
        'url': LANDING_SITE_URL,
        'image': `${LANDING_HERO_IMG}?q=75&w=1200&auto=format`,
        ...(shop.value?.telefono ? { telephone: shop.value.telefono } : {}),
        ...(shop.value?.direccion ? { address: { '@type': 'PostalAddress', 'streetAddress': shop.value.direccion, 'addressCountry': 'MX' } } : {}),
        ...(openingHours.value ? { openingHoursSpecification: openingHours.value } : {}),
        ...(priceRange.value ? { priceRange: priceRange.value } : {}),
        ...(socials.value.length ? { sameAs: socials.value.map(s => s.url) } : {}),
        ...(publicStats.value.reviews > 0 ? { aggregateRating: { '@type': 'AggregateRating', 'ratingValue': publicStats.value.rating, 'reviewCount': publicStats.value.reviews } } : {}),
      }).replace(/</g, '\\u003c')),
    }],
  })
}
