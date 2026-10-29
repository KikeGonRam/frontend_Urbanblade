import { describe, expect, it } from 'vitest'
import { appendSample, incidentsFrom, MAX_AGE_MS, parseHistory, resumen, sampleFromStatus, windowed, type SystemSample } from '~/utils/systemHistory'
import type { SystemStatus } from '~/utils/systemMap'

/* Auditoría UI/UX I-01: el monitor del ingeniero acumula lecturas para mostrar tendencias y cambios de estado. */
const estado = (over: Partial<SystemStatus> = {}): SystemStatus => ({
  app: { name: 'UB', env: 'staging', laravel_version: '13', php_version: '8.4' },
  database: { status: 'up', latency_ms: 6 },
  redis: { status: 'no_usado', latency_ms: null },
  queue: { connection: 'sync', pending: 0, failed: 0 },
  scheduled_tasks: [],
  ...over,
})
const muestra = (t: number, health: SystemSample['health'] = 'ok'): SystemSample => ({ t, db: 5, redis: null, pending: 0, failedJobs: 0, failedTasks: 0, health })

describe('historial del monitor', () => {
  it('clasifica la salud de una lectura', () => {
    expect(sampleFromStatus(estado(), 1).health).toBe('ok')
    expect(sampleFromStatus(estado({ database: { status: 'up', latency_ms: 900 } }), 1).health).toBe('warn')
    expect(sampleFromStatus(estado({ queue: { connection: 'redis', pending: 2, failed: 3 } }), 1).health).toBe('warn')
    expect(sampleFromStatus(estado({ database: { status: 'down', latency_ms: null } }), 1).health).toBe('down')
  })

  it('descarta lecturas con más de 24 h y respeta el orden', () => {
    const ahora = 10 * MAX_AGE_MS
    const h = appendSample([muestra(ahora - MAX_AGE_MS - 1), muestra(ahora - 1000)], muestra(ahora))

    expect(h.map(s => s.t)).toEqual([ahora - 1000, ahora])
  })

  it('filtra por ventana de tiempo', () => {
    const ahora = 100_000
    const h = [muestra(ahora - 7_200_000), muestra(ahora - 1_800_000), muestra(ahora)]

    expect(windowed(h, 3_600_000, ahora)).toHaveLength(2)
  })

  it('registra los cambios de estado, el más reciente primero', () => {
    const h = [muestra(1), muestra(2, 'warn'), muestra(3, 'warn'), muestra(4, 'ok')]

    const i = incidentsFrom(h)

    expect(i.map(x => `${x.from}>${x.to}`)).toEqual(['warn>ok', 'ok>warn'])
    expect(i[1]!.t).toBe(2)
  })

  it('resume una serie ignorando nulos', () => {
    expect(resumen([4, null, 10, 7])).toEqual({ min: 4, avg: 7, max: 10, last: 7 })
    expect(resumen([null, null])).toBeNull()
  })

  it('lee un historial guardado y tolera datos dañados', () => {
    expect(parseHistory(JSON.stringify([muestra(1)]))).toHaveLength(1)
    expect(parseHistory('{"no":"lista"}')).toEqual([])
    expect(parseHistory('no es json')).toEqual([])
    expect(parseHistory(null)).toEqual([])
  })
})
