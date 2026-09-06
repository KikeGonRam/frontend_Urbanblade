// Service worker mínimo para Web Push (VAPID) — ver
// .claude/skills/push-and-chat-plan/SKILL.md, Fase 2. No cachea nada más:
// este proyecto no es una PWA offline-first, solo necesita el SW para poder
// recibir eventos "push" y "notificationclick" en segundo plano.

self.addEventListener('push', (event) => {
  let data = { title: 'UrbanBlade', body: 'Tienes una notificación nueva.', url: '/' }

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() }
    } catch {
      data.body = event.data.text()
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/favicon.ico',
      data: { url: data.url },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const url = event.notification.data?.url || '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url === url && 'focus' in client) return client.focus()
      }

      if (self.clients.openWindow) return self.clients.openWindow(url)
    }),
  )
})
