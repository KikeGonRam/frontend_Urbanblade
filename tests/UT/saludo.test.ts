import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { defineComponent, h } from 'vue'
import { saludoPorHora, useSaludo } from '~/composables/useSaludo'

/* Fase C del plan de calidez: saludo por hora, el mismo en todos los paneles. */
const a = (hora: number, minuto = 0) => new Date(2026, 10, 6, hora, minuto)

describe('saludo por hora', () => {
  it('de 6:00 a 11:59 es «Buenos días»', () => {
    expect(saludoPorHora(a(6))).toBe('Buenos días')
    expect(saludoPorHora(a(11, 59))).toBe('Buenos días')
  })

  it('de 12:00 a 18:59 es «Buenas tardes»', () => {
    expect(saludoPorHora(a(12))).toBe('Buenas tardes')
    expect(saludoPorHora(a(18, 59))).toBe('Buenas tardes')
  })

  it('desde las 19:00 hasta antes de las 6:00 es «Buenas noches»', () => {
    expect(saludoPorHora(a(19))).toBe('Buenas noches')
    expect(saludoPorHora(a(0, 30))).toBe('Buenas noches')
    expect(saludoPorHora(a(5, 59))).toBe('Buenas noches')
  })

  it('el panel muestra uno de los tres saludos tras montar, nunca un texto vacío', async () => {
    const Panel = defineComponent({ setup() { const saludo = useSaludo(); return () => h('p', saludo.value) } })
    const wrapper = await mountSuspended(Panel)

    expect(['Buenos días', 'Buenas tardes', 'Buenas noches']).toContain(wrapper.text())
  })
})
