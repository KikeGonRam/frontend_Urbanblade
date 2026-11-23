/** Respuesta de GET /api/v1/admin/system/status (solo administrador). */
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
