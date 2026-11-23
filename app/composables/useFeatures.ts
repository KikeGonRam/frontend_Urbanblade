/*
 * Interruptores de módulos (auditoría de funciones, nov-2026). GET /barbershop (público) trae dentro de
 * `data.features` un booleano por módulo. Con un módulo apagado el backend NO tiene sus rutas (404), así que
 * la web tampoco debe mostrarlo: ni en el menú, ni en enlaces, ni escribiendo la URL (middleware 'feature').
 *
 * Regla de oro: mientras no haya respuesta, o si falta la clave, el módulo cuenta como APAGADO.
 *
 * Solo se pide en el cliente (el estado se comparte vía useState). En el servidor todo queda apagado, y
 * como ese mismo estado viaja en el payload, la hidratación coincide; las páginas con interruptor corren
 * sin SSR (ver routeRules en nuxt.config.ts).
 */
export const FEATURE_NAMES = ['packages', 'gift_cards', 'referrals', 'raffles', 'social', 'campaigns'] as const
export type FeatureName = typeof FEATURE_NAMES[number]
export type FeatureFlags = Record<FeatureName, boolean>

/** Normaliza lo que llegue del backend: solo `true` exacto enciende un módulo. */
export function parseFeatures(raw: unknown): FeatureFlags {
  const source = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>

  return Object.fromEntries(FEATURE_NAMES.map(name => [name, source[name] === true])) as FeatureFlags
}

// Una sola petición en vuelo aunque varios la pidan a la vez (menú, middleware, plugin).
let loading: Promise<void> | null = null

export function useFeatures() {
  const flags = useState<FeatureFlags | null>('ub-features', () => null)
  const { apiFetch } = useApi()

  /** Carga los interruptores una vez. Si falla, todo sigue apagado y se reintenta en la próxima navegación. */
  function load(): Promise<void> {
    if (import.meta.server || flags.value) return Promise.resolve()
    loading ??= apiFetch<{ data?: { features?: unknown } }>('/barbershop')
      .then((res) => { flags.value = parseFeatures(res?.data?.features) })
      .catch(() => { /* sin respuesta: todo apagado */ })
      .finally(() => { loading = null })

    return loading
  }

  function isEnabled(name: FeatureName): boolean {
    return flags.value?.[name] === true
  }

  return { flags, load, isEnabled }
}
