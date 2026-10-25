import { describe, expect, it } from 'vitest'
import { AbuseGuard, clientIp, isPrivateIp } from '../../server/utils/abuse'

const opciones = { maxRequests: 5, windowSeconds: 10, banSeconds: 600, maxBanSeconds: 86_400, allowlist: ['203.0.113.99'] }

function guardConReloj(inicio = 1_000_000) {
  const reloj = { t: inicio }
  return { reloj, guard: new AbuseGuard(opciones, () => reloj.t) }
}

describe('bloqueo de IPs abusivas', () => {
  it('deja pasar el tráfico normal y bloquea al pasarse del límite', () => {
    const { guard } = guardConReloj()
    for (let i = 0; i < 5; i++) expect(guard.check('203.0.113.1').blocked).toBe(false)

    const sexta = guard.check('203.0.113.1')
    expect(sexta).toMatchObject({ blocked: true, justBanned: true, banSeconds: 600, retryAfter: 600 })

    // las siguientes siguen bloqueadas, pero ya no son «recién bloqueadas»
    expect(guard.check('203.0.113.1')).toMatchObject({ blocked: true, justBanned: false })
  })

  it('no afecta a otras IPs ni a las de la lista blanca', () => {
    const { guard } = guardConReloj()
    for (let i = 0; i < 20; i++) guard.check('203.0.113.2')

    expect(guard.check('203.0.113.3').blocked).toBe(false)
    for (let i = 0; i < 50; i++) expect(guard.check('203.0.113.99').blocked).toBe(false)
  })

  it('el bloqueo vence con el tiempo y la reincidencia lo duplica', () => {
    const { guard, reloj } = guardConReloj()
    for (let i = 0; i < 6; i++) guard.check('203.0.113.4')
    expect(guard.check('203.0.113.4').retryAfter).toBeLessThanOrEqual(600)

    reloj.t += 601_000
    expect(guard.check('203.0.113.4').blocked).toBe(false)

    // la petición de arriba ya fue la 1.ª de la ventana nueva: faltan 4 para llegar al límite de 5
    for (let i = 0; i < 4; i++) guard.check('203.0.113.4')
    const segundo = guard.check('203.0.113.4')
    expect(segundo).toMatchObject({ blocked: true, justBanned: true, banSeconds: 1200 })
  })

  it('una ventana nueva reinicia la cuenta', () => {
    const { guard, reloj } = guardConReloj()
    for (let i = 0; i < 5; i++) guard.check('203.0.113.5')
    reloj.t += 11_000
    for (let i = 0; i < 5; i++) expect(guard.check('203.0.113.5').blocked).toBe(false)
  })

  it('prune borra lo vencido', () => {
    const { guard, reloj } = guardConReloj()
    for (let i = 0; i < 6; i++) guard.check('203.0.113.6')
    reloj.t += 2 * 86_400_000
    guard.prune()
    expect(guard.check('203.0.113.6').blocked).toBe(false)
  })
})

describe('IP del visitante', () => {
  it('con 2 proxies toma la penúltima entrada y no se deja engañar por la izquierda', () => {
    // el cliente inventó 6.6.6.6; CloudFront agregó la IP real y el ALB la de CloudFront
    expect(clientIp('6.6.6.6, 198.51.100.7, 130.176.0.1', '172.31.1.1', 2)).toBe('198.51.100.7')
  })

  it('sin proxies o sin cabecera usa la dirección del socket', () => {
    expect(clientIp('6.6.6.6', '198.51.100.8', 0)).toBe('198.51.100.8')
    expect(clientIp(undefined, '198.51.100.9', 2)).toBe('198.51.100.9')
  })

  it('reconoce las direcciones privadas', () => {
    for (const ip of ['10.0.0.1', '127.0.0.1', '172.31.5.5', '192.168.1.9', '::1']) expect(isPrivateIp(ip)).toBe(true)
    for (const ip of ['203.0.113.1', '8.8.8.8', '172.32.0.1']) expect(isPrivateIp(ip)).toBe(false)
  })
})
