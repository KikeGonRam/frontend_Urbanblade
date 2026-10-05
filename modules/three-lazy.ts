import { defineNuxtModule } from 'nuxt/kit'

/*
 * TT39 (HT-16): three.js se carga solo cuando hace falta.
 *
 * Nuxt marca cada import() de una página como "prefetch", así que el navegador bajaba
 * three.js (~565 KB) en cuanto se abría la portada o /system, aunque el componente
 * decidiera no usarlo (móvil, movimiento reducido, sin WebGL). Aquí se quita esa pista
 * solo para three.js y las dos escenas de app/lib; el resto del sitio no cambia.
 * Nuxt registra solo los módulos de esta carpeta.
 */
const LAZY = (entry: { name?: string, src?: string }) =>
  entry.name === 'three.module' || /^lib\/\w+Scene\.ts$/.test(entry.src ?? '')

export default defineNuxtModule({
  meta: { name: 'three-lazy' },
  setup(_options, nuxt) {
    nuxt.hook('build:manifest', (manifest) => {
      for (const entry of Object.values(manifest)) {
        if (LAZY(entry)) {
          entry.prefetch = false
          entry.preload = false
        }
      }
    })
  },
})
