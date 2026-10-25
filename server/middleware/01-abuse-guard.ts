import { AbuseGuard, clientIp, isPrivateIp } from '../utils/abuse'

/**
 * Bloquea un rato a la IP que manda demasiadas peticiones en pocos segundos: más de 300 en 10 s
 * (30 por segundo) la dejan 10 min en 429, y cada reincidencia en 24 h duplica el bloqueo.
 *
 * Solo actúa si TRUSTED_PROXY_HOPS es mayor que 0 (en staging, 2: CloudFront y el ALB). Sin eso la
 * única IP visible sería la del balanceador y un bloqueo apagaría el sitio para todos, así que por
 * defecto no hace nada. Las IPs privadas, la lista ABUSE_ALLOWLIST y /api/health quedan exentas.
 */
const hops = Number(process.env.TRUSTED_PROXY_HOPS ?? 0)
const activo = hops > 0 && process.env.ABUSE_BLOCK_ENABLED !== 'false'

const guard = new AbuseGuard({
  maxRequests: Number(process.env.ABUSE_MAX_REQUESTS ?? 300),
  windowSeconds: Number(process.env.ABUSE_WINDOW_SECONDS ?? 10),
  banSeconds: Number(process.env.ABUSE_BAN_SECONDS ?? 600),
  maxBanSeconds: Number(process.env.ABUSE_MAX_BAN_SECONDS ?? 86_400),
  allowlist: (process.env.ABUSE_ALLOWLIST ?? '').split(',').map(ip => ip.trim()).filter(Boolean),
})

if (activo) setInterval(() => guard.prune(), 60_000).unref()

export default defineEventHandler((event) => {
  if (!activo || event.path.startsWith('/api/health')) return

  const ip = clientIp(
    getRequestHeader(event, 'x-forwarded-for'),
    event.node.req.socket.remoteAddress,
    hops,
  )
  if (isPrivateIp(ip)) return

  const veredicto = guard.check(ip)
  if (!veredicto.blocked) return

  if (veredicto.justBanned) {
    console.warn(JSON.stringify({
      evento: 'IP_BLOQUEADA',
      servicio: 'web',
      ip,
      peticiones_en_ventana: veredicto.hits,
      bloqueo_segundos: veredicto.banSeconds,
      pais: getRequestHeader(event, 'cloudfront-viewer-country') ?? null,
      region: getRequestHeader(event, 'cloudfront-viewer-country-region-name') ?? null,
      ciudad: getRequestHeader(event, 'cloudfront-viewer-city') ?? null,
      ruta: event.path.split('?')[0],
      metodo: event.method,
      user_agent: (getRequestHeader(event, 'user-agent') ?? '').slice(0, 200),
    }))
  }

  setResponseHeader(event, 'Retry-After', String(Math.max(1, veredicto.retryAfter)))
  setResponseHeader(event, 'Cache-Control', 'no-store')
  throw createError({ statusCode: 429, statusMessage: 'Too Many Requests' })
})
