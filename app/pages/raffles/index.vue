<script setup lang="ts">
/*
 * Fase 9.9 — Historial de sorteos mensuales, puerto de Loyalty\RaffleController
 * (web). No existía ninguna API para esto antes de esta fase.
 */
definePageMeta({ middleware: ['auth', 'admin'], layout: 'dashboard' })

interface RaffleRow {
  id: string
  mes: string
  premio: string
  nivel_ganador: string | null
  vence_en: string | null
  reclamado_en: string | null
  client: { id: string | null, user: { name: string | null } }
  is_claimed: boolean
  is_expired: boolean
}

interface Stats { total: number, reclamados: number, vigentes: number }

const { apiFetch } = useApi()

const { data: response, pending, error } = await useAsyncData(
  'raffles-list',
  () => apiFetch<{ data: RaffleRow[], stats: Stats }>('/raffles'),
)
const raffles = computed(() => response.value?.data ?? [])
const stats = computed<Stats>(() => response.value?.stats ?? { total: 0, reclamados: 0, vigentes: 0 })

function fmtDate(iso: string | null) {
  if (!iso) return '—'

  return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

function statusOf(r: RaffleRow) {
  if (r.is_claimed) return { label: 'Reclamado', class: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300' }
  if (r.is_expired) return { label: 'Caducado', class: 'border-red-500/25 bg-red-500/10 text-red-400' }

  return { label: `Vigente hasta ${fmtDate(r.vence_en)}`, class: 'border-amber-500/25 bg-amber-500/10 text-amber-300' }
}
</script>

<template>
  <div class="p-4 sm:p-6 lg:p-8">
    <header class="mb-6">
      <p class="text-sm uppercase tracking-widest text-muted">UrbanBlade</p>
      <h1 class="mt-1 text-2xl font-semibold text-ink">Historial de <span class="text-gold">Sorteos</span></h1>
      <p class="mt-1 text-sm text-muted">Ganadores mensuales del sorteo de lealtad y estado de sus premios.</p>
    </header>

    <section v-if="!pending && !error" class="mb-6 grid grid-cols-3 gap-3 sm:w-fit">
      <div class="ui-card p-4"><p class="text-[10px] font-bold uppercase text-muted">Total</p><p class="mt-1 text-xl font-black text-ink">{{ stats.total }}</p></div>
      <div class="ui-card p-4"><p class="text-[10px] font-bold uppercase text-muted">Reclamados</p><p class="mt-1 text-xl font-black text-emerald-400">{{ stats.reclamados }}</p></div>
      <div class="ui-card p-4"><p class="text-[10px] font-bold uppercase text-muted">Vigentes</p><p class="mt-1 text-xl font-black text-gold">{{ stats.vigentes }}</p></div>
    </section>

    <p v-if="pending" class="text-sm text-muted">Cargando…</p>
    <p v-else-if="error" class="text-sm text-red-400">No se pudo cargar el historial de sorteos.</p>
    <p v-else-if="!raffles.length" class="rounded-2xl border border-dashed border-line p-12 text-center text-sm text-muted">
      Todavía no hay resultados de sorteos.
    </p>

    <section v-else class="ui-card overflow-x-auto">
      <table class="w-full text-left text-sm">
        <thead>
          <tr class="border-b border-line text-[10px] uppercase tracking-wider text-muted">
            <th class="px-4 py-3">Mes</th>
            <th class="px-4 py-3">Ganador</th>
            <th class="px-4 py-3">Nivel</th>
            <th class="px-4 py-3">Premio</th>
            <th class="px-4 py-3 text-right">Estado</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in raffles" :key="r.id" class="border-b border-line/60 last:border-0">
            <td class="px-4 py-3 text-ink">{{ r.mes }}</td>
            <td class="px-4 py-3 font-bold text-ink">{{ r.client.user.name ?? '—' }}</td>
            <td class="px-4 py-3 text-muted">{{ r.nivel_ganador ?? '—' }}</td>
            <td class="px-4 py-3 text-muted">{{ r.premio }}</td>
            <td class="px-4 py-3 text-right">
              <span class="rounded-full border px-2 py-0.5 text-[10px] font-black" :class="statusOf(r).class">{{ statusOf(r).label }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>
