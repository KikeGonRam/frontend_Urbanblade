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
    expect(wrapper.find('[role="radiogroup"]').exists()).toBe(false)
  })

  it('abre un grupo de opciones con una vista previa por tema', async () => {
    const wrapper = await mountSuspended(ThemePicker)
    await wrapper.get('button[aria-haspopup]').trigger('click')

    const opciones = wrapper.findAll('[role="radio"]')
    expect(opciones).toHaveLength(THEMES.length)
    expect(opciones.map(o => o.text())).toEqual(expect.arrayContaining(THEMES.map(t => expect.stringContaining(THEME_LABELS[t]))))
    expect(opciones.filter(o => o.attributes('aria-checked') === 'true')).toHaveLength(1)
  })

  it('cambia el tema al elegir una opción y marca solo esa', async () => {
    const wrapper = await mountSuspended(ThemePicker)
    await wrapper.get('button[aria-haspopup]').trigger('click')

    await wrapper.findAll('[role="radio"]')[3]!.trigger('click')

    expect(document.documentElement.getAttribute('data-theme')).toBe(THEMES[3])
    const marcadas = wrapper.findAll('[role="radio"]').filter(o => o.attributes('aria-checked') === 'true')
    expect(marcadas).toHaveLength(1)
    expect(marcadas[0]!.text()).toContain(THEME_LABELS[THEMES[3]!])
  })

  it('se cierra con Escape', async () => {
    const wrapper = await mountSuspended(ThemePicker)
    await wrapper.get('button[aria-haspopup]').trigger('click')
    expect(wrapper.find('[role="radiogroup"]').exists()).toBe(true)

    await wrapper.get('[role="radiogroup"]').trigger('keydown', { key: 'Escape' })

    expect(wrapper.find('[role="radiogroup"]').exists()).toBe(false)
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
    expect(contraste(THEME_PREVIEWS.acero.gold, '#22262c')).toBeGreaterThanOrEqual(4.5)
  })

  it('el pie del acceso alcanza AA sobre el fondo oscuro', () => {
    expect(contraste('#787878', '#080808')).toBeGreaterThanOrEqual(4.5)
  })
})
