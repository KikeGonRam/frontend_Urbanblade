<script setup lang="ts">
/*
 * Fase 4 del plan rol ingeniero — puerto de GET /api/v1/admin/system/status
 * (App\Http\Controllers\Api\Admin\System\SystemController, barber). Único
 * consumidor de este endpoint hoy; administrador e ingeniero comparten la
 * misma ruta y el mismo middleware 'engineer' (ver app/middleware/engineer.ts).
 */
definePageMeta({ middleware: ['auth', 'engineer'], layout: 'dashboard' })

interface ServiceStatus { status: 'up' | 'down'; latency_ms: number | null; error?: string }
interface ScheduledTask {
  name: string
  expression: string
  status: 'success' | 'failed' | 'unknown'
  ran_at: string | null
  runtime_ms: number | null
  error: string | null
}
interface SystemStatus {
  app: { name: string, env: string, laravel_version: string, php_version: string }
  database: ServiceStatus
  redis: ServiceStatus
  queue: { connection: string, pending: number | null, failed: number | null }
  scheduled_tasks: ScheduledTask[]
}

const { apiFetch } = useApi()

const { data, pending, error, refresh } = await useAsyncData(
  'system-status',
  () => apiFetch<SystemStatus>('/admin/system/status'),
)

const STATUS_CLASS: Record<string, string> = {
  up: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300',
  down: 'border-red-500/25 bg-red-500/10 text-red-400',
  success: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300',
  failed: 'border-red-500/25 bg-red-500/10 text-red-400',
  unknown: 'border-line bg-panel text-muted',
}
const STATUS_LABEL: Record<string, string> = {
  up: 'Activo', down: 'Caído', success: 'Exitosa', failed: 'Falló', unknown: 'Sin datos',
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'

  return new Date(iso).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <div class="p-4 sm:p-6 lg:p-8">
    <header class="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div>
        <p class="text-sm uppercase tracking-widest text-muted">UrbanBlade</p>
        <h1 class="mt-1 text-2xl font-semibold text-ink">Estado del <span class="text-gold">Servidor</span></h1>
        <p class="mt-1 text-sm text-muted">Conectividad, cola y tareas programadas — solo lectura.</p>
      </div>
      <button
        type="button" class="rounded-lg border border-line px-3 py-2 text-xs font-bold uppercase tracking-widest text-muted hover:text-ink"
        :disabled="pending" @click="refresh()"
      >
        {{ pending ? 'Actualizando…' : 'Actualizar' }}
      </button>
    </header>

    <p v-if="pending && !data" class="text-sm text-muted">Cargando…</p>
    <p v-else-if="error" class="text-sm text-red-400">No se pudo cargar el estado del servidor.</p>

    <template v-else-if="data">
      <section class="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div class="ui-card p-4"><p class="text-[10px] font-bold uppercase text-muted">Entorno</p><p class="mt-1 text-lg font-black text-ink">{{ data.app.env }}</p></div>
        <div class="ui-card p-4"><p class="text-[10px] font-bold uppercase text-muted">Laravel</p><p class="mt-1 text-lg font-black text-ink">{{ data.app.laravel_version }}</p></div>
        <div class="ui-card p-4"><p class="text-[10px] font-bold uppercase text-muted">PHP</p><p class="mt-1 text-lg font-black text-ink">{{ data.app.php_version }}</p></div>
        <div class="ui-card p-4"><p class="text-[10px] font-bold uppercase text-muted">Cola</p><p class="mt-1 text-lg font-black text-ink">{{ data.queue.connection }}</p></div>
      </section>

      <section class="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div class="ui-card p-5">
          <p class="text-[10px] font-bold uppercase tracking-widest text-muted">MongoDB</p>
          <div class="mt-2 flex items-center gap-2">
            <span class="rounded-full border px-2 py-0.5 text-[10px] font-black" :class="STATUS_CLASS[data.database.status]">{{ STATUS_LABEL[data.database.status] }}</span>
            <span v-if="data.database.latency_ms !== null" class="text-sm text-muted">{{ data.database.latency_ms }} ms</span>
          </div>
          <p v-if="data.database.error" class="mt-2 text-xs text-red-400">{{ data.database.error }}</p>
        </div>

        <div class="ui-card p-5">
          <p class="text-[10px] font-bold uppercase tracking-widest text-muted">Redis</p>
          <div class="mt-2 flex items-center gap-2">
            <span class="rounded-full border px-2 py-0.5 text-[10px] font-black" :class="STATUS_CLASS[data.redis.status]">{{ STATUS_LABEL[data.redis.status] }}</span>
            <span v-if="data.redis.latency_ms !== null" class="text-sm text-muted">{{ data.redis.latency_ms }} ms</span>
          </div>
          <p v-if="data.redis.error" class="mt-2 text-xs text-red-400">{{ data.redis.error }}</p>
        </div>

        <div class="ui-card p-5">
          <p class="text-[10px] font-bold uppercase tracking-widest text-muted">Jobs en cola</p>
          <div class="mt-2 flex items-center gap-4">
            <div><p class="text-2xl font-black text-ink">{{ data.queue.pending ?? '—' }}</p><p class="text-[10px] uppercase text-muted">Pendientes</p></div>
            <div><p class="text-2xl font-black" :class="(data.queue.failed ?? 0) > 0 ? 'text-red-400' : 'text-ink'">{{ data.queue.failed ?? '—' }}</p><p class="text-[10px] uppercase text-muted">Fallidos</p></div>
          </div>
        </div>
      </section>

      <section class="ui-card overflow-x-auto">
        <div class="border-b border-line px-4 py-3">
          <p class="text-sm font-bold text-ink">Tareas programadas</p>
        </div>
        <table class="w-full text-left text-sm">
          <thead>
            <tr class="border-b border-line text-[10px] uppercase tracking-wider text-muted">
              <th class="px-4 py-3">Tarea</th>
              <th class="px-4 py-3">Frecuencia</th>
              <th class="px-4 py-3">Última corrida</th>
              <th class="px-4 py-3">Estado</th>
              <th class="px-4 py-3">Duración</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="task in data.scheduled_tasks" :key="task.name" class="border-b border-line/60 last:border-0">
              <td class="px-4 py-3 text-ink">{{ task.name }}</td>
              <td class="px-4 py-3 font-mono text-xs text-muted">{{ task.expression }}</td>
              <td class="px-4 py-3 whitespace-nowrap text-muted">{{ fmtDate(task.ran_at) }}</td>
              <td class="px-4 py-3">
                <span class="rounded-full border px-2 py-0.5 text-[10px] font-black" :class="STATUS_CLASS[task.status]">{{ STATUS_LABEL[task.status] }}</span>
              </td>
              <td class="px-4 py-3 text-muted">{{ task.runtime_ms !== null ? `${task.runtime_ms} ms` : '—' }}</td>
            </tr>
          </tbody>
        </table>
      </section>
    </template>
  </div>
</template>
