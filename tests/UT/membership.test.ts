import { describe, expect, it } from 'vitest'
import { includedLabel, includedSavings, includedValue } from '../../app/utils/membership'

describe('planes con servicios incluidos', () => {
  it('describe cada servicio incluido', () => {
    expect(includedLabel({ nombre: 'Corte Clásico', usos: 2 })).toBe('2 × Corte Clásico al mes')
  })

  it('suma el valor de lista de lo incluido', () => {
    expect(includedValue([{ precio: 180, usos: 2 }, { precio: 100, usos: 2 }])).toBe(560)
  })

  it('calcula el ahorro y nunca es negativo', () => {
    expect(includedSavings(360, 299)).toBe(61)
    expect(includedSavings(360, 449)).toBe(0)
  })
})
