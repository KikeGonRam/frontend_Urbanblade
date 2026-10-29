import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import Skeleton from '~/components/ui/Skeleton.vue'

/* Auditoría UI/UX A-02: la carga muestra la silueta de lo que viene y avisa a los lectores de pantalla. */
describe('esqueleto de carga', () => {
  it('es un estado accesible con etiqueta', async () => {
    const wrapper = await mountSuspended(Skeleton, { props: { label: 'Cargando citas…' } })

    expect(wrapper.attributes('role')).toBe('status')
    expect(wrapper.attributes('aria-label')).toBe('Cargando citas…')
    expect(wrapper.text()).toContain('Cargando citas…')
  })

  it('dibuja tantas filas como se pide', async () => {
    const wrapper = await mountSuspended(Skeleton, { props: { variant: 'rows', rows: 5 } })

    expect(wrapper.findAll('div.flex.items-center.gap-4')).toHaveLength(5)
  })

  it('dibuja las barras de una gráfica', async () => {
    const wrapper = await mountSuspended(Skeleton, { props: { variant: 'chart' } })

    expect(wrapper.findAll('span.rounded-t-md').length).toBeGreaterThan(5)
  })
})
