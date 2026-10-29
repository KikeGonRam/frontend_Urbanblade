import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import StatePanel from '~/components/brand/StatePanel.vue'

/* Auditoría UI/UX R-04: un solo patrón de estado vacío (mascota, título, frase y una acción útil). */
const base = { mascot: 'nava', state: 'empty', title: 'No tienes anotaciones' } as const

describe('estado vacío', () => {
  it('muestra título y descripción', async () => {
    const wrapper = await mountSuspended(StatePanel, { props: { ...base, description: 'Cuando un horario esté lleno, anótate.' } })

    expect(wrapper.text()).toContain('No tienes anotaciones')
    expect(wrapper.text()).toContain('Cuando un horario esté lleno')
  })

  it('con ruta, la acción es un enlace', async () => {
    const wrapper = await mountSuspended(StatePanel, { props: { ...base, actionLabel: 'Reservar una cita', actionTo: '/my/appointments' } })

    expect(wrapper.find('a[href="/my/appointments"]').exists()).toBe(true)
    expect(wrapper.find('button').exists()).toBe(false)
  })

  it('sin ruta, la acción es un botón que avisa', async () => {
    const wrapper = await mountSuspended(StatePanel, { props: { ...base, actionLabel: 'Reintentar' } })

    await wrapper.get('button').trigger('click')

    expect(wrapper.emitted('action')).toHaveLength(1)
  })
})
