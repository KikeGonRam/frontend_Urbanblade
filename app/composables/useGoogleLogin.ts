/**
 * Login con Google (barber: SocialAuthController).
 *
 * Anti login-CSRF: antes de salir hacia Google el navegador genera un nonce aleatorio, lo guarda en
 * sessionStorage (que no viaja a ningún servidor ni se comparte entre navegadores) y lo manda a barber.
 * barber lo devuelve en /auth/callback junto con un código de un solo uso. Solo este mismo navegador
 * conoce el nonce, así que un enlace de callback armado por un atacante con SU código no inicia sesión.
 */
const NONCE_KEY = 'ub_google_nonce'

function newNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))

  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function useGoogleLogin() {
  const config = useRuntimeConfig()

  /** Guarda un nonce nuevo y manda al usuario a la pantalla de consentimiento de Google. */
  function start() {
    const nonce = newNonce()
    try {
      sessionStorage.setItem(NONCE_KEY, nonce)
    }
    catch {
      // Sin sessionStorage (modo privado estricto) no se puede atar el inicio de sesión: no se intenta.
      return
    }
    window.location.assign(`${config.public.apiBase}/auth/google/redirect?nonce=${encodeURIComponent(nonce)}`)
  }

  /** Lee y borra el nonce guardado (uso único); null si no hay. */
  function takeNonce(): string | null {
    try {
      const nonce = sessionStorage.getItem(NONCE_KEY)
      sessionStorage.removeItem(NONCE_KEY)

      return nonce
    }
    catch {
      return null
    }
  }

  return { start, takeNonce }
}
