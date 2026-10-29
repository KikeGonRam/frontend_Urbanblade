import { describe, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import RowMenu from '~/components/ui/RowMenu.vue'

/* Auditoría UI/UX A-30: las acciones de riesgo van en un menú «⋯», no a la vista en cada fila. */
function montar(onSelect = vi.fn()) {
  return mountSuspended(RowMenu, {
    props: { label: 'Más acciones de Ana', items: [{ label: 'Eliminar cliente', danger: true, onSelect }] },
    attachTo: document.body,
  })
}

describe('menú de fila', () => {
  it('empieza cerrado y se abre con el botón', async () => {
    const wrapper = await montar()

    expect(wrapper.find('[role="menu"]').exists()).toBe(false)
    expect(wrapper.get('button[aria-haspopup="menu"]').attributes('aria-label')).toBe('Más acciones de Ana')

    await wrapper.get('button[aria-haspopup="menu"]').trigger('click')

    expect(wrapper.find('[role="menu"]').exists()).toBe(true)
    expect(wrapper.get('button[aria-haspopup="menu"]').attributes('aria-expanded')).toBe('true')
    wrapper.unmount()
  })

  it('al elegir una opción la ejecuta y se cierra', async () => {
    const onSelect = vi.fn()
    const wrapper = await montar(onSelect)
    await wrapper.get('button[aria-haspopup="menu"]').trigger('click')

    await wrapper.get('[role="menuitem"]').trigger('click')

    expect(onSelect).toHaveBeenCalledOnce()
    expect(wrapper.find('[role="menu"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('se cierra con Escape', async () => {
    const wrapper = await montar()
    await wrapper.get('button[aria-haspopup="menu"]').trigger('click')

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()

    expect(wrapper.find('[role="menu"]').exists()).toBe(false)
    wrapper.unmount()
  })
})
