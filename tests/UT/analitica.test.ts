import { describe, expect, it } from 'vitest'
import { lecturaDelNegocio, type LecturaEntrada } from '~/utils/analitica'

/* Auditoría UI/UX A-45: el Centro de Análisis dice qué mirar, no solo muestra gráficas. */
const base: LecturaEntrada = {
  totalIngresos: 1000,
  citas: 10,
  porEstado: { completada: 9, no_asistio: 1 },
  ingresosPorBarbero: [{ nombre: 'Bruno', total: 550 }, { nombre: 'Nava', total: 450 }],
  retencion: 80,
  clientesInactivos: 2,
}
const textos = (d: LecturaEntrada) => lecturaDelNegocio(d).map(l => l.texto).join(' | ')

describe('lectura del negocio', () => {
  it('avisa cuando no hay actividad', () => {
    const l = lecturaDelNegocio({ ...base, citas: 0, totalIngresos: 0, porEstado: {}, ingresosPorBarbero: [] })

    expect(l).toEqual([{ tono: 'info', texto: 'Todavía no hay actividad en este periodo para analizar.' }])
  })

  it('celebra una agenda que se cumple y una buena retención', () => {
    expect(textos(base)).toContain('la agenda se cumple')
    expect(textos(base)).toContain('retención es de 80 %')
  })

  it('alerta cuando se pierden muchas citas', () => {
    const d = { ...base, porEstado: { completada: 6, cancelada: 2, no_asistio: 2 } }

    expect(lecturaDelNegocio(d).some(x => x.tono === 'atencion' && x.texto.includes('40 %'))).toBe(true)
  })

  it('alerta cuando un barbero concentra los ingresos', () => {
    const d = { ...base, ingresosPorBarbero: [{ nombre: 'Bruno', total: 800 }, { nombre: 'Nava', total: 200 }] }

    expect(textos(d)).toContain('Bruno concentra 80 %')
  })

  it('alerta con retención baja y no habla de concentración con un solo barbero', () => {
    const d = { ...base, retencion: 30, clientesInactivos: 9, ingresosPorBarbero: [{ nombre: 'Bruno', total: 1000 }] }

    expect(textos(d)).toContain('retención es de 30 %')
    expect(textos(d)).not.toContain('concentra')
  })
})
