import { describe, expect, it } from 'vitest'
import { etiquetaRelativa, huecoLibre, minutosDelDia, textoHueco } from '~/utils/miDia'

/* Auditoría UI/UX B-01: «Mi día» muestra tiempo relativo y huecos libres entre citas. */
const a = (h: number, m: number) => new Date(2026, 9, 29, h, m)

describe('Mi día', () => {
  it('lee horas con y sin segundos', () => {
    expect(minutosDelDia('09:30')).toBe(570)
    expect(minutosDelDia('14:05:00')).toBe(845)
    expect(minutosDelDia('x')).toBeNull()
    expect(minutosDelDia(null)).toBeNull()
  })

  it('describe el tiempo relativo', () => {
    expect(etiquetaRelativa('12:30', a(11, 48))).toBe('en 42 min')
    expect(etiquetaRelativa('13:00', a(11, 50))).toBe('en 1 h 10 min')
    expect(etiquetaRelativa('13:00', a(11, 0))).toBe('en 2 h')
    expect(etiquetaRelativa('11:30', a(11, 30))).toBe('ahora')
    expect(etiquetaRelativa('11:15', a(11, 30))).toBe('hace 15 min')
    expect(etiquetaRelativa('', a(11, 30))).toBe('')
  })

  it('calcula los huecos libres entre citas', () => {
    expect(huecoLibre('12:30', '13:10')).toBe(40)
    expect(huecoLibre('12:30', '12:30')).toBe(0)
    expect(huecoLibre('12:30', '12:00')).toBe(0)
    expect(huecoLibre('12:30', null)).toBe(0)
    expect(textoHueco(40)).toBe('40 min')
    expect(textoHueco(90)).toBe('1 h 30 min')
  })
})
