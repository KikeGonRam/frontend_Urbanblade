import { afterEach, describe, expect, it, vi } from 'vitest'
import { useGoogleLogin } from '~/composables/useGoogleLogin'

/*
 * Anti login-CSRF del acceso con Google: el navegador genera un nonce propio, lo guarda en sessionStorage
 * y lo manda a barber; /auth/callback solo canjea el código si el `state` devuelto coincide con ese nonce.
 */
const KEY = 'ub_google_nonce'

afterEach(() => {
  sessionStorage.clear()
  vi.unstubAllGlobals()
})

describe('acceso con Google: nonce del navegador', () => {
  it('start() guarda un nonce y lo manda al redirect del backend', () => {
    const assign = vi.fn()
    vi.stubGlobal('location', { assign })

    useGoogleLogin().start()

    const saved = sessionStorage.getItem(KEY)
    expect(saved).toMatch(/^[A-Za-z0-9_-]{22,}$/)
    expect(assign).toHaveBeenCalledTimes(1)
    expect(String(assign.mock.calls[0]![0])).toMatch(/\/auth\/google\/redirect\?nonce=/)
    expect(String(assign.mock.calls[0]![0])).toContain(`nonce=${saved}`)
  })

  it('cada inicio genera un nonce distinto', () => {
    vi.stubGlobal('location', { assign: vi.fn() })
    const google = useGoogleLogin()

    google.start()
    const first = sessionStorage.getItem(KEY)
    google.start()

    expect(sessionStorage.getItem(KEY)).not.toBe(first)
  })

  it('takeNonce() devuelve el nonce una sola vez', () => {
    sessionStorage.setItem(KEY, 'nonce-guardado-0123456789')
    const google = useGoogleLogin()

    expect(google.takeNonce()).toBe('nonce-guardado-0123456789')
    expect(google.takeNonce()).toBeNull()
  })

  it('un navegador sin nonce guardado (enlace ajeno) no obtiene ninguno', () => {
    expect(useGoogleLogin().takeNonce()).toBeNull()
  })
})
