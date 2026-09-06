/**
 * Suscripción Web Push (VAPID) del navegador actual. Ver
 * .claude/skills/push-and-chat-plan/SKILL.md, Fase 2 — backend ya construido
 * en barber (commit 00317fd): GET /push/vapid-public-key, POST/DELETE
 * /push/subscribe.
 */
export function usePush() {
  const { apiFetch } = useApi()

  const isSupported = useState<boolean>('push_supported', () => false)
  const permission = useState<NotificationPermission>('push_permission', () => 'default')
  const isSubscribed = useState<boolean>('push_subscribed', () => false)
  const loading = ref(false)
  const error = ref('')

  function detectSupport() {
    isSupported.value = typeof window !== 'undefined'
      && 'serviceWorker' in navigator
      && 'PushManager' in window
      && 'Notification' in window

    if (isSupported.value) permission.value = Notification.permission
  }

  async function refreshSubscriptionState() {
    if (!isSupported.value) return

    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()
    isSubscribed.value = !!subscription
  }

  function urlBase64ToUint8Array(base64: string): Uint8Array {
    const padding = '='.repeat((4 - (base64.length % 4)) % 4)
    const base64Safe = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
    const raw = atob(base64Safe)

    return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
  }

  async function subscribe() {
    if (!isSupported.value) return

    loading.value = true
    error.value = ''

    try {
      const perm = await Notification.requestPermission()
      permission.value = perm

      if (perm !== 'granted') {
        error.value = 'Permiso de notificaciones denegado.'

        return
      }

      const { public_key: publicKey } = await apiFetch<{ public_key: string | null }>('/push/vapid-public-key')

      if (!publicKey) {
        error.value = 'El servidor no tiene configurado Web Push todavía.'

        return
      }

      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      })

      const json = subscription.toJSON()
      await apiFetch('/push/subscribe', {
        method: 'POST',
        body: { endpoint: json.endpoint, keys: json.keys },
      })

      isSubscribed.value = true
    } catch {
      error.value = 'No se pudo activar las notificaciones push.'
    } finally {
      loading.value = false
    }
  }

  async function unsubscribe() {
    if (!isSupported.value) return

    loading.value = true
    error.value = ''

    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()

      if (subscription) {
        await apiFetch('/push/subscribe', {
          method: 'DELETE',
          body: { endpoint: subscription.endpoint },
        })
        await subscription.unsubscribe()
      }

      isSubscribed.value = false
    } catch {
      error.value = 'No se pudo desactivar las notificaciones push.'
    } finally {
      loading.value = false
    }
  }

  async function toggle() {
    if (isSubscribed.value) {
      await unsubscribe()
    } else {
      await subscribe()
    }
  }

  return { isSupported, permission, isSubscribed, loading, error, detectSupport, refreshSubscriptionState, subscribe, unsubscribe, toggle }
}
