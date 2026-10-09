export const THEMES = ['noir', 'acero', 'salon', 'libreta'] as const
export type ThemeName = (typeof THEMES)[number]

export const THEME_LABELS: Record<ThemeName, string> = {
  noir: 'Sastrería Nocturna',
  acero: 'Taller de Acero',
  salon: 'Salón Inglés',
  libreta: 'Libreta de Barbero',
}

const THEME_CHROME_COLORS: Record<ThemeName, string> = {
  noir: '#0a0a0a',
  acero: '#111317',
  salon: '#0b1210',
  libreta: '#f3ede0',
}

function updateBrowserChrome(theme: ThemeName) {
  if (!import.meta.client) return

  const color = THEME_CHROME_COLORS[theme]
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((meta) => {
    meta.setAttribute('content', color)
  })
  document.querySelector('meta[name="color-scheme"]')?.setAttribute(
    'content',
    theme === 'libreta' ? 'light' : 'dark',
  )
}

/**
 * Cookie legible en cliente y servidor (no httpOnly) — permite que el script
 * inline en <head> (nuxt.config.ts) la lea de forma síncrona antes del
 * primer paint, y que useCookie() la sincronice reactivamente después.
 * Persistencia por dispositivo, igual que el `theme` por-usuario de barber
 * pero sin depender de una sesión de servidor.
 */
export function useTheme() {
  const cookie = useCookie<ThemeName>('ub_theme', {
    default: () => 'noir',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  })

  function apply(theme: ThemeName) {
    cookie.value = theme
    if (import.meta.client) {
      document.documentElement.setAttribute('data-theme', theme)
      updateBrowserChrome(theme)
    }
  }

  return { theme: cookie, apply, THEMES, THEME_LABELS }
}
