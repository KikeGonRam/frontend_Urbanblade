// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

// @nuxt/eslint genera la config base (TS + Vue + reglas específicas de
// Nuxt, incluyendo desactivar vue/multi-word-component-names para
// pages/layouts/app.vue por convención) a partir de este mismo proyecto —
// ver .nuxt/eslint.config.mjs (regenerado en cada `nuxt prepare`, no se
// versiona). Sin overrides propios por ahora.
export default withNuxt()
