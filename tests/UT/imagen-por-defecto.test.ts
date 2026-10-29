import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import ImagePlaceholder from '~/components/brand/ImagePlaceholder.vue'

/* Auditoría UI/UX C-01: servicios y productos sin foto muestran una imagen de marca, no un recuadro vacío. */
const trazo = (wrapper: Awaited<ReturnType<typeof mountSuspended>>) => wrapper.get('path').attributes('d')

describe('imagen por defecto de la marca', () => {
  it('elige un trazo distinto según la categoría', async () => {
    const barba = trazo(await mountSuspended(ImagePlaceholder, { props: { category: 'Barba' } }))
    const cuidado = trazo(await mountSuspended(ImagePlaceholder, { props: { category: 'cuidado' } }))
    const corte = trazo(await mountSuspended(ImagePlaceholder, { props: { category: 'corte' } }))
    const otra = trazo(await mountSuspended(ImagePlaceholder, { props: { category: null } }))

    expect(new Set([barba, cuidado, corte, otra]).size).toBe(4)
  })

  it('es una imagen accesible con etiqueta', async () => {
    const wrapper = await mountSuspended(ImagePlaceholder, { props: { category: 'corte', label: 'Sin foto de Corte clásico' } })

    expect(wrapper.attributes('role')).toBe('img')
    expect(wrapper.attributes('aria-label')).toBe('Sin foto de Corte clásico')
  })
})
