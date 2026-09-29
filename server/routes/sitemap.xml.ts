/**
 * Mapa del sitio para Google (Search Console). Solo páginas públicas: la landing, servicios, el
 * equipo con la ficha de cada barbero, reservar y las páginas legales. Nada del área con sesión.
 * Los barberos se leen de la API en cada petición (cacheado 1 h) para que un barbero nuevo aparezca solo.
 */
const STATIC_PAGES: Array<{ path: string, priority: string, changefreq: string }> = [
  { path: '/', priority: '1.0', changefreq: 'weekly' },
  { path: '/servicios', priority: '0.9', changefreq: 'weekly' },
  { path: '/reservar', priority: '0.9', changefreq: 'weekly' },
  { path: '/equipo', priority: '0.8', changefreq: 'weekly' },
  { path: '/privacidad', priority: '0.3', changefreq: 'yearly' },
  { path: '/terminos', priority: '0.3', changefreq: 'yearly' },
]

function xmlEscape(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export default defineCachedEventHandler(async (event) => {
  // Dominio fijo (no el de la petición): detrás de CloudFront el servidor ve http:// y Google
  // necesita las URL canónicas en https. NUXT_PUBLIC_SITE_URL permite otro dominio (producción).
  const site = String(useRuntimeConfig().public.siteUrl || 'https://urbanblade.com.mx').replace(/\/+$/, '')
  const apiBase = String(useRuntimeConfig().public.apiBase || '')

  let barberSlugs: string[] = []
  try {
    const res = await $fetch<{ data: Array<{ slug: string | null }> }>(`${apiBase}/barbers`, { timeout: 8000 })
    barberSlugs = res.data.map(b => b.slug).filter((s): s is string => !!s)
  } catch {
    // Sin API el mapa sigue saliendo con las páginas fijas.
  }

  const urls = [
    ...STATIC_PAGES,
    ...barberSlugs.map(slug => ({ path: `/equipo/${encodeURIComponent(slug)}`, priority: '0.7', changefreq: 'weekly' })),
  ]

  setResponseHeader(event, 'Content-Type', 'application/xml; charset=utf-8')

  return '<?xml version="1.0" encoding="UTF-8"?>\n'
    + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + urls.map(u => `  <url><loc>${xmlEscape(site + u.path)}</loc><changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority></url>`).join('\n')
    + '\n</urlset>\n'
}, { maxAge: 60 * 60, name: 'sitemap-xml' })
