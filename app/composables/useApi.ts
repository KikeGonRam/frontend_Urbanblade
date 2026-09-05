import type { UseFetchOptions } from 'nuxt/app'

/**
 * $fetch/useFetch preconfigurados con la base de la API y el Bearer token de
 * useAuth(). Si el backend responde 401 (token inválido/expirado), limpia la
 * sesión local y manda a /login — mismo criterio en toda llamada autenticada,
 * en vez de repetir el manejo de 401 en cada página.
 */
export function useApi() {
  const config = useRuntimeConfig()
  const { token, logout } = useAuth()

  async function handleUnauthorized() {
    await logout()
    await navigateTo('/login')
  }

  async function apiFetch<T>(path: string, options: Record<string, unknown> = {}): Promise<T> {
    try {
      return await $fetch<T>(path, {
        baseURL: config.public.apiBase,
        ...options,
        headers: {
          ...(token.value ? { Authorization: `Bearer ${token.value}` } : {}),
          ...(options.headers as Record<string, string> | undefined),
        },
      })
    } catch (error: unknown) {
      if ((error as { statusCode?: number; response?: { status?: number } })?.statusCode === 401
        || (error as { response?: { status?: number } })?.response?.status === 401) {
        await handleUnauthorized()
      }

      throw error
    }
  }

  function useApiFetch<T>(path: string, options: UseFetchOptions<T> = {}) {
    return useFetch<T>(path, {
      baseURL: config.public.apiBase,
      ...options,
      headers: {
        ...(token.value ? { Authorization: `Bearer ${token.value}` } : {}),
        ...(options.headers as Record<string, string> | undefined),
      },
      onResponseError({ response }) {
        if (response.status === 401) {
          void handleUnauthorized()
        }
      },
    })
  }

  return { apiFetch, useApiFetch }
}
