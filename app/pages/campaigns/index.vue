<script setup lang="ts">
/*
 * Fase 9.9 — Campañas de marketing por segmento, puerto de
 * Campaign\CampaignController (web). No existía ninguna API para esto antes
 * de esta fase — se construyó Api\Campaign\CampaignController desde cero,
 * reutilizando el mismo CampaignDispatcher del lado servidor.
 */
definePageMeta({ middleware: ['auth', 'admin'], layout: 'dashboard' })

interface CampaignRow {
  id: string
  titulo: string
  cuerpo: string
  cta_label: string | null
  cta_url: string | null
  segmento: string
  destinatarios: number
  estado: string
  programada_para: string | null
  enviada_en: string | null
  created_at: string | null
  opens: number
  clicks: number
  open_rate: number
  click_rate: number
}

interface IndexResponse {
  levels: Record<string, string>
  segment_counts: Record<string, number>
  data: CampaignRow[]
}

const ESTADO_LABEL: Record<string, string> = { programada: 'Programada', enviada: 'Enviada' }
const ESTADO_CLASS: Record<string, string> = {
  programada: 'border-amber-500/25 bg-amber-500/10 text-amber-300',
  enviada: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300',
}

const { apiFetch } = useApi()

const { data: response, pending, error, refresh } = await useAsyncData(
  'campaigns-list',
  () => apiFetch<IndexResponse>('/campaigns'),
)
const campaigns = computed(() => response.value?.data ?? [])
const levels = computed(() => response.value?.levels ?? {})
const segmentCounts = computed(() => response.value?.segment_counts ?? {})

const segmentOptions = computed(() => [
  { value: 'todos', label: `Todos (${segmentCounts.value.todos ?? 0})` },
  { value: 'inactive', label: `En riesgo — 30+ días sin cita (${segmentCounts.value.inactive ?? 0})` },
  ...Object.entries(levels.value).map(([value, label]) => ({ value, label: `${label} (${segmentCounts.value[value] ?? 0})` })),
])

function fmtDate(iso: string | null) {
  if (!iso) return '—'

  return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ── Enviar / programar ───────────────────────────────────────────────────
const form = reactive({ titulo: '', cuerpo: '', cta_label: '', cta_url: '', segmento: 'todos', modo: 'ahora' as 'ahora' | 'programar', programada_para: '' })
const sending = ref(false)
const formError = ref('')
const formSuccess = ref('')

async function submitCampaign() {
  sending.value = true
  formError.value = ''
  formSuccess.value = ''
  try {
    const res = await apiFetch<{ message: string }>('/campaigns', {
      method: 'POST',
      body: {
        titulo: form.titulo,
        cuerpo: form.cuerpo,
        cta_label: form.cta_label || undefined,
        cta_url: form.cta_url || undefined,
        segmento: form.segmento,
        modo: form.modo,
        programada_para: form.modo === 'programar' ? form.programada_para : undefined,
      },
    })
    formSuccess.value = res.message
    form.titulo = ''
    form.cuerpo = ''
    form.cta_label = ''
    form.cta_url = ''
    form.programada_para = ''
    await refresh()
  } catch (err: unknown) {
    formError.value = (err as { data?: { message?: string } })?.data?.message ?? 'No se pudo enviar la campaña.'
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <div class="p-4 sm:p-6 lg:p-8">
    <header class="mb-6">
      <p class="text-sm uppercase tracking-widest text-muted">UrbanBlade</p>
      <h1 class="mt-1 text-2xl font-semibold text-ink">Campañas de <span class="text-gold">Marketing</span></h1>
      <p class="mt-1 text-sm text-muted">Envía promociones a un segmento de clientes por nivel de lealtad, ahora o programadas.</p>
    </header>

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-[380px_1fr]">
      <section class="ui-card h-fit p-5">
        <h2 class="mb-4 text-sm font-black uppercase tracking-wide text-ink">Nueva campaña</h2>
        <form class="space-y-3" @submit.prevent="submitCampaign">
          <div>
            <label class="mb-1 block text-xs text-muted">Título</label>
            <input v-model="form.titulo" type="text" required maxlength="150" class="w-full rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink">
          </div>
          <div>
            <label class="mb-1 block text-xs text-muted">Mensaje</label>
            <textarea v-model="form.cuerpo" rows="3" required maxlength="2000" class="w-full rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink" />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="mb-1 block text-xs text-muted">Texto del botón (opcional)</label>
              <input v-model="form.cta_label" type="text" maxlength="40" class="w-full rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink">
            </div>
            <div>
              <label class="mb-1 block text-xs text-muted">URL del botón (opcional)</label>
              <input v-model="form.cta_url" type="url" maxlength="300" class="w-full rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink">
            </div>
          </div>
          <div>
            <label class="mb-1 block text-xs text-muted">Segmento</label>
            <select v-model="form.segmento" class="w-full rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink">
              <option v-for="opt in segmentOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </select>
          </div>
          <div>
            <label class="mb-1 block text-xs text-muted">Envío</label>
            <div class="flex gap-3 text-sm text-ink">
              <label class="flex items-center gap-1.5"><input v-model="form.modo" type="radio" value="ahora"> Ahora</label>
              <label class="flex items-center gap-1.5"><input v-model="form.modo" type="radio" value="programar"> Programar</label>
            </div>
          </div>
          <div v-if="form.modo === 'programar'">
            <label class="mb-1 block text-xs text-muted">Fecha y hora</label>
            <input v-model="form.programada_para" type="datetime-local" required class="w-full rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink">
          </div>
          <p v-if="formError" class="text-sm text-red-400">{{ formError }}</p>
          <p v-if="formSuccess" class="text-sm text-emerald-400">{{ formSuccess }}</p>
          <button type="submit" :disabled="sending" class="w-full rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-black hover:bg-gold-dim disabled:opacity-50">
            {{ sending ? 'Enviando…' : form.modo === 'ahora' ? 'Enviar ahora' : 'Programar' }}
          </button>
        </form>
      </section>

      <section>
        <h2 class="mb-3 text-sm font-black uppercase tracking-wide text-ink">Últimas campañas</h2>
        <p v-if="pending" class="text-sm text-muted">Cargando…</p>
        <p v-else-if="error" class="text-sm text-red-400">No se pudieron cargar las campañas.</p>
        <p v-else-if="!campaigns.length" class="rounded-2xl border border-dashed border-line p-12 text-center text-sm text-muted">
          Todavía no se ha enviado ninguna campaña.
        </p>
        <div v-else class="space-y-3">
          <div v-for="c in campaigns" :key="c.id" class="ui-card p-4">
            <div class="mb-1 flex flex-wrap items-center justify-between gap-2">
              <p class="font-black text-ink">{{ c.titulo }}</p>
              <span class="rounded-full border px-2 py-0.5 text-[10px] font-black uppercase" :class="ESTADO_CLASS[c.estado]">{{ ESTADO_LABEL[c.estado] ?? c.estado }}</span>
            </div>
            <p class="mb-2 text-sm text-muted">{{ c.cuerpo }}</p>
            <div class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
              <span>Segmento: <span class="text-ink">{{ c.segmento }}</span></span>
              <span>Destinatarios: <span class="text-ink">{{ c.destinatarios }}</span></span>
              <span v-if="c.estado === 'enviada'">Aperturas: <span class="text-ink">{{ c.opens }} ({{ c.open_rate }}%)</span></span>
              <span v-if="c.estado === 'enviada'">Clics: <span class="text-ink">{{ c.clicks }} ({{ c.click_rate }}%)</span></span>
              <span>{{ c.estado === 'enviada' ? fmtDate(c.enviada_en) : `Programada: ${fmtDate(c.programada_para)}` }}</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
