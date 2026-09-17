<script setup lang="ts">
interface NotificationItem {
  id: string
  type: string
  data: { title?: string, message?: string, url?: string }
  read_at: string | null
  created_at: string | null
}

defineProps<{ collapsed?: boolean }>()

const { apiFetch } = useApi()
const route = useRoute()
const open = ref(false)
const trigger = ref<HTMLButtonElement | null>(null)
const panel = ref<HTMLElement | null>(null)
const panelStyle = ref<Record<string, string>>({})
const markingAll = ref(false)
const busyId = ref<string | null>(null)

const { data: response, pending, error, refresh } = await useLazyAsyncData(
  'notification-center',
  () => apiFetch<{ data: NotificationItem[], meta: { unread: number } }>('/notifications'),
  { default: () => ({ data: [], meta: { unread: 0 } }) },
)

const notifications = computed(() => response.value?.data.slice(0, 6) ?? [])
const unread = computed(() => response.value?.meta?.unread ?? 0)

function placePanel() {
  if (!trigger.value) return
  const rect = trigger.value.getBoundingClientRect()
  const width = Math.min(388, window.innerWidth - 32)
  const top = Math.min(Math.max(16, rect.top - 12), window.innerHeight - 540)
  panelStyle.value = {
    left: `${Math.min(rect.right + 12, window.innerWidth - width - 16)}px`,
    top: `${Math.max(16, top)}px`,
    width: `${width}px`,
  }
}

async function togglePanel() {
  open.value = !open.value
  if (!open.value) return
  await nextTick()
  placePanel()
  await refresh()
}

async function markAllRead() {
  markingAll.value = true
  try {
    await apiFetch('/notifications/read-all', { method: 'POST' })
    await refresh()
  } finally {
    markingAll.value = false
  }
}

async function openNotification(notification: NotificationItem) {
  busyId.value = notification.id
  try {
    if (!notification.read_at) {
      await apiFetch(`/notifications/${notification.id}/read`, { method: 'POST' })
      await refresh()
    }
  } finally {
    busyId.value = null
  }

  open.value = false
  if (notification.data.url) await navigateTo(notification.data.url, { external: true })
}

function fmtDate(iso: string | null) {
  if (!iso) return ''
  const minutes = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60_000))
  const formatter = new Intl.RelativeTimeFormat('es', { numeric: 'auto' })
  if (minutes < 60) return formatter.format(-minutes, 'minute')
  if (minutes < 1_440) return formatter.format(-Math.round(minutes / 60), 'hour')
  if (minutes < 10_080) return formatter.format(-Math.round(minutes / 1_440), 'day')

  return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })
}

function closeFromOutside(event: PointerEvent) {
  const target = event.target as Node
  if (trigger.value?.contains(target) || panel.value?.contains(target)) return
  open.value = false
}

function closeWithEscape(event: KeyboardEvent) {
  if (event.key !== 'Escape' || !open.value) return
  open.value = false
  nextTick(() => trigger.value?.focus())
}

watch(() => route.fullPath, () => { open.value = false })

onMounted(() => {
  document.addEventListener('pointerdown', closeFromOutside)
  document.addEventListener('keydown', closeWithEscape)
  window.addEventListener('resize', placePanel)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', closeFromOutside)
  document.removeEventListener('keydown', closeWithEscape)
  window.removeEventListener('resize', placePanel)
})
</script>

<template>
  <button
    ref="trigger"
    type="button"
    class="ub-sidebar__item w-full"
    :class="{ 'is-active': open, 'is-collapsed': collapsed }"
    :aria-expanded="open"
    aria-label="Notificaciones"
    aria-haspopup="dialog"
    aria-controls="notification-center-panel"
    :title="collapsed ? 'Notificaciones' : undefined"
    @click="togglePanel"
  >
    <span class="relative shrink-0">
      <ShellNavIcon paths="<path d='M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9'/><path d='M13.73 21a2 2 0 0 1-3.46 0'/>" />
      <span v-if="unread" aria-hidden="true" class="absolute -right-2 -top-2 grid min-h-4 min-w-4 place-items-center rounded-full bg-gold px-1 text-[9px] font-black text-black">
        {{ unread > 99 ? '99+' : unread }}
      </span>
    </span>
    <span v-show="!collapsed">Notificaciones</span>
  </button>

  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="translate-x-2 scale-95 opacity-0"
      enter-to-class="translate-x-0 scale-100 opacity-100"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="translate-x-0 scale-100 opacity-100"
      leave-to-class="translate-x-2 scale-95 opacity-0"
    >
      <section
        v-if="open"
        id="notification-center-panel"
        ref="panel"
        role="dialog"
        aria-modal="false"
        aria-labelledby="notification-center-title"
        class="fixed z-[80] max-h-[min(620px,calc(100vh-32px))] overflow-hidden rounded-2xl border border-line bg-card shadow-2xl"
        :style="panelStyle"
      >
        <header class="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <h2 id="notification-center-title" class="text-lg font-black text-ink">Notificaciones</h2>
            <p class="text-xs text-muted">{{ unread ? `${unread} sin leer` : 'Todo al día' }}</p>
          </div>
          <button
            type="button"
            class="min-h-11 rounded-lg px-3 text-xs font-bold text-gold transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="markingAll || unread === 0"
            @click="markAllRead"
          >
            {{ markingAll ? 'Marcando…' : 'Marcar leídas' }}
          </button>
        </header>

        <div class="max-h-[430px] overflow-y-auto overscroll-contain p-2">
          <p v-if="pending" class="px-4 py-10 text-center text-sm text-muted" role="status">Cargando notificaciones…</p>
          <div v-else-if="error" class="p-5 text-center">
            <p class="text-sm font-semibold text-ink">No pudimos cargar tus notificaciones</p>
            <button type="button" class="mt-3 min-h-11 rounded-lg px-4 text-sm font-bold text-gold hover:bg-accent" @click="refresh">Reintentar</button>
          </div>
          <div v-else-if="!notifications.length" class="px-5 py-10 text-center">
            <div class="mx-auto grid h-12 w-12 place-items-center rounded-full bg-gold/10 text-gold">
              <ShellNavIcon paths="<path d='M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9'/><path d='M13.73 21a2 2 0 0 1-3.46 0'/>" />
            </div>
            <p class="mt-3 font-bold text-ink">No tienes avisos nuevos</p>
            <p class="mt-1 text-sm text-muted">Aquí aparecerán tus citas, pagos y novedades.</p>
          </div>
          <ul v-else class="space-y-1">
            <li v-for="notification in notifications" :key="notification.id">
              <button
                type="button"
                class="group flex min-h-[72px] w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-accent disabled:opacity-50"
                :class="notification.read_at ? '' : 'bg-gold/[0.07]'"
                :disabled="busyId === notification.id"
                @click="openNotification(notification)"
              >
                <span class="mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gold/15 text-gold">
                  <ShellNavIcon paths="<path d='M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z'/>" />
                </span>
                <span class="min-w-0 flex-1">
                  <strong class="block truncate text-sm text-ink">{{ notification.data.title ?? 'Notificación' }}</strong>
                  <span v-if="notification.data.message" class="mt-0.5 line-clamp-2 block text-xs leading-5 text-muted">{{ notification.data.message }}</span>
                  <small class="mt-1 block text-[11px] font-semibold text-gold">{{ fmtDate(notification.created_at) }}</small>
                </span>
                <span v-if="!notification.read_at" aria-hidden="true" class="mt-4 h-2.5 w-2.5 shrink-0 rounded-full bg-gold" />
              </button>
            </li>
          </ul>
        </div>

        <footer class="border-t border-line p-2">
          <NuxtLink to="/notifications" class="flex min-h-11 items-center justify-center rounded-xl text-sm font-black text-gold transition hover:bg-accent" @click="open = false">
            Ver todas las notificaciones
          </NuxtLink>
        </footer>
      </section>
    </Transition>
  </Teleport>
</template>
