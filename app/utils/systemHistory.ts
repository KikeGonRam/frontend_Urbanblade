/*
 * Historial de lecturas del monitor del ingeniero (auditoría UI/UX I-01). La API entrega una instantánea por
 * consulta; aquí se acumulan las lecturas de este navegador (hasta 24 h) para dibujar tendencias y registrar
 * cambios de estado. Es una serie de tiempo local, no una métrica del servidor: solo cubre el tiempo en que el
 * monitor estuvo abierto.
 */
import type { SystemStatus } from '~/utils/systemMap'
import { SLOW_LATENCY_MS } from '~/utils/systemMap'

export type SystemHealth = 'ok' | 'warn' | 'down'

export interface SystemSample {
  t: number
  db: number | null
  redis: number | null
  pending: number | null
  failedJobs: number | null
  failedTasks: number
  health: SystemHealth
}

export interface SystemIncident {
  t: number
  from: SystemHealth
  to: SystemHealth
  detail: string
}

export const MAX_AGE_MS = 24 * 60 * 60 * 1000
export const MAX_SAMPLES = 1500

export function sampleFromStatus(status: SystemStatus, now: number): SystemSample {
  const failedTasks = status.scheduled_tasks.filter(task => task.status === 'failed').length
  const failedJobs = status.queue.failed ?? 0
  const down = status.database.status === 'down' || status.redis.status === 'down'
  const slow = (status.database.latency_ms ?? 0) > SLOW_LATENCY_MS || (status.redis.latency_ms ?? 0) > SLOW_LATENCY_MS

  return {
    t: now,
    db: status.database.latency_ms,
    redis: status.redis.latency_ms,
    pending: status.queue.pending,
    failedJobs: status.queue.failed,
    failedTasks,
    health: down ? 'down' : (failedJobs > 0 || failedTasks > 0 || slow) ? 'warn' : 'ok',
  }
}

/** Agrega una lectura y descarta las más viejas que 24 h o las que exceden el tope. */
export function appendSample(history: SystemSample[], sample: SystemSample): SystemSample[] {
  const limite = sample.t - MAX_AGE_MS
  const vigentes = history.filter(s => s.t >= limite && s.t < sample.t)

  return [...vigentes, sample].slice(-MAX_SAMPLES)
}

/** Lecturas de los últimos `ms` milisegundos. */
export function windowed(history: SystemSample[], ms: number, now: number): SystemSample[] {
  return history.filter(s => s.t >= now - ms)
}

const DETALLE: Record<SystemHealth, string> = {
  ok: 'Todo responde con normalidad',
  warn: 'Latencia alta, trabajos o tareas con fallas',
  down: 'Una dependencia dejó de responder',
}

/** Cambios de estado entre lecturas consecutivas (más reciente primero). */
export function incidentsFrom(history: SystemSample[]): SystemIncident[] {
  const out: SystemIncident[] = []
  for (let i = 1; i < history.length; i++) {
    const prev = history[i - 1]!
    const cur = history[i]!
    if (prev.health !== cur.health) out.push({ t: cur.t, from: prev.health, to: cur.health, detail: DETALLE[cur.health] })
  }

  return out.reverse()
}

export function parseHistory(raw: string | null): SystemSample[] {
  if (!raw) return []
  try {
    const data = JSON.parse(raw)

    return Array.isArray(data)
      ? data.filter((s): s is SystemSample => typeof s?.t === 'number' && typeof s?.health === 'string')
      : []
  } catch {
    return []
  }
}

/** Resumen de una serie: mínimo, promedio, máximo y último valor (ignora los nulos). */
export function resumen(valores: (number | null)[]): { min: number, avg: number, max: number, last: number } | null {
  const v = valores.filter((x): x is number => x !== null)
  if (!v.length) return null

  return { min: Math.min(...v), avg: Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10, max: Math.max(...v), last: v[v.length - 1]! }
}
