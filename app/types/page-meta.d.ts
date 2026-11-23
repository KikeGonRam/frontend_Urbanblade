import type { FeatureName } from '~/composables/useFeatures'

declare module '#app' {
  interface PageMeta {
    /** Interruptor de módulo que debe estar encendido para entrar (lo comprueba el middleware 'feature'). */
    feature?: FeatureName
  }
}

export {}
