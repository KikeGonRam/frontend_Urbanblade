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
