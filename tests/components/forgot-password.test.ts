import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import ForgotPasswordPage from '~/pages/forgot-password.vue'

/* Formulario de recuperación de contraseña (pages/forgot-password.vue), con `useAuth` simulado. */
const { forgotPassword } = vi.hoisted(() => ({ forgotPassword: vi.fn() }))
mockNuxtImport('useAuth', () => () => ({ forgotPassword }))

async function submit(email: string) {
  const wrapper = await mountSuspended(ForgotPasswordPage)
  await wrapper.get('#email').setValue(email)
  await wrapper.get('form').trigger('submit')
  await flushPromises()

  return wrapper
}

describe('formulario de recuperación de contraseña', () => {
  beforeEach(() => {
    forgotPassword.mockReset()
  })

  it('pide solo el correo y ofrece volver al acceso', async () => {
    const wrapper = await mountSuspended(ForgotPasswordPage)

    expect(wrapper.findAll('input')).toHaveLength(1)
    expect(wrapper.get('#email').attributes('type')).toBe('email')
    expect(wrapper.get('#email').attributes('required')).toBeDefined()
    expect(wrapper.find('a[href="/login"]').exists()).toBe(true)
  })

  it('manda el correo escrito y, al enviarse, reemplaza el formulario por el aviso del servidor', async () => {
    forgotPassword.mockResolvedValue({ message: 'Te enviamos un enlace para elegir una nueva contraseña.' })

    const wrapper = await submit('ana@example.com')

    expect(forgotPassword).toHaveBeenCalledExactlyOnceWith('ana@example.com')
    expect(wrapper.text()).toContain('Te enviamos un enlace para elegir una nueva contraseña.')
    expect(wrapper.find('form').exists()).toBe(false)
  })

  it('muestra el motivo que da el servidor cuando falla', async () => {
    forgotPassword.mockRejectedValue({ data: { message: 'No encontramos ese correo.' } })

    const wrapper = await submit('nadie@example.com')

    expect(wrapper.text()).toContain('No encontramos ese correo.')
    expect(wrapper.find('form').exists()).toBe(true)
  })

  it('usa un mensaje general si el servidor no explica el error', async () => {
    forgotPassword.mockRejectedValue(new Error('sin red'))

    const wrapper = await submit('ana@example.com')

    expect(wrapper.text()).toContain('No se pudo enviar el enlace de recuperación.')
  })

  it('con demasiados intentos (429) muestra la espera y bloquea el botón', async () => {
    forgotPassword.mockRejectedValue({ response: { status: 429, headers: new Headers({ 'Retry-After': '45' }) } })

    const wrapper = await submit('ana@example.com')

    expect(wrapper.text()).toContain('Demasiados intentos. Espera 45s')
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined()
  })
})
