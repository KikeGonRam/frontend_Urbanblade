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

const health = computed(() => {
  if (!data.value) return { label: 'Comprobando', detail: 'Leyendo el estado actual del entorno.', dot: 'bg-muted', surface: 'border-line bg-ink/[0.03]' }

  const unavailable = data.value.database.status === 'down' || data.value.redis.status === 'down'
  const failedJobs = data.value.queue.failed ?? 0
  const failedTasks = data.value.scheduled_tasks.filter(task => task.status === 'failed').length

  if (unavailable) return { label: 'Servicio crítico', detail: 'Hay una dependencia de infraestructura sin respuesta.', dot: 'bg-red-400', surface: 'border-red-500/25 bg-red-500/[0.05]' }
  if (failedJobs > 0 || failedTasks > 0) return { label: 'Requiere atención', detail: `${failedJobs} jobs y ${failedTasks} tareas requieren revisión.`, dot: 'bg-amber-300', surface: 'border-amber-500/25 bg-amber-500/[0.05]' }

  return { label: 'Entorno estable', detail: 'Las dependencias y las últimas tareas reportan estado saludable.', dot: 'bg-emerald-300', surface: 'border-emerald-500/25 bg-emerald-500/[0.05]' }
})

function fmtDate(iso: string | null) {
  if (!iso) return '—'

  return new Date(iso).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <div class="space-y-5 p-4 sm:p-6 lg:p-8">
    <header class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p class="text-sm uppercase tracking-widest text-muted">UrbanBlade</p>
        <h1 class="mt-1 text-2xl font-semibold text-ink">Estado del <span class="text-gold">Servidor</span></h1>
        <p class="mt-1 text-sm text-muted">Conectividad, cola y tareas programadas — solo lectura.</p>
      </div>
      <button
        type="button" class="min-h-10 rounded-lg border border-line px-3 py-2 text-xs font-bold uppercase tracking-widest text-muted transition hover:border-gold/40 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-2"
        :disabled="pending" @click="refresh()"
      >
        {{ pending ? 'Actualizando…' : 'Actualizar' }}
      </button>
    </header>

    <p v-if="pending && !data" class="text-sm text-muted">Cargando…</p>
    <p v-else-if="error" class="text-sm text-red-400">No se pudo cargar el estado del servidor.</p>

    <template v-else-if="data">
      <section class="overflow-hidden rounded-2xl border p-5 sm:p-6" :class="health.surface" aria-live="polite">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div class="flex items-start gap-3">
            <span class="mt-1 flex h-3 w-3 shrink-0 rounded-full" :class="health.dot" />
            <div><p class="text-[10px] font-black uppercase tracking-[0.2em] text-ink/45">Resumen de monitor</p><h2 class="mt-1 text-xl font-black text-ink">{{ health.label }}</h2><p class="mt-1 text-sm text-muted">{{ health.detail }}</p></div>
          </div>
          <div class="flex flex-wrap gap-2"><NuxtLink to="/dashboard" class="rounded-xl border border-line bg-card px-3 py-2 text-[10px] font-black uppercase tracking-widest text-muted transition hover:border-gold/40 hover:text-gold">Módulos</NuxtLink><NuxtLink to="/reports" class="rounded-xl border border-line bg-card px-3 py-2 text-[10px] font-black uppercase tracking-widest text-muted transition hover:border-gold/40 hover:text-gold">Reportes</NuxtLink><NuxtLink to="/logs" class="rounded-xl border border-line bg-card px-3 py-2 text-[10px] font-black uppercase tracking-widest text-muted transition hover:border-gold/40 hover:text-gold">Logs</NuxtLink></div>
        </div>
      </section>

      <section class="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div class="rounded-2xl border border-ink/[0.06] bg-card p-4"><p class="text-[9px] font-black uppercase tracking-widest text-ink/50">Entorno</p><p class="mt-1 text-lg font-black text-ink">{{ data.app.env }}</p></div>
        <div class="rounded-2xl border border-ink/[0.06] bg-card p-4"><p class="text-[9px] font-black uppercase tracking-widest text-ink/50">Laravel</p><p class="mt-1 text-lg font-black text-ink">{{ data.app.laravel_version }}</p></div>
        <div class="rounded-2xl border border-ink/[0.06] bg-card p-4"><p class="text-[9px] font-black uppercase tracking-widest text-ink/50">PHP</p><p class="mt-1 text-lg font-black text-ink">{{ data.app.php_version }}</p></div>
        <div class="rounded-2xl border border-ink/[0.06] bg-card p-4"><p class="text-[9px] font-black uppercase tracking-widest text-ink/50">Cola</p><p class="mt-1 text-lg font-black text-ink">{{ data.queue.connection }}</p></div>
      </section>

      <section class="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div class="rounded-2xl border border-ink/[0.06] bg-card p-5">
          <div class="flex items-center justify-between">
            <p class="text-[9px] font-black uppercase tracking-[0.25em] text-ink/50">MongoDB</p>
            <span class="relative flex h-3 w-3">
              <span v-if="data.database.status === 'up'" class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span class="relative inline-flex h-3 w-3 rounded-full" :class="data.database.status === 'up' ? 'bg-emerald-400' : 'bg-red-500'" />
            </span>
          </div>
          <p class="mt-3 text-xl font-black" :class="data.database.status === 'up' ? 'text-emerald-400' : 'text-red-400'">{{ STATUS_LABEL[data.database.status] }}</p>
          <p v-if="data.database.latency_ms !== null" class="mt-1 text-xs text-ink/45">{{ data.database.latency_ms }} ms de latencia</p>
          <p v-if="data.database.error" class="mt-2 text-xs text-red-400">{{ data.database.error }}</p>
        </div>

        <div class="rounded-2xl border border-ink/[0.06] bg-card p-5">
          <div class="flex items-center justify-between">
            <p class="text-[9px] font-black uppercase tracking-[0.25em] text-ink/50">Redis</p>
            <span class="relative flex h-3 w-3">
              <span v-if="data.redis.status === 'up'" class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span class="relative inline-flex h-3 w-3 rounded-full" :class="data.redis.status === 'up' ? 'bg-emerald-400' : 'bg-red-500'" />
            </span>
          </div>
          <p class="mt-3 text-xl font-black" :class="data.redis.status === 'up' ? 'text-emerald-400' : 'text-red-400'">{{ STATUS_LABEL[data.redis.status] }}</p>
          <p v-if="data.redis.latency_ms !== null" class="mt-1 text-xs text-ink/45">{{ data.redis.latency_ms }} ms de latencia</p>
          <p v-if="data.redis.error" class="mt-2 text-xs text-red-400">{{ data.redis.error }}</p>
        </div>

        <div class="rounded-2xl border border-ink/[0.06] bg-card p-5">
          <p class="text-[9px] font-black uppercase tracking-[0.25em] text-ink/50">Jobs en cola</p>
          <div class="mt-3 flex items-center gap-5">
            <div><p class="text-2xl font-black leading-none text-ink">{{ data.queue.pending ?? '—' }}</p><p class="mt-1 text-[9px] font-black uppercase text-ink/40">Pendientes</p></div>
            <div class="h-8 w-px bg-ink/[0.08]" />
            <div><p class="text-2xl font-black leading-none" :class="(data.queue.failed ?? 0) > 0 ? 'text-red-400' : 'text-ink'">{{ data.queue.failed ?? '—' }}</p><p class="mt-1 text-[9px] font-black uppercase text-ink/40">Fallidos</p></div>
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
