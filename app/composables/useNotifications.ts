/*
 * Carga y marcado de notificaciones, compartido por el desplegable del sidebar
 * (NotificationCenter) y la página /notifications. Antes cada uno pedía
 * GET /notifications por su cuenta y repetía «marcar todas» y «marcar una»;
 * ahora usan la misma clave de useAsyncData, así que el contador del sidebar se
 * actualiza al leer o borrar desde la página (y al revés).
 *
 * Endpoints sin cambios: GET /notifications, POST /notifications/read-all,
 * POST /notifications/{id}/read y DELETE /notifications/{id}.
 */
export interface NotificationItem {
  id: string
  type: string
  data: { title?: string, message?: string, url?: string }
  read_at: string | null
  created_at: string | null
}

interface NotificationsResponse {
  data: NotificationItem[]
  meta: { unread: number }
}

/** Solo destinos del propio sitio: ruta interna o URL absoluta del mismo origen (nunca otro dominio). */
export function safeNotificationUrl(raw: unknown): string | null {
  const internal = safeWebPath(raw)
  if (internal) return internal
  if (typeof raw !== 'string' || !import.meta.client) return null
  try {
    const url = new URL(raw)
    return url.origin === window.location.origin ? url.href : null
  } catch {
    return null
  }
}

export function useNotifications() {
  const { apiFetch } = useApi()

  const { data: response, pending, error, refresh } = useLazyAsyncData(
    'notifications',
    () => apiFetch<NotificationsResponse>('/notifications'),
    { default: (): NotificationsResponse => ({ data: [], meta: { unread: 0 } }) },
  )

  const notifications = computed(() => response.value?.data ?? [])
  const unread = computed(() => response.value?.meta?.unread ?? 0)
  const markingAll = ref(false)
  const busyId = ref<string | null>(null)

  async function markAllRead() {
    markingAll.value = true
    try {
      await apiFetch('/notifications/read-all', { method: 'POST' })
      await refresh()
    } finally {
      markingAll.value = false
    }
  }

  /** Marca como leída (si hacía falta) y navega a su destino, solo si es del propio sitio. */
  async function openNotification(notification: NotificationItem, beforeNavigate?: () => void) {
    if (!notification.read_at) {
      busyId.value = notification.id
      try {
        await apiFetch(`/notifications/${notification.id}/read`, { method: 'POST' })
        await refresh()
      } finally {
        busyId.value = null
      }
    }

    beforeNavigate?.()
    const target = safeNotificationUrl(notification.data.url)
    if (target) await navigateTo(target, { external: true })
  }

  async function deleteNotification(notification: NotificationItem) {
    busyId.value = notification.id
    try {
      await apiFetch(`/notifications/${notification.id}`, { method: 'DELETE' })
      await refresh()
    } finally {
      busyId.value = null
    }
  }

  return { notifications, unread, pending, error, refresh, markingAll, busyId, markAllRead, openNotification, deleteNotification }
}
