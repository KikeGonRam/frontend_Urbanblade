/*
 * Bloqueo automático de IPs que mandan demasiadas peticiones en pocos segundos (como fail2ban).
 * Lo usa server/middleware/01-abuse-guard.ts. El conteo vive en la memoria de cada tarea de ECS.
 */
export interface AbuseOptions {
  /** Peticiones permitidas por IP dentro de la ventana. */
  maxRequests: number
  windowSeconds: number
  banSeconds: number
  maxBanSeconds: number
  allowlist: string[]
}

export interface AbuseVerdict {
  blocked: boolean
  /** Segundos que faltan de bloqueo (para Retry-After). */
  retryAfter: number
  /** true solo en la petición que dispara un bloqueo nuevo (para registrarlo una vez). */
  justBanned: boolean
  hits: number
  banSeconds: number
}

const PRIVADA = /^(?:10\.|127\.|192\.168\.|169\.254\.|172\.(?:1[6-9]|2\d|3[01])\.|::1$|fc|fd|fe80)/i

export function isPrivateIp(ip: string): boolean {
  return !ip || PRIVADA.test(ip)
}

/**
 * IP del visitante. `hops` es el número de proxies propios delante de la app (CloudFront y el ALB
 * son 2). Cada proxy agrega a la derecha de X-Forwarded-For la IP de quien le habló; lo que está
 * más a la izquierda lo puede inventar el cliente, así que solo se cuenta desde la derecha.
 * Con hops = 0 no se confía en ninguna cabecera y se usa la dirección del socket.
 */
export function clientIp(forwardedFor: string | undefined, remote: string | undefined, hops: number): string {
  if (hops <= 0 || !forwardedFor) return remote ?? ''

  const cadena = forwardedFor.split(',').map(p => p.trim()).filter(Boolean)
  return cadena[cadena.length - hops] ?? remote ?? ''
}

export class AbuseGuard {
  private hits = new Map<string, { bucket: number, count: number }>()
  private bans = new Map<string, number>()
  private strikes = new Map<string, { count: number, until: number }>()

  constructor(private readonly options: AbuseOptions, private readonly now: () => number = () => Date.now()) {}

  check(ip: string): AbuseVerdict {
    const libre: AbuseVerdict = { blocked: false, retryAfter: 0, justBanned: false, hits: 0, banSeconds: 0 }
    if (!ip || this.options.allowlist.includes(ip)) return libre

    const ahora = this.now()
    const hasta = this.bans.get(ip)
    if (hasta !== undefined) {
      if (hasta > ahora) {
        return { ...libre, blocked: true, retryAfter: Math.ceil((hasta - ahora) / 1000) }
      }
      this.bans.delete(ip)
    }

    const bucket = Math.floor(ahora / (this.options.windowSeconds * 1000))
    const previo = this.hits.get(ip)
    const count = previo && previo.bucket === bucket ? previo.count + 1 : 1
    this.hits.set(ip, { bucket, count })

    if (count <= this.options.maxRequests) return { ...libre, hits: count }

    const reincidencia = this.strikes.get(ip)
    const veces = reincidencia && reincidencia.until > ahora ? reincidencia.count + 1 : 1
    this.strikes.set(ip, { count: veces, until: ahora + 86_400_000 })

    const banSeconds = Math.min(this.options.banSeconds * 2 ** (veces - 1), this.options.maxBanSeconds)
    this.bans.set(ip, ahora + banSeconds * 1000)

    return { blocked: true, retryAfter: banSeconds, justBanned: true, hits: count, banSeconds }
  }

  /** Borra lo vencido para que la memoria no crezca con cada IP que pasó. */
  prune(): void {
    const ahora = this.now()
    for (const [ip, hasta] of this.bans) if (hasta <= ahora) this.bans.delete(ip)
    for (const [ip, s] of this.strikes) if (s.until <= ahora) this.strikes.delete(ip)
    const bucketActual = Math.floor(ahora / (this.options.windowSeconds * 1000))
    for (const [ip, h] of this.hits) if (h.bucket < bucketActual - 1) this.hits.delete(ip)
  }
}
