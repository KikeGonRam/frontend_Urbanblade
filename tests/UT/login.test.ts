import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import LoginPage from '~/pages/login.vue'

/*
 * Formulario de acceso (pages/login.vue): se prueba solo, sin servidor. `useAuth` y `navigateTo` se simulan;
 * `useAuthReturn` y `useRetryCountdown` son los reales porque son lógica pura de la propia app.
 */
const { login, navigate } = vi.hoisted(() => ({ login: vi.fn(), navigate: vi.fn() }))
mockNuxtImport('useAuth', () => () => ({ login }))
mockNuxtImport('navigateTo', () => navigate)

const completeUser = { id: 'u1', profile_complete: true }

async function fill(wrapper: Awaited<ReturnType<typeof mountSuspended>>, email: string, password: string) {
  await wrapper.get('#email').setValue(email)
  await wrapper.get('#password').setValue(password)
}

describe('formulario de acceso', () => {
  beforeEach(() => {
    login.mockReset()
    navigate.mockReset()
  })

  it('muestra el correo, la contraseña, el acceso con Google y el enlace de recuperación', async () => {
    const wrapper = await mountSuspended(LoginPage)

    expect(wrapper.find('#email').exists()).toBe(true)
    expect(wrapper.find('#password').exists()).toBe(true)
    expect(wrapper.text()).toContain('Continuar con Google')
    expect(wrapper.find('a[href="/forgot-password"]').exists()).toBe(true)
    expect(wrapper.get('button[type="submit"]').text()).toBe('Ingresar')
  })

  it('manda el correo y la contraseña tal como se escribieron y entra al panel', async () => {
    login.mockResolvedValue(completeUser)
    const wrapper = await mountSuspended(LoginPage)

    await fill(wrapper, 'ana@example.com', 'secreto-de-prueba')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(login).toHaveBeenCalledExactlyOnceWith('ana@example.com', 'secreto-de-prueba')
    expect(navigate).toHaveBeenCalledWith('/dashboard')
  })

  it('manda a completar el perfil a quien entra con el perfil incompleto', async () => {
    login.mockResolvedValue({ id: 'u2', profile_complete: false })
    const wrapper = await mountSuspended(LoginPage)

    await fill(wrapper, 'nuevo@example.com', 'secreto-de-prueba')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(navigate).toHaveBeenCalledWith('/complete-profile?redirect=%2Fdashboard')
  })

  it.each([
    [422, 'Las credenciales no son válidas.'],
    [403, 'Debes verificar tu correo para iniciar sesión.'],
    [500, 'No se pudo iniciar sesión. Intenta de nuevo.'],
  ])('con un error %i muestra «%s» y no navega', async (status, message) => {
    login.mockRejectedValue({ response: { status } })
    const wrapper = await mountSuspended(LoginPage)

    await fill(wrapper, 'ana@example.com', 'mala')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(wrapper.text()).toContain(message)
    expect(navigate).not.toHaveBeenCalled()
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeUndefined()
  })

  it('bloquea el botón mientras espera la respuesta', async () => {
    let resolve: (user: typeof completeUser) => void = () => {}
    login.mockReturnValue(new Promise((r) => { resolve = r }))
    const wrapper = await mountSuspended(LoginPage)

    await fill(wrapper, 'ana@example.com', 'secreto-de-prueba')
    await wrapper.get('form').trigger('submit')

    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('button[type="submit"]').text()).toBe('Ingresando…')

    resolve(completeUser)
    await flushPromises()
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeUndefined()
  })

  it('con demasiados intentos (429) muestra la espera que indica el servidor y bloquea el botón', async () => {
    login.mockRejectedValue({ response: { status: 429, headers: new Headers({ 'Retry-After': '30' }) } })
    const wrapper = await mountSuspended(LoginPage)

    await fill(wrapper, 'ana@example.com', 'secreto-de-prueba')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(wrapper.text()).toContain('Demasiados intentos. Espera 30s')
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined()
    expect(wrapper.text()).not.toContain('No se pudo iniciar sesión')
  })
})
