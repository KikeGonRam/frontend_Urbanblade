export interface ChatMessage {
  role: 'user' | 'bot'
  text: string
}

interface QueryResponse {
  response?: string
  retry_after?: number
}

interface HistoryItem {
  timestamp: string | null
  type: string
  message: string
  response: string
}

interface HistoryResponse {
  history: HistoryItem[]
  summary: { total_messages: number }
}

/**
 * Chat de asistencia IA — consume el mismo backend en cascada que el widget
 * Blade (memoria → reglas locales → datos externos → IA de último recurso),
 * pero con historial persistido de verdad: barber/routes/api.php expone
 * POST /chatbot/query (con mobile.auth.optional -- funciona sin sesión, y
 * si hay token válido el mensaje queda asociado y guardado en Mongo, ver
 * ChatbotContextService::persistMessage()) y GET/POST /chatbot/history,
 * /chatbot/clear-history para leer/borrar esa copia. Ver
 * .claude/skills/push-and-chat-plan/SKILL.md, Fase 3-4.
 */
export function useChatbot() {
  const { apiFetch } = useApi()
  const { isAuthenticated } = useAuth()

  const GREETING: ChatMessage = { role: 'bot', text: '¡Hola! Soy el Concierge de UrbanBlade.\n¿En qué puedo ayudarte hoy?' }

  const messages = useState<ChatMessage[]>('chatbot_messages', () => [GREETING])
  const historyLoaded = useState<boolean>('chatbot_history_loaded', () => false)
  const typing = ref(false)

  async function loadHistory() {
    if (historyLoaded.value || !isAuthenticated.value) return

    historyLoaded.value = true

    try {
      const { history } = await apiFetch<HistoryResponse>('/chatbot/history')

      if (history.length) {
        messages.value = history.flatMap((item): ChatMessage[] => [
          { role: 'user', text: item.message },
          { role: 'bot', text: item.response },
        ])
      }
    } catch {
      // Sin historial previo disponible -- se queda con el saludo inicial.
    }
  }

  async function sendMessage(text: string) {
    const trimmed = text.trim()
    if (!trimmed || typing.value) return

    messages.value = [...messages.value, { role: 'user', text: trimmed }]
    typing.value = true

    try {
      const data = await apiFetch<QueryResponse>('/chatbot/query', {
        method: 'POST',
        body: { message: trimmed },
      })
      messages.value = [...messages.value, { role: 'bot', text: data.response ?? 'Sin respuesta disponible.' }]
    } catch (err: unknown) {
      const status = (err as { statusCode?: number, response?: { status?: number } })?.statusCode
        ?? (err as { response?: { status?: number } })?.response?.status

      if (status === 429) {
        messages.value = [...messages.value, { role: 'bot', text: 'Demasiadas consultas seguidas. Espera unos segundos.' }]
      } else if (status === 422) {
        messages.value = [...messages.value, { role: 'bot', text: 'Escribe tu consulta primero.' }]
      } else {
        messages.value = [...messages.value, { role: 'bot', text: 'Sin conexión. Intenta de nuevo.' }]
      }
    } finally {
      typing.value = false
    }
  }

  async function clearHistory() {
    messages.value = [{ role: 'bot', text: 'Conversación reiniciada. ¿En qué puedo ayudarte?' }]

    if (!isAuthenticated.value) return

    try {
      await apiFetch('/chatbot/clear-history', { method: 'POST' })
    } catch {
      // Se limpió localmente aunque el borrado remoto falle -- no bloquea al usuario.
    }
  }

  return { messages, typing, loadHistory, sendMessage, clearHistory }
}
