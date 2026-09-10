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

  /**
   * Descarga un archivo binario (zip, PDF) protegido por Bearer token: un
   * <a href> plano no puede mandar el header Authorization, así que se pide
   * como blob autenticado y se dispara la descarga via un <a download>
   * temporal con un object URL. Usado por el respaldo de BD (admin) y la
   * tarjeta de membresia en PDF (cliente) -- ver
   * Api\Admin\System\BackupController / Api\Dashboard\MembershipController
   * en barber.
   */
  async function downloadFile(path: string, filename: string): Promise<void> {
    const blob = await $fetch<Blob>(path, {
      baseURL: config.public.apiBase,
      responseType: 'blob',
      headers: token.value ? { Authorization: `Bearer ${token.value}` } : {},
    })

    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
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

  return { apiFetch, useApiFetch, downloadFile }
}
