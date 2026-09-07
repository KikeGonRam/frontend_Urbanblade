/**
 * Cuenta regresiva para el mensaje de rate-limit (429) en las 4 páginas de
 * auth -- el backend ya throttlea login/register/forgot/reset (ver
 * AppServiceProvider::boot() y routes/api.php en barber) y responde con el
 * header Retry-After; esto solo lo hace visible en vez de caer en el mensaje
 * de error genérico.
 */
export function useRetryCountdown() {
  const secondsLeft = ref(0)
  let interval: ReturnType<typeof setInterval> | undefined

  function start(seconds: number) {
    secondsLeft.value = Math.max(1, Math.round(seconds))
    clearInterval(interval)
    interval = setInterval(() => {
      secondsLeft.value -= 1
      if (secondsLeft.value <= 0) clearInterval(interval)
    }, 1000)
  }

  /**
   * Lee Retry-After de un error de $fetch/ofetch e inicia la cuenta si el
   * status es 429. Devuelve true si era un rate-limit (para que el llamador
   * no muestre además su mensaje de error genérico).
   */
  function handle(error: unknown): boolean {
    const response = (error as { response?: { status?: number, headers?: Headers } })?.response
    if (response?.status !== 429) return false

    const header = response.headers?.get?.('Retry-After')
    start(header ? Number(header) : 60)

    return true
  }

  onBeforeUnmount(() => clearInterval(interval))

  return { secondsLeft, start, handle }
}
