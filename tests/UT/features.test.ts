import { describe, expect, it } from 'vitest'
import { FEATURE_NAMES, parseFeatures } from '~/composables/useFeatures'

/*
 * Interruptores de módulos: solo `true` exacto enciende un módulo. Sin respuesta, con claves faltantes o con
 * valores raros todo queda APAGADO (nunca se muestra algo que el backend no sirve).
 */
describe('parseFeatures', () => {
  it('sin datos apaga todos los módulos', () => {
    for (const raw of [undefined, null, {}, 'x', 5]) {
      const flags = parseFeatures(raw)

      expect(FEATURE_NAMES.every(name => flags[name] === false)).toBe(true)
    }
  })

  it('enciende solo lo que viene en true y trata la clave faltante como apagada', () => {
    const flags = parseFeatures({ packages: true, gift_cards: false, referrals: 'true', raffles: 1 })

    expect(flags).toEqual({ packages: true, gift_cards: false, referrals: false, raffles: false, social: false, campaigns: false })
  })
})
