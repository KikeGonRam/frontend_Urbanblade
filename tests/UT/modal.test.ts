import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { defineComponent } from 'vue'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import Modal from '~/components/ui/Modal.vue'

/* Fase 2 del plan de mejora de la interfaz: ventanas modales accesibles. */
beforeAll(() => {
  // happy-dom no implementa el <dialog> modal; basta con marcarlo abierto.
  HTMLDialogElement.prototype.showModal ??= function showModal(this: HTMLDialogElement) { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close ??= function close(this: HTMLDialogElement) { this.removeAttribute('open') }
})

afterEach(() => {
  document.body.querySelectorAll('dialog').forEach(d => d.remove())
})

describe('ventana modal', () => {
  it('dos ventanas abiertas a la vez no comparten el id de su título', async () => {
    const Dos = defineComponent({
      components: { Modal },
      template: '<div><Modal title="Primera">uno</Modal><Modal title="Segunda">dos</Modal></div>',
    })
    await mountSuspended(Dos)

    const dialogos = [...document.body.querySelectorAll('dialog')]
    expect(dialogos).toHaveLength(2)
    const ids = dialogos.map(d => d.getAttribute('aria-labelledby'))
    expect(new Set(ids).size).toBe(2)
    dialogos.forEach((d, i) => {
      expect(document.getElementById(ids[i]!)?.textContent).toBe(['Primera', 'Segunda'][i])
    })
  })
})
