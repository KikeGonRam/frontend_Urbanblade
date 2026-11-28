import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import RenderBoundary from '~/components/ui/RenderBoundary.vue'
import { esErrorDeDibujo } from '~/utils/errorDibujo'

/*
 * El marco del panel solo atrapa errores al dibujar (pantalla en blanco por datos con otra forma);
 * los errores de botones siguen su camino para no tapar pantallas que funcionan.
 */
describe('esErrorDeDibujo', () => {
  it('reconoce setup, render y actualización en desarrollo y en producción', () => {
    for (const info of ['setup function', 'render function', 'component update']) expect(esErrorDeDibujo(info)).toBe(true)
    for (const code of [0, 1, 15]) expect(esErrorDeDibujo(`https://vuejs.org/error-reference/#runtime-${code}`)).toBe(true)
  })

  it('ignora manejadores de eventos, watchers y ganchos', () => {
    for (const info of ['component event handler', 'native event handler', 'watcher callback', 'mounted hook']) expect(esErrorDeDibujo(info)).toBe(false)
    for (const code of [3, 5, 6, 14]) expect(esErrorDeDibujo(`https://vuejs.org/error-reference/#runtime-${code}`)).toBe(false)
  })
})

describe('UiRenderBoundary', () => {
  it('si la pantalla revienta al dibujarse, muestra el aviso y permite reintentar', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    let romper = true
    const Pantalla = defineComponent({
      setup: () => () => {
        if (romper) throw new TypeError('Cannot read properties of undefined')
        return h('p', 'Agenda lista')
      },
    })
    const wrapper = await mountSuspended(RenderBoundary, { slots: { default: () => h(Pantalla) } })

    expect(wrapper.text()).toContain('Esta sección no se pudo mostrar')

    romper = false
    await wrapper.get('button').trigger('click')
    await nextTick()
    expect(wrapper.text()).toContain('Agenda lista')
  })

  it('un error en un botón no tapa la pantalla', async () => {
    const Pantalla = defineComponent({
      setup: () => () => h('button', { onClick: () => { throw new Error('falló el cobro') } }, 'Cobrar'),
    })
    const wrapper = await mountSuspended(RenderBoundary, { slots: { default: () => h(Pantalla) } })

    await wrapper.get('button').trigger('click').catch(() => {})
    await nextTick()

    expect(wrapper.text()).toContain('Cobrar')
    expect(wrapper.text()).not.toContain('no se pudo mostrar')
  })
})
