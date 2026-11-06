import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { THEMES, THEME_PREVIEWS } from '~/composables/useTheme'

/* Fase 2 del plan de mejora de la interfaz: botones y formularios coherentes y accesibles en los 4 temas. */

const css = readFileSync(resolve(process.cwd(), 'app/assets/css/main.css'), 'utf8')

function luminancia(hex: string) {
  const canales = [1, 3, 5].map((i) => {
    const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * canales[0]! + 0.7152 * canales[1]! + 0.0722 * canales[2]!
}

function contrasteConNegro(hex: string) {
  return (luminancia(hex) + 0.05) / 0.05
}

/** Mezcla `color` con negro al `porcentaje` % de color, como `color-mix(in srgb, color 84%, #000)`. */
function mezclarConNegro(hex: string, porcentaje: number) {
  const k = porcentaje / 100
  const canales = [1, 3, 5].map(i => Math.round(Number.parseInt(hex.slice(i, i + 2), 16) * k))
  return `#${canales.map(c => c.toString(16).padStart(2, '0')).join('')}`
}

describe('botón principal', () => {
  it('el degradado conserva 4.5:1 con texto negro en todo el recorrido y en los 4 temas', () => {
    expect(css).toContain('var(--gold) 0%, var(--gold-end) 100%')
    const extremos = [...css.matchAll(/--gold-end:\s+(#[0-9a-f]{6})/gi)].map(m => m[1]!)
    expect(extremos).toHaveLength(THEMES.length)
    for (const tema of THEMES) {
      const oro = THEME_PREVIEWS[tema].gold
      const fin = mezclarConNegro(oro, 84)
      expect(extremos, `${tema}: token --gold-end`).toContain(fin)
      expect(contrasteConNegro(oro), `${tema}: inicio`).toBeGreaterThanOrEqual(4.5)
      expect(contrasteConNegro(fin), `${tema}: final`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('respeta «reducir movimiento»', () => {
    expect(css).toMatch(/prefers-reduced-motion: reduce\) \{ \.ui-btn, \.ui-btn-secondary \{ transition: none; \}/)
  })
})

describe('formularios', () => {
  it('los campos inválidos y deshabilitados tienen un estilo propio', () => {
    expect(css).toContain("[aria-invalid='true']")
    expect(css).toContain(':where(input, select, textarea):disabled')
  })

  it('el texto de un <select> no pisa su chevron aunque el campo traiga px-*', () => {
    expect(css).toMatch(/select:not\(\[multiple\]\):not\(\[size\]\) \{ padding-inline-end: 2\.25rem; \}/)
  })

  it('en pantallas táctiles los botones y campos llegan a 44 px', () => {
    expect(css).toMatch(/@media \(pointer: coarse\)[\s\S]*min-height: 2\.75rem/)
  })

  it('el dorado como texto usa un token que oscurece solo el tema claro', () => {
    expect(css).toMatch(/--gold-text:\s+#d4af37/)
    expect(css).toMatch(/--gold-text:\s+#8a6408/)
    expect(css).toContain('color: var(--gold-text)')
  })
})

describe('accesibilidad 2.2', () => {
  it('el foco no queda bajo las barras fijas (scroll-padding en html)', () => {
    expect(css).toMatch(/scroll-padding-top: 4\.5rem;\s+scroll-padding-bottom: 5\.5rem;/)
  })
})
