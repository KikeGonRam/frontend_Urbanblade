/*
 * TT38 (HT-15): modelo del mapa del sistema en /system. Convierte la respuesta de
 * GET /api/v1/admin/system/status en nodos con un estado común (activo, lento, caído,
 * sin uso). Lo usan la vista 3D y la lista accesible, así que las dos dicen lo mismo.
 */

export interface SystemServiceStatus { status: 'up' | 'down' | 'no_usado', latency_ms: number | null, error?: string }
export interface SystemScheduledTask {
  name: string
  expression: string
  status: 'success' | 'failed' | 'unknown'
  ran_at: string | null
  runtime_ms: number | null
  error: string | null
}
export interface SystemStatus {
  app: { name: string, env: string, laravel_version: string, php_version: string }
  database: SystemServiceStatus
  redis: SystemServiceStatus
  queue: { connection: string, pending: number | null, failed: number | null }
  scheduled_tasks: SystemScheduledTask[]
}

export type SystemNodeState = 'activo' | 'lento' | 'caido' | 'sin_uso'

export interface SystemNode {
  id: string
  label: string
  kind: 'api' | 'servicio' | 'tarea'
  state: SystemNodeState
  /** Una línea con el dato principal (latencia, jobs, duración). */
  summary: string
  /** Error tal como lo reporta la API, si hay. */
  error: string | null
}

/** Latencia a partir de la cual un servicio que responde se marca como lento. */
export const SLOW_LATENCY_MS = 250

export const STATE_LABEL: Record<SystemNodeState, string> = {
  activo: 'Activo',
  lento: 'Lento o con fallos',
  caido: 'Caído',
  sin_uso: 'Sin uso',
}

/** Clases del indicador de cada estado en la lista (mismos colores que la vista 3D). */
export const STATE_DOT: Record<SystemNodeState, string> = {
  activo: 'bg-emerald-400',
  lento: 'bg-amber-300',
  caido: 'bg-red-500',
  sin_uso: 'bg-ink/30',
}

/** Cuántas tareas programadas se dibujan; todas siguen en la tabla de abajo. */
const MAX_TASKS = 8

function serviceNode(id: string, label: string, service: SystemServiceStatus): SystemNode {
  const latency = service.latency_ms
  let state: SystemNodeState = 'activo'
  if (service.status === 'no_usado') state = 'sin_uso'
  else if (service.status === 'down') state = 'caido'
  else if (latency !== null && latency >= SLOW_LATENCY_MS) state = 'lento'

  let summary = latency !== null ? `${latency} ms de latencia` : 'Responde'
  if (state === 'sin_uso') summary = 'Este entorno no lo usa'
  else if (state === 'caido') summary = 'No responde'

  return { id, label, kind: 'servicio', state, summary, error: service.error ?? null }
}

export function buildSystemNodes(status: SystemStatus): SystemNode[] {
  const failed = status.queue.failed ?? 0
  const nodes: SystemNode[] = [
    {
      id: 'api',
      label: 'API',
      kind: 'api',
      // Si /admin/system/status respondió, la API está arriba.
      state: 'activo',
      summary: `${status.app.env} · Laravel ${status.app.laravel_version} · PHP ${status.app.php_version}`,
      error: null,
    },
    serviceNode('database', 'MongoDB', status.database),
    serviceNode('redis', 'Redis', status.redis),
    {
      id: 'queue',
      label: 'Cola',
      kind: 'servicio',
      state: failed > 0 ? 'lento' : 'activo',
      summary: `${status.queue.connection} · ${status.queue.pending ?? '—'} pendientes · ${failed} fallidos`,
      error: null,
    },
  ]

  for (const [index, task] of status.scheduled_tasks.slice(0, MAX_TASKS).entries()) {
    let state: SystemNodeState = 'activo'
    if (task.status === 'failed') state = 'caido'
    else if (task.status === 'unknown') state = 'sin_uso'

    nodes.push({
      id: `task-${index}`,
      label: task.name,
      kind: 'tarea',
      state,
      summary: state === 'sin_uso'
        ? `${task.expression} · sin corridas registradas`
        : `${task.expression} · ${task.runtime_ms !== null ? `${task.runtime_ms} ms` : 'sin duración'}`,
      error: task.error,
    })
  }

  return nodes
}
