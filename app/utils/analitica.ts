/*
 * Lectura automática del tablero analítico del administrador (auditoría UI/UX A-45): convierte las cifras del
 * periodo en frases que dicen qué mirar, en lugar de dejar que la persona interprete seis gráficas.
 */
export interface LecturaEntrada {
  totalIngresos: number
  citas: number
  porEstado: Record<string, number>
  ingresosPorBarbero: { nombre: string, total: number }[]
  retencion: number
  clientesInactivos: number
}

export interface Lectura {
  tono: 'bien' | 'atencion' | 'info'
  texto: string
}

const pct = (parte: number, total: number) => (total > 0 ? Math.round((parte / total) * 100) : 0)
const dinero = (n: number) => '$' + Math.round(n).toLocaleString('es-MX')

export function lecturaDelNegocio(d: LecturaEntrada): Lectura[] {
  const lecturas: Lectura[] = []

  if (d.citas === 0 && d.totalIngresos === 0) {
    return [{ tono: 'info', texto: 'Todavía no hay actividad en este periodo para analizar.' }]
  }

  const perdidas = (d.porEstado.cancelada ?? 0) + (d.porEstado.no_asistio ?? 0)
  const tasaPerdida = pct(perdidas, d.citas)
  if (d.citas >= 5 && tasaPerdida >= 15) {
    lecturas.push({ tono: 'atencion', texto: `${tasaPerdida} % de las citas se cancela o no asiste (${perdidas} de ${d.citas}). Conviene reforzar recordatorios y revisar la política de cancelación.` })
  } else if (d.citas >= 5) {
    lecturas.push({ tono: 'bien', texto: `Solo ${tasaPerdida} % de las citas se cancela o no asiste: la agenda se cumple.` })
  }

  const completadas = d.porEstado.completada ?? 0
  const finalizacion = pct(completadas, d.citas)
  if (d.citas >= 5 && finalizacion < 60) {
    lecturas.push({ tono: 'atencion', texto: `Solo ${finalizacion} % de las citas del periodo está completada; el resto sigue pendiente, confirmada o se perdió.` })
  }

  const ordenados = [...d.ingresosPorBarbero].sort((a, b) => b.total - a.total)
  const lider = ordenados[0]
  if (lider && ordenados.length > 1 && d.totalIngresos > 0) {
    const cuota = pct(lider.total, d.totalIngresos)
    if (cuota >= 60) {
      lecturas.push({ tono: 'atencion', texto: `${lider.nombre} concentra ${cuota} % de los ingresos (${dinero(lider.total)}). Si falta un día, el negocio lo nota: conviene repartir la demanda.` })
    } else {
      lecturas.push({ tono: 'info', texto: `${lider.nombre} lidera con ${dinero(lider.total)} (${cuota} % de los ingresos), sin dependencia excesiva.` })
    }
  }

  if (d.retencion > 0 && d.retencion < 50) {
    lecturas.push({ tono: 'atencion', texto: `La retención es de ${Math.round(d.retencion)} %: menos de la mitad de los clientes regresa. Una campaña de reactivación puede ayudar (${d.clientesInactivos} inactivos).` })
  } else if (d.retencion >= 70) {
    lecturas.push({ tono: 'bien', texto: `La retención es de ${Math.round(d.retencion)} %: la mayoría de los clientes regresa.` })
  }

  return lecturas.length ? lecturas : [{ tono: 'info', texto: 'Sin hallazgos destacados en este periodo.' }]
}

/*
 * Comparación con el periodo anterior y cohortes de retención (auditoría UI/UX A-45).
 * Los datos vienen de /admin/reports/comparison y /admin/reports/cohorts.
 */
export interface MetricaComparada {
  actual: number
  anterior: number
  variacion_pct: number | null
}

export interface Comparacion {
  period: string
  actual: { desde: string, hasta: string }
  anterior: { desde: string, hasta: string }
  metricas: {
    ingresos: MetricaComparada
    citas: MetricaComparada
    completadas: MetricaComparada
    perdidas: MetricaComparada
    clientes_nuevos: MetricaComparada
  }
}

export interface Cohorte {
  cohorte: string
  clientes: number
  retencion: (number | null)[]
}

/** Variación para la tarjeta: null cuando no hay base de comparación (periodo anterior en cero). */
export function variacionDe(m?: MetricaComparada | null): number | null {
  return m && m.variacion_pct !== null && Number.isFinite(m.variacion_pct) ? m.variacion_pct : null
}

const COMPARADO: Record<string, string> = {
  dia: 'ayer',
  semana: 'la semana pasada',
  mes: 'el mes pasado',
  trimestre: 'el trimestre pasado',
  año: 'el año pasado',
}

/** Texto corto para la etiqueta de la variación («vs. el mes pasado»). */
export function etiquetaComparacion(period: string): string {
  return `vs. ${COMPARADO[period] ?? 'el periodo anterior'}`
}

/** Frases de lectura sobre cómo cambió el negocio frente al mismo tramo del periodo anterior. */
export function lecturaComparativa(c: Comparacion | null | undefined): Lectura[] {
  if (!c) return []
  const { ingresos, citas, perdidas, clientes_nuevos: nuevos } = c.metricas
  const contra = etiquetaComparacion(c.period)
  const lecturas: Lectura[] = []

  const vi = variacionDe(ingresos)
  if (vi !== null && Math.abs(vi) >= 5) {
    lecturas.push(vi > 0
      ? { tono: 'bien', texto: `Los ingresos suben ${Math.round(vi)} % ${contra} (${dinero(ingresos.actual)} contra ${dinero(ingresos.anterior)}).` }
      : { tono: 'atencion', texto: `Los ingresos bajan ${Math.round(Math.abs(vi))} % ${contra} (${dinero(ingresos.actual)} contra ${dinero(ingresos.anterior)}). Revisa si hubo menos citas o menos ticket.` })
  } else if (vi !== null) {
    lecturas.push({ tono: 'info', texto: `Los ingresos se mantienen estables ${contra}.` })
  }

  const vc = variacionDe(citas)
  if (vc !== null && vc <= -15 && citas.anterior >= 5) {
    lecturas.push({ tono: 'atencion', texto: `Hay ${Math.round(Math.abs(vc))} % menos citas ${contra} (${citas.actual} contra ${citas.anterior}).` })
  }

  const vp = variacionDe(perdidas)
  if (vp !== null && vp >= 25 && perdidas.actual >= 3) {
    lecturas.push({ tono: 'atencion', texto: `Las citas perdidas (canceladas o sin asistir) aumentan ${Math.round(vp)} % ${contra}.` })
  }

  const vn = variacionDe(nuevos)
  if (vn !== null && vn >= 20 && nuevos.actual >= 3) {
    lecturas.push({ tono: 'bien', texto: `Llegan ${Math.round(vn)} % más clientes nuevos ${contra} (${nuevos.actual}).` })
  }

  return lecturas
}

/** Nombre de la cohorte («2026-03» → «mar 2026»). */
export function nombreCohorte(cohorte: string): string {
  const [anio, mes] = cohorte.split('-').map(Number)
  if (!anio || !mes) return cohorte
  const m = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'][mes - 1]

  return m ? `${m} ${anio}` : cohorte
}

/** Intensidad (0–1) de una celda de la matriz, para el relleno del color. */
export function intensidadRetencion(valor: number | null): number {
  if (valor === null || !Number.isFinite(valor)) return 0

  return Math.max(0, Math.min(1, valor / 100))
}
