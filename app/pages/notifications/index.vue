<script setup lang="ts">
/*
 * Última pieza que faltaba migrar del panel Blade retirado. La API ya
 * existía por completo (Api\Notification\NotificationController) --
 * barber/routes/web.php's /notifications solo dependía de la sesión web de
 * Laravel para que un humano llegara a esta pantalla; aquí llega por Bearer
 * token como el resto de la app. `url` en cada notificación ya apunta a
 * frontend_url desde el retiro del panel Blade (ver
 * .claude/skills/urbanblade-guardrails/SKILL.md, guardrail #18), así que el
 * click-through funciona sin ningún cambio adicional del lado de barber.
 */
definePageMeta({ middleware: 'auth', layout: 'dashboard' })

interface NotificationItem {
  id: string
  type: string
  data: { title?: string, message?: string, url?: string }
  read_at: string | null
  created_at: string | null
}

interface Preferences {
  in_app: boolean
  email: boolean
  sms: boolean
  whatsapp: boolean
  push: boolean
  promociones: boolean
}

const { apiFetch } = useApi()
const { confirm } = useConfirm()

const { data: response, pending, error, refresh } = await useAsyncData(
  'notifications-list',
  () => apiFetch<{ data: NotificationItem[], meta: { unread: number } }>('/notifications'),
)
const notifications = computed(() => response.value?.data ?? [])
const unread = computed(() => response.value?.meta?.unread ?? 0)

const { data: prefsResponse, refresh: refreshPrefs } = await useAsyncData(
  'notifications-preferences',
  () => apiFetch<{ data: Preferences }>('/notifications/preferences'),
)
const prefs = computed(() => prefsResponse.value?.data ?? null)

const savingPrefs = ref(false)
const prefsMessage = ref('')

const PREF_LABELS: Record<keyof Preferences, string> = {
  in_app: 'En la app',
  email: 'Correo electrónico',
  sms: 'SMS',
  whatsapp: 'WhatsApp',
  push: 'Notificaciones push',
  promociones: 'Promociones y campañas',
}

async function togglePref(key: keyof Preferences, value: boolean) {
  if (!prefs.value) return

  savingPrefs.value = true
  prefsMessage.value = ''
  try {
    await apiFetch('/notifications/preferences', { method: 'PATCH', body: { [key]: value } })
    await refreshPrefs()
    prefsMessage.value = 'Preferencias actualizadas.'
  } catch {
    prefsMessage.value = 'No se pudo actualizar. Intenta de nuevo.'
  } finally {
    savingPrefs.value = false
  }
}

const markingAll = ref(false)
async function markAllRead() {
  markingAll.value = true
  try {
    await apiFetch('/notifications/read-all', { method: 'POST' })
    await refresh()
  } finally {
    markingAll.value = false
  }
}

const busyId = ref<string | null>(null)

async function openNotification(n: NotificationItem) {
  if (!n.read_at) {
    busyId.value = n.id
    try {
      await apiFetch(`/notifications/${n.id}/read`, { method: 'POST' })
      await refresh()
    } finally {
      busyId.value = null
    }
  }
  if (n.data.url) {
    window.location.href = n.data.url
  }
}

async function removeNotification(n: NotificationItem) {
  const ok = await confirm({
    title: 'Eliminar notificación',
    message: '¿Eliminar esta notificación? No se puede deshacer.',
    confirmText: 'Eliminar',
    isDanger: true,
  })
  if (!ok) return

  busyId.value = n.id
  try {
    await apiFetch(`/notifications/${n.id}`, { method: 'DELETE' })
    await refresh()
  } finally {
    busyId.value = null
  }
}

function fmtDate(iso: string | null) {
  if (!iso) return ''

  return new Date(iso).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <div class="p-4 sm:p-6 lg:p-8">
    <header class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p class="text-sm uppercase tracking-widest text-muted">UrbanBlade</p>
        <h1 class="mt-1 text-2xl font-semibold text-ink">
          Notificaciones
          <span v-if="unread > 0" class="ml-2 rounded-full bg-gold px-2 py-0.5 text-xs font-bold text-black">{{ unread }}</span>
        </h1>
      </div>
      <button
        type="button" :disabled="markingAll || unread === 0"
        class="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-muted transition hover:border-gold/40 hover:text-ink disabled:opacity-50"
        @click="markAllRead"
      >
        {{ markingAll ? 'Marcando…' : 'Marcar todas como leídas' }}
      </button>
    </header>

    <p v-if="pending" class="text-sm text-muted">Cargando notificaciones…</p>
    <p v-else-if="error" class="text-sm text-red-400">No se pudieron cargar tus notificaciones.</p>
    <p v-else-if="!notifications.length" class="rounded-2xl border border-dashed border-line p-12 text-center text-sm text-muted">
      No tienes notificaciones todavía.
    </p>

    <ul v-else class="space-y-2">
      <li
        v-for="n in notifications" :key="n.id"
        class="ui-card flex items-start gap-3 p-4 transition"
        :class="n.read_at ? 'opacity-70' : 'border-gold/30'"
      >
        <span v-if="!n.read_at" class="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-gold" aria-hidden="true" />
        <span v-else class="mt-1.5 h-2 w-2 shrink-0" aria-hidden="true" />
        <button type="button" class="min-w-0 flex-1 text-left" :disabled="busyId === n.id" @click="openNotification(n)">
          <p class="font-semibold text-ink">{{ n.data.title ?? 'Notificación' }}</p>
          <p v-if="n.data.message" class="mt-0.5 text-sm text-muted">{{ n.data.message }}</p>
          <p class="mt-1 text-xs text-muted">{{ fmtDate(n.created_at) }}</p>
        </button>
        <button
          type="button" :disabled="busyId === n.id"
          class="shrink-0 rounded-lg p-2 text-muted transition hover:bg-accent hover:text-red-400 disabled:opacity-50"
          aria-label="Eliminar notificación"
          @click="removeNotification(n)"
        >
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </li>
    </ul>

    <section v-if="prefs" class="ui-card mt-8 space-y-4 p-6">
      <div>
        <h2 class="text-lg font-bold text-ink">Preferencias de notificación</h2>
        <p class="text-sm text-muted">Elige por qué canales quieres que te avisemos.</p>
      </div>
      <div class="grid gap-3 sm:grid-cols-2">
        <label
          v-for="(label, key) in PREF_LABELS" :key="key"
          class="flex items-center justify-between rounded-lg border border-line bg-main px-3 py-2.5"
        >
          <span class="text-sm text-ink">{{ label }}</span>
          <input
            type="checkbox" :checked="prefs[key]" :disabled="savingPrefs"
            class="h-4 w-4 rounded border-line accent-gold"
            @change="togglePref(key, ($event.target as HTMLInputElement).checked)"
          >
        </label>
      </div>
      <p v-if="prefsMessage" role="status" class="text-sm text-emerald-400">{{ prefsMessage }}</p>
    </section>
  </div>
</template>
