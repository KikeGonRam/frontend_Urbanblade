import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import ThemePicker from '~/components/shell/ThemePicker.vue'
import { THEMES, THEME_LABELS, THEME_PREVIEWS } from '~/composables/useTheme'

/* Fase 0 del plan de mejora de la interfaz: selector de tema accesible y contraste AA en los temas. */

function luminancia(hex: string) {
  const canales = [1, 3, 5].map((i) => {
    const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * canales[0]! + 0.7152 * canales[1]! + 0.0722 * canales[2]!
}

function contraste(a: string, b: string) {
  const [claro, oscuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x)
  return (claro! + 0.05) / (oscuro! + 0.05)
}

describe('selector de tema', () => {
  it('muestra un botón con el tema actual y el panel cerrado', async () => {
    const wrapper = await mountSuspended(ThemePicker)
    const boton = wrapper.get('button[aria-haspopup]')

    expect(boton.attributes('aria-label')).toContain('Tema actual')
    expect(boton.attributes('aria-expanded')).toBe('false')
    expect(wrapper.find('fieldset').exists()).toBe(false)
  })

  it('abre un grupo de opciones con una vista previa por tema', async () => {
    const wrapper = await mountSuspended(ThemePicker)
    await wrapper.get('button[aria-haspopup]').trigger('click')

    const opciones = wrapper.findAll('label.ub-theme-option')
    expect(opciones).toHaveLength(THEMES.length)
    expect(opciones.map(o => o.text())).toEqual(expect.arrayContaining(THEMES.map(t => expect.stringContaining(THEME_LABELS[t]))))
    expect(wrapper.findAll('input[type="radio"]').filter(i => (i.element as HTMLInputElement).checked)).toHaveLength(1)
  })

  it('cambia el tema al elegir una opción y marca solo esa', async () => {
    const wrapper = await mountSuspended(ThemePicker)
    await wrapper.get('button[aria-haspopup]').trigger('click')

    await wrapper.findAll('input[type="radio"]')[3]!.setValue(true)

    expect(document.documentElement.getAttribute('data-theme')).toBe(THEMES[3])
    const marcadas = wrapper.findAll('input[type="radio"]').filter(i => (i.element as HTMLInputElement).checked)
    expect(marcadas).toHaveLength(1)
    expect((marcadas[0]!.element as HTMLInputElement).value).toBe(THEMES[3])
  })

  it('se cierra con Escape', async () => {
    const wrapper = await mountSuspended(ThemePicker)
    await wrapper.get('button[aria-haspopup]').trigger('click')
    expect(wrapper.find('fieldset').exists()).toBe(true)

    await wrapper.get('fieldset').trigger('keydown', { key: 'Escape' })

    expect(wrapper.find('fieldset').exists()).toBe(false)
  })
})

describe('contraste de los temas (WCAG AA, 4.5:1 en texto normal)', () => {
  it('el dorado como texto en el tema claro alcanza AA sobre marfil y sobre tarjeta', () => {
    expect(contraste('#8a6408', THEME_PREVIEWS.libreta.bg)).toBeGreaterThanOrEqual(4.5)
    expect(contraste('#8a6408', THEME_PREVIEWS.libreta.card)).toBeGreaterThanOrEqual(4.5)
  })

  it('el texto atenuado del tema claro alcanza AA también sobre el fondo de acento', () => {
    expect(contraste('#6e6456', '#ece2cc')).toBeGreaterThanOrEqual(4.5)
    expect(contraste('#6e6456', THEME_PREVIEWS.libreta.bg)).toBeGreaterThanOrEqual(4.5)
  })

  it('el cobre del tema acero alcanza AA sobre el fondo de acento', () => {
    expect(contraste(THEME_PREVIEWS.acero.gold, '#242526')).toBeGreaterThanOrEqual(4.5)
  })

  it('el pie del acceso alcanza AA sobre el fondo oscuro', () => {
    expect(contraste('#787878', '#080808')).toBeGreaterThanOrEqual(4.5)
  })
})

/* Fase B del plan de calidez: los neutros cálidos de los temas oscuros conservan el contraste AA. */
describe('tokens de los temas (leídos de main.css)', () => {
  const css = readFileSync(resolve(process.cwd(), 'app/assets/css/main.css'), 'utf8')

  /** Valores `--nombre: #rrggbb` de un bloque de tema. */
  function tokens(inicio: string, fin: string) {
    const i = css.indexOf(inicio)
    const bloque = css.slice(i, css.indexOf(fin, i + inicio.length))
    return Object.fromEntries([...bloque.matchAll(/--([a-z-]+):\s+(#[0-9a-f]{6});/gi)].map(m => [m[1]!, m[2]!]))
  }

  const temas = {
    noir: tokens(':root {', '/* ── "Taller de Acero"'),
    acero: tokens('html[data-theme="acero"] {', '/* ── "Salón'),
    salon: tokens('html[data-theme="salon"] {', 'html[data-theme="libreta"] {'),
  }

  for (const [nombre, t] of Object.entries(temas)) {
    it(`${nombre}: texto y texto atenuado alcanzan AA sobre fondo, tarjeta y acento`, () => {
      for (const fondo of ['bg-main', 'bg-card', 'bg-accent']) {
        expect(contraste(t.ink!, t[fondo]!), `${nombre}: ink sobre ${fondo}`).toBeGreaterThanOrEqual(4.5)
        expect(contraste(t.muted!, t[fondo]!), `${nombre}: muted sobre ${fondo}`).toBeGreaterThanOrEqual(4.5)
      }
    })
  }

  it('los temas oscuros ya no usan blanco ni negro puros como texto y fondo', () => {
    for (const t of Object.values(temas)) {
      expect(t.ink).not.toBe('#ffffff')
      expect(t.ink).not.toBe('#f2f2f2')
      expect(t['bg-main']).not.toBe('#0a0a0a')
    }
  })

  it('la vista previa del selector coincide con los tokens de cada tema', () => {
    for (const [nombre, t] of Object.entries(temas)) {
      const vista = THEME_PREVIEWS[nombre as keyof typeof THEME_PREVIEWS]
      expect(vista.bg).toBe(t['bg-main'])
      expect(vista.card).toBe(t['bg-card'])
      expect(vista.ink).toBe(t.ink)
    }
  })
})
