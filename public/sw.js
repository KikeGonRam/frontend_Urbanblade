// Service worker de UrbanBlade: Web Push (VAPID) y funcionamiento sin conexión.
//
// Estrategias (solo peticiones GET del mismo origen):
//  - Navegación: red primero. Si falla, la copia de esa misma página (si ya se visitó)
//    o, en su defecto, /offline.html.
//  - /_nuxt/ (archivos con hash), fuentes e íconos: caché primero.
//  - Imágenes y videos: se sirven de la caché y se actualizan en segundo plano.
//  - La API (/api/) y cualquier otro origen NO se cachean: la sesión y los pagos nunca
//    deben leerse de una copia vieja.
// Subir CACHE_VERSION invalida todas las copias anteriores.

const CACHE_VERSION = 'v1'
const PRECACHE = `ub-precache-${CACHE_VERSION}`
const PAGES = `ub-pages-${CACHE_VERSION}`
const ASSETS = `ub-assets-${CACHE_VERSION}`
const MAX_PAGES = 30
const MAX_ASSETS = 120

const PRECACHE_URLS = [
  '/offline.html',
  '/offline.css',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/images/urbanblade-mark.svg',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(PRECACHE).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  const keep = new Set([PRECACHE, PAGES, ASSETS])
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('ub-') && !keep.has(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName)
  const keys = await cache.keys()
  if (keys.length > max) await Promise.all(keys.slice(0, keys.length - max).map((k) => cache.delete(k)))
}

async function networkFirstPage(request) {
  try {
    const response = await fetch(request)
    // Solo respuestas completas y sin redirección (una página de login redirigida no se guarda).
    if (response.ok && response.type === 'basic' && !response.redirected) {
      const cache = await caches.open(PAGES)
      await cache.put(request, response.clone())
      trim(PAGES, MAX_PAGES)
    }
    return response
  } catch {
    const cached = await caches.match(request, { cacheName: PAGES })
    return cached || (await caches.match('/offline.html', { cacheName: PRECACHE })) || Response.error()
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response.ok && response.type === 'basic') {
    const cache = await caches.open(ASSETS)
    await cache.put(request, response.clone())
    trim(ASSETS, MAX_ASSETS)
  }
  return response
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(ASSETS)
  const cached = await cache.match(request)
  const fresh = fetch(request)
    .then((response) => {
      if (response.ok && response.type === 'basic') {
        cache.put(request, response.clone())
        trim(ASSETS, MAX_ASSETS)
      }
      return response
    })
    .catch(() => cached || Response.error())
  return cached || fresh
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/')) return
  // Los videos se piden por rangos de bytes; una respuesta parcial no se puede reutilizar.
  if (request.headers.has('range')) return

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstPage(request))
    return
  }

  if (url.pathname.startsWith('/_nuxt/') || /\.(?:woff2?|ttf)$/.test(url.pathname) || url.pathname.startsWith('/icons/')) {
    event.respondWith(cacheFirst(request))
    return
  }

  if (/\.(?:png|jpe?g|webp|avif|gif|svg|ico)$/.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request))
  }
})

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
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
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
