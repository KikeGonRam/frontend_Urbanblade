import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import AppSidebarV2 from '~/components/shell/AppSidebarV2.vue'
import MobileTopbar from '~/components/shell/MobileTopbar.vue'

/* Fase 1 del plan de mejora de la interfaz: marco de la app (barra lateral y barras superiores). */
describe('marco de la app', () => {
  it('la marca de la barra móvil se lee como una sola palabra', async () => {
    const wrapper = await mountSuspended(MobileTopbar)

    expect(wrapper.get('a[href="/dashboard"]').text()).toBe('UrbanBlade')
  })

  it('el botón de cerrar sesión de la barra lateral existe aunque el menú esté colapsado', async () => {
    const wrapper = await mountSuspended(AppSidebarV2)

    const salir = wrapper.get('button[aria-label="Cerrar sesión"]')
    expect(salir.classes()).toContain('ub-sidebar__logout')
  })

  it('los títulos de sección plegables declaran si están abiertos', async () => {
    const wrapper = await mountSuspended(AppSidebarV2)

    const titulos = wrapper.findAll('button.ub-sidebar__section-title')
    for (const titulo of titulos) {
      expect(['true', 'false']).toContain(titulo.attributes('aria-expanded'))
      expect(titulo.attributes('aria-controls')).toMatch(/^nav-/)
    }
  })
})
