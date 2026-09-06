export interface ChatMessage {
  id: string
  role: 'user' | 'bot'
  text: string
  timestamp: string
  /** Solo en mensajes de error del bot: el texto que se reintenta al pulsar "Reintentar". */
  retryText?: string
  /** Solo en mensajes normales del bot: la pregunta que originó esta respuesta, para /chatbot/feedback. */
  question?: string
  /** Solo en mensajes normales del bot: null = sin calificar todavía. */
  feedback?: 'up' | 'down' | null
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

let nextId = 0
function makeId() {
  nextId += 1

  return `${Date.now()}-${nextId}`
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
 *
 * Timestamps, reintentar-en-error y calificar respuesta (👍/👎, vía
 * POST /chatbot/feedback) se agregaron después revisando cómo lo resuelven
 * otros widgets de asistencia ya establecidos (p. ej. el "Fin" de
 * Intercom, que marca cada respuesta como de un "AI Agent" con hora y dejaba
 * calificarla) — feedback en particular no era solo estético: el backend ya
 * tenía ChatbotLearningService::recordFeedback(), pero cada rama de
 * ChatbotController::query() lo llamaba con $wasHelpful hardcodeado en
 * `true`, así que el sistema de aprendizaje nunca había recibido una señal
 * negativa real de ningún usuario.
 */
export function useChatbot() {
  const { apiFetch } = useApi()
  const { isAuthenticated } = useAuth()

  function greeting(): ChatMessage {
    return { id: makeId(), role: 'bot', text: '¡Hola! Soy el Concierge de UrbanBlade.\n¿En qué puedo ayudarte hoy?', timestamp: new Date().toISOString() }
  }

  const messages = useState<ChatMessage[]>('chatbot_messages', () => [greeting()])
  const historyLoaded = useState<boolean>('chatbot_history_loaded', () => false)
  const typing = ref(false)

  async function loadHistory() {
    if (historyLoaded.value || !isAuthenticated.value) return

    historyLoaded.value = true

    try {
      const { history } = await apiFetch<HistoryResponse>('/chatbot/history')

      if (history.length) {
        messages.value = history.flatMap((item): ChatMessage[] => {
          const ts = item.timestamp ?? new Date().toISOString()

          return [
            { id: makeId(), role: 'user', text: item.message, timestamp: ts },
            { id: makeId(), role: 'bot', text: item.response, timestamp: ts, question: item.message, feedback: null },
          ]
        })
      }
    } catch {
      // Sin historial previo disponible -- se queda con el saludo inicial.
    }
  }

  async function sendMessage(text: string) {
    const trimmed = text.trim()
    if (!trimmed || typing.value) return

    messages.value = [...messages.value, { id: makeId(), role: 'user', text: trimmed, timestamp: new Date().toISOString() }]
    typing.value = true

    try {
      const data = await apiFetch<QueryResponse>('/chatbot/query', {
        method: 'POST',
        body: { message: trimmed },
      })
      const responseText = data.response ?? 'Sin respuesta disponible.'
      messages.value = [...messages.value, {
        id: makeId(),
        role: 'bot',
        text: responseText,
        timestamp: new Date().toISOString(),
        question: trimmed,
        feedback: null,
      }]
    } catch (err: unknown) {
      const status = (err as { statusCode?: number, response?: { status?: number } })?.statusCode
        ?? (err as { response?: { status?: number } })?.response?.status

      const errorText = status === 429
        ? 'Demasiadas consultas seguidas. Espera unos segundos.'
        : status === 422
          ? 'Escribe tu consulta primero.'
          : 'Sin conexión. Intenta de nuevo.'

      messages.value = [...messages.value, {
        id: makeId(),
        role: 'bot',
        text: errorText,
        timestamp: new Date().toISOString(),
        retryText: status === 422 ? undefined : trimmed,
      }]
    } finally {
      typing.value = false
    }
  }

  async function retry(message: ChatMessage) {
    if (!message.retryText) return
    await sendMessage(message.retryText)
  }

  async function sendFeedback(message: ChatMessage, helpful: boolean) {
    if (message.role !== 'bot' || !message.question || message.feedback !== null) return

    // Optimista: la UI refleja la calificación de inmediato: es una mejora
    // de percepción del usuario, no una operación que deba bloquear en el
    // servidor, y un fallo de red aquí no amerita deshacerla.
    message.feedback = helpful ? 'up' : 'down'

    try {
      await apiFetch('/chatbot/feedback', {
        method: 'POST',
        body: { message: message.question, response: message.text, helpful },
      })
    } catch {
      // Se queda calificado localmente aunque el envío remoto falle.
    }
  }

  async function clearHistory() {
    messages.value = [greeting()]

    if (!isAuthenticated.value) return

    try {
      await apiFetch('/chatbot/clear-history', { method: 'POST' })
    } catch {
      // Se limpió localmente aunque el borrado remoto falle -- no bloquea al usuario.
    }
  }

  return { messages, typing, loadHistory, sendMessage, retry, sendFeedback, clearHistory }
}
