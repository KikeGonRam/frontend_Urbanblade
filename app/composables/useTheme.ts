export const THEMES = ['noir', 'acero', 'salon', 'libreta'] as const
export type ThemeName = (typeof THEMES)[number]

export const THEME_LABELS: Record<ThemeName, string> = {
  noir: 'Sastrería Nocturna',
  acero: 'Taller de Acero',
  salon: 'Salón Inglés',
  libreta: 'Libreta de Barbero',
}

/** Colores de la vista previa del selector (los mismos tokens de main.css, en hexadecimal). */
export const THEME_PREVIEWS: Record<ThemeName, { bg: string, card: string, ink: string, gold: string, line: string }> = {
  noir: { bg: '#0c0a08', card: '#181512', ink: '#f4efe6', gold: '#d4af37', line: '#2f2a24' },
  acero: { bg: '#121314', card: '#1b1c1d', ink: '#f0eeea', gold: '#c57a4b', line: '#2d2f31' },
  salon: { bg: '#0b1210', card: '#141c19', ink: '#f1efe6', gold: '#c9a24a', line: '#24322c' },
  libreta: { bg: '#f3ede0', card: '#fffbf3', ink: '#241e18', gold: '#b8860b', line: '#e2d5b8' },
}

export const THEME_BLURBS: Record<ThemeName, string> = {
  noir: 'Negro y oro',
  acero: 'Grafito y cobre',
  salon: 'Verde inglés y latón',
  libreta: 'Claro: marfil y tinta',
}

const THEME_CHROME_COLORS: Record<ThemeName, string> = {
  noir: '#0c0a08',
  acero: '#121314',
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

  return { theme: cookie, apply, THEMES, THEME_LABELS, THEME_PREVIEWS, THEME_BLURBS }
}
