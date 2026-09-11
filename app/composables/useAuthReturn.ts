import { getSafeRedirectUrl } from '~/utils/security'

// Solo navegación local y temporal. Nunca se guardan credenciales aquí.
const KEY = 'urbanblade:auth-return'
export function useAuthReturn() {
  function remember(target: unknown) {
    const path = getSafeRedirectUrl(target, '')
    if (!import.meta.client || !path) return
    try { sessionStorage.setItem(KEY, JSON.stringify({ path, until: Date.now() + 60 * 60 * 1000 })) } catch { /* almacenamiento opcional */ }
  }
  function destination(target?: unknown) {
    const direct = getSafeRedirectUrl(target, '')
    if (direct) return direct
    if (import.meta.client) {
      try {
        const saved = JSON.parse(sessionStorage.getItem(KEY) || 'null')
        if (saved?.until > Date.now()) return getSafeRedirectUrl(saved.path)
      } catch { /* dato inválido o almacenamiento bloqueado */ }
    }
    return '/dashboard'
  }
  function clear() {
    if (import.meta.client) { try { sessionStorage.removeItem(KEY) } catch { /* opcional */ } }
  }
  function afterLogin(complete: boolean, target?: unknown) {
    const path = destination(target)
    if (!complete) {
      remember(path)
      return `/complete-profile?redirect=${encodeURIComponent(path)}`
    }
    clear()
    return path
  }
  return { remember, destination, afterLogin, clear }
}
