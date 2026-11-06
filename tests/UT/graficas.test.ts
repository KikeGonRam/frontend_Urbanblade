import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { computed } from 'vue'
import { AXIS_TEXT_ALPHA, bumpChartTheme, chartScale } from '~/utils/chartTheme'
import { THEMES, THEME_PREVIEWS } from '~/composables/useTheme'

/* Fase D del plan de calidez: gráficas legibles en los 4 temas y que siguen al tema en caliente. */

function canales(hex: string) {
  return [1, 3, 5].map(i => Number.parseInt(hex.slice(i, i + 2), 16))
}
function luminancia([r, g, b]: number[]) {
  const c = [r!, g!, b!].map((v) => {
    const x = v / 255
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!
}
function contraste(a: number[], b: number[]) {
  const [x, y] = [luminancia(a), luminancia(b)].sort((m, n) => n - m)
  return (x! + 0.05) / (y! + 0.05)
}

describe('texto de los ejes', () => {
  it('con la opacidad del kit alcanza 4.5:1 sobre la tarjeta de los 4 temas', () => {
    for (const tema of THEMES) {
      const { ink, card } = THEME_PREVIEWS[tema]
      const fondo = canales(card)
      const texto = canales(ink).map((v, i) => Math.round(v * AXIS_TEXT_ALPHA + fondo[i]! * (1 - AXIS_TEXT_ALPHA)))
      expect(contraste(texto, fondo), tema).toBeGreaterThanOrEqual(4.5)
    }
  })
})

describe('cambio de tema en caliente', () => {
  it('las opciones de una gráfica armadas en un computed se recalculan al avisar el cambio de tema', () => {
    let veces = 0
    const opciones = computed(() => {
      veces++
      return chartScale()
    })

    void opciones.value
    void opciones.value
    expect(veces).toBe(1)

    bumpChartTheme()
    void opciones.value
    expect(veces).toBe(2)
  })

  it('useTheme().apply avisa el cambio a las gráficas', () => {
    const fuente = readFileSync(resolve(process.cwd(), 'app/composables/useTheme.ts'), 'utf8')

    expect(fuente).toMatch(/updateBrowserChrome\(theme\)\s+bumpChartTheme\(\)/)
  })
})

describe('colores de ejes con el tema activo', () => {
  it('un color hecho con la tinta de otro tema toma la tinta activa y conserva su opacidad', async () => {
    const { reteñir } = await import('~/utils/registerChartjs')
    const tintaLibreta: [number, number, number, number] = [36, 30, 24, 1]

    expect(reteñir('rgba(244,239,230, 0.7)', tintaLibreta)).toBe('rgba(36,30,24,0.700)')
    expect(reteñir('rgba(242, 242, 242, 0.08)', tintaLibreta)).toBe('rgba(36,30,24,0.080)')
  })

  it('un color propio de la gráfica no cambia', async () => {
    const { reteñir } = await import('~/utils/registerChartjs')

    expect(reteñir('rgba(248,113,113,0.9)', [36, 30, 24, 1])).toBe('rgba(248,113,113,0.9)')
    expect(reteñir('#d4af37', [36, 30, 24, 1])).toBe('#d4af37')
  })
})
