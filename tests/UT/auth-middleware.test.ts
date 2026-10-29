import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import authMiddleware from '~/middleware/auth'

/*
 * UX #2: al abrir una ruta protegida directo (F5 o URL pegada) el usuario aún no está cargado y el menú queda vacío.
 * El middleware debe pedir /auth/me antes de dejar pasar y mandar a /login si el token ya no sirve.
 */
const estado = vi.hoisted(() => ({
  token: { value: 'tok' as string | null },
  user: { value: null as { roles: string[] } | null },
  fetchMe: vi.fn(),
  navigateTo: vi.fn((destino: unknown) => destino),
}))

mockNuxtImport('useAuth', () => () => ({
  isAuthenticated: { get value() { return !!estado.token.value } },
  user: estado.user,
  fetchMe: estado.fetchMe,
}))
mockNuxtImport('navigateTo', () => estado.navigateTo)

const ruta = { fullPath: '/profile' } as never
const ejecutar = () => (authMiddleware as unknown as (to: never, from: never) => Promise<unknown>)(ruta, ruta)

beforeEach(() => {
  estado.token.value = 'tok'
  estado.user.value = null
  estado.fetchMe.mockReset()
  estado.navigateTo.mockClear()
})

describe('middleware auth', () => {
  it('carga al usuario en una carga directa', async () => {
    estado.fetchMe.mockImplementation(async () => { estado.user.value = { roles: ['cliente'] } })

    await ejecutar()

    expect(estado.fetchMe).toHaveBeenCalledOnce()
    expect(estado.navigateTo).not.toHaveBeenCalled()
  })

  it('no vuelve a pedir al usuario si ya está cargado', async () => {
    estado.user.value = { roles: ['cliente'] }

    await ejecutar()

    expect(estado.fetchMe).not.toHaveBeenCalled()
  })

  it('manda a /login conservando la ruta si el token fue rechazado', async () => {
    estado.fetchMe.mockImplementation(async () => { estado.token.value = null })

    await ejecutar()

    expect(estado.navigateTo).toHaveBeenCalledWith({ path: '/login', query: { redirect: '/profile' } })
  })

  it('manda a /login sin pedir nada si no hay token', async () => {
    estado.token.value = null

    await ejecutar()

    expect(estado.fetchMe).not.toHaveBeenCalled()
    expect(estado.navigateTo).toHaveBeenCalledOnce()
  })
})
