import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import StatCard from '~/components/ui/StatCard.vue'

/* Auditoría UI/UX A-10: una variación enorme sobre una base mínima no debe mostrarse como cifra exacta. */
describe('StatCard · variación', () => {
  it('muestra la variación normal tal cual', async () => {
    const wrapper = await mountSuspended(StatCard, { props: { label: 'Ingresos', value: 100, delta: 12.34 } })

    expect(wrapper.text()).toContain('12.3%')
  })

  it('acota las variaciones mayores a 300 %', async () => {
    const wrapper = await mountSuspended(StatCard, { props: { label: 'Citas de hoy', value: 1, delta: 650 } })

    expect(wrapper.text()).toContain('>300%')
    expect(wrapper.text()).not.toContain('650')
  })
})
