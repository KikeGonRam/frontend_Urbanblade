import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearNuxtState } from '#app'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { useAccesoDenegado } from '~/composables/useAccesoDenegado'
import staff from '~/middleware/staff'

/*
 * UX #28: abrir por URL una pantalla sin permiso devolvía al panel sin explicación.
 * Ahora la redirección deja un aviso que el layout muestra hasta que la persona lo cierre.
 */
const estado = vi.hoisted(() => ({
  roles: [] as string[],
  navigateTo: vi.fn((destino: unknown) => destino),
}))

mockNuxtImport('navigateTo', () => estado.navigateTo)
mockNuxtImport('useAuth', () => () => ({
  user: { value: { roles: estado.roles } },
  hasRole: (rol: string) => estado.roles.includes(rol),
  fetchMe: vi.fn(),
}))

beforeEach(() => {
  clearNuxtState(['acceso_denegado'])
  estado.navigateTo.mockClear()
  estado.roles = []
})

describe('aviso de acceso denegado', () => {
  it('denegar deja el aviso y manda al panel', () => {
    const { aviso, denegar } = useAccesoDenegado()

    denegar()

    expect(aviso.value).toContain('No tienes permiso')
    expect(estado.navigateTo).toHaveBeenCalledWith('/dashboard')
  })

  it('limpiar quita el aviso', () => {
    const { aviso, denegar, limpiar } = useAccesoDenegado()
    denegar()

    limpiar()

    expect(aviso.value).toBeNull()
  })

  it('el middleware staff avisa a un rol sin acceso', async () => {
    estado.roles = ['ingeniero']

    await (staff as unknown as () => Promise<unknown>)()

    expect(useAccesoDenegado().aviso.value).not.toBeNull()
  })

  it('el middleware staff no avisa a recepción', async () => {
    estado.roles = ['recepcionista']

    await (staff as unknown as () => Promise<unknown>)()

    expect(useAccesoDenegado().aviso.value).toBeNull()
    expect(estado.navigateTo).not.toHaveBeenCalled()
  })
})
