import type { UseFetchOptions } from 'nuxt/app'

function hashKey(s: string): string {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(36)
}

function buildAutoKey(
  path: string,
  options: Record<string, unknown> | undefined,
  method?: string,
): string {
  const m = (method ?? (options?.method as string | undefined) ?? 'GET').toUpperCase()
  const q = options?.query
    ? hashKey(JSON.stringify(options.query))
    : ''
  return q ? `api:${m}:${path}?${q}` : `api:${m}:${path}`
}

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
    const key = (options.key as string | undefined) ?? buildAutoKey(path, options as Record<string, unknown>)
    return useFetch<T>(path, {
      baseURL: config.public.apiBase,
      ...options,
      key,
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
