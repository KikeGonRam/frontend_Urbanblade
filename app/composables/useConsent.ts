/*
 * Consentimiento de cookies no esenciales (analítica). Hasta que la persona acepta, no se
 * carga Google Tag Manager ni, por lo tanto, Microsoft Clarity ni Google Analytics, que son
 * las etiquetas que GTM publica. La elección se guarda en la cookie ub_consent (180 días) y
 * se puede cambiar desde «Preferencias de cookies» en el pie de página.
 */
export type ConsentChoice = 'accepted' | 'rejected'

const GTM_ID = 'GTM-K4RR96BB'
const ANALYTICS_COOKIES = /^(_clck|_clsk|CLID|ANONCHK|MR|MUID|SM|_ga|_gid|_gat|_gcl_)/

export function useConsent() {
  const choice = useCookie<ConsentChoice | null>('ub_consent', {
    maxAge: 60 * 60 * 24 * 180,
    sameSite: 'lax',
    secure: !import.meta.dev,
    default: () => null,
  })
  // Controla el banner: visible mientras no haya elección o si la persona lo reabre.
  const bannerOpen = useState('ub_consent_banner', () => false)

  function loadAnalytics() {
    if (!import.meta.client || document.getElementById('ub-gtm')) return
    const w = window as unknown as { dataLayer?: unknown[] }
    w.dataLayer = w.dataLayer || []
    w.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' })
    const script = document.createElement('script')
    script.id = 'ub-gtm'
    script.async = true
    script.src = `https://www.googletagmanager.com/gtm.js?id=${GTM_ID}`
    document.head.appendChild(script)
  }

  function clearAnalyticsCookies() {
    if (!import.meta.client) return
    const hosts = [location.hostname, `.${location.hostname}`, `.${location.hostname.split('.').slice(-2).join('.')}`]
    for (const part of document.cookie.split('; ')) {
      const name = part.split('=')[0] ?? ''
      if (!ANALYTICS_COOKIES.test(name)) continue
      for (const domain of hosts) {
        document.cookie = `${name}=; Max-Age=0; path=/; domain=${domain}`
      }
      document.cookie = `${name}=; Max-Age=0; path=/`
    }
  }

  function accept() {
    choice.value = 'accepted'
    bannerOpen.value = false
    loadAnalytics()
  }

  function reject() {
    const hadAccepted = choice.value === 'accepted'
    choice.value = 'rejected'
    bannerOpen.value = false
    if (hadAccepted && import.meta.client) {
      // Las etiquetas ya cargadas no se pueden descargar: se borran sus cookies y se recarga.
      clearAnalyticsCookies()
      location.reload()
    }
  }

  function reopen() {
    bannerOpen.value = true
  }

  return { choice, bannerOpen, accept, reject, reopen, loadAnalytics }
}
