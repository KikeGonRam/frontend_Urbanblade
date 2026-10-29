import { describe, expect, it } from 'vitest'
import { etiquetaComparacion, intensidadRetencion, lecturaComparativa, lecturaDelNegocio, nombreCohorte, variacionDe, type Comparacion, type LecturaEntrada } from '~/utils/analitica'

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

const m = (actual: number, anterior: number) => ({ actual, anterior, variacion_pct: anterior > 0 ? ((actual - anterior) / anterior) * 100 : null })
const comp = (over: Partial<Comparacion['metricas']> = {}): Comparacion => ({
  period: 'mes',
  actual: { desde: '2026-10-01', hasta: '2026-10-29' },
  anterior: { desde: '2026-09-01', hasta: '2026-09-29' },
  metricas: { ingresos: m(1000, 1000), citas: m(10, 10), completadas: m(9, 9), perdidas: m(1, 1), clientes_nuevos: m(2, 2), ...over },
})

describe('comparación con el periodo anterior', () => {
  it('no inventa variación cuando el periodo anterior estaba en cero', () => {
    expect(variacionDe(m(5, 0))).toBeNull()
    expect(variacionDe(undefined)).toBeNull()
    expect(variacionDe(m(150, 100))).toBe(50)
  })

  it('nombra el periodo con el que se compara', () => {
    expect(etiquetaComparacion('mes')).toBe('vs. el mes pasado')
    expect(etiquetaComparacion('desconocido')).toBe('vs. el periodo anterior')
  })

  it('celebra el crecimiento de ingresos y avisa de una caída', () => {
    expect(lecturaComparativa(comp({ ingresos: m(1500, 1000) }))[0]).toMatchObject({ tono: 'bien' })
    expect(lecturaComparativa(comp({ ingresos: m(500, 1000) }))[0]).toMatchObject({ tono: 'atencion' })
  })

  it('dice que está estable cuando el cambio es pequeño y no dice nada sin datos', () => {
    expect(lecturaComparativa(comp())[0]?.texto).toContain('estables')
    expect(lecturaComparativa(null)).toEqual([])
    expect(lecturaComparativa(comp({ ingresos: m(100, 0) }))).toEqual([])
  })

  it('avisa de menos citas y de más citas perdidas', () => {
    const textosC = lecturaComparativa(comp({ citas: m(6, 10), perdidas: m(5, 2) })).map(l => l.texto).join(' | ')

    expect(textosC).toContain('menos citas')
    expect(textosC).toContain('citas perdidas')
  })
})

describe('cohortes de retención', () => {
  it('nombra la cohorte en español y tolera formatos raros', () => {
    expect(nombreCohorte('2026-03')).toBe('mar 2026')
    expect(nombreCohorte('raro')).toBe('raro')
  })

  it('acota la intensidad de la celda entre 0 y 1', () => {
    expect(intensidadRetencion(null)).toBe(0)
    expect(intensidadRetencion(50)).toBe(0.5)
    expect(intensidadRetencion(140)).toBe(1)
    expect(intensidadRetencion(-3)).toBe(0)
  })
})
