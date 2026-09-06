<script setup lang="ts">
/*
 * Concierge de UrbanBlade — reconstrucción en Vue del widget Blade+Alpine
 * (resources/views/components/chatbot.blade.php en barber), consumiendo la
 * misma API en cascada. Historial real vía useChatbot() (Fase 3-4, ver
 * .claude/skills/push-and-chat-plan/SKILL.md) en vez de reiniciar en cada
 * carga de página como el widget Blade. Timestamps, reintentar y calificar
 * respuesta (👍/👎) se agregaron después, inspirados en cómo lo resuelven
 * otros widgets de asistencia ya establecidos (ver useChatbot.ts).
 */
import type { ChatMessage } from '~/composables/useChatbot'

const { messages, typing, loadHistory, sendMessage, retry, sendFeedback, clearHistory } = useChatbot()
const { user, hasRole } = useAuth()

const open = ref(false)
const input = ref('')
const unread = ref(0)
const chatBox = ref<HTMLElement | null>(null)
const inputBox = ref<HTMLTextAreaElement | null>(null)

const quickChips = computed(() => {
  if (!user.value) {
    return ['¿Cómo agendar una cita?', '¿Cuáles son los precios?', '¿Dónde están ubicados?', '¿Qué métodos de pago aceptan?']
  }
  if (hasRole('cliente')) {
    return ['¿Cuál es mi próxima cita?', '¿Cuántos puntos tengo?', '¿Cuáles son los servicios?', '¿Cómo cancelo mi cita?']
  }
  if (hasRole('administrador')) {
    return ['¿Cuánto se facturó hoy?', '¿Cuáles son los barberos activos?', '¿Cómo gestionar usuarios?']
  }
  if (hasRole('barbero')) {
    return ['¿Cómo subo trabajos al muro?', '¿Cuáles son mis citas de hoy?']
  }

  return ['¿Qué servicios ofrecen?', '¿Cómo agendar una cita?']
})

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
}

function scrollBottom() {
  nextTick(() => {
    if (chatBox.value) chatBox.value.scrollTop = chatBox.value.scrollHeight
  })
}

async function toggle() {
  open.value = !open.value

  if (open.value) {
    unread.value = 0
    await loadHistory()
    scrollBottom()
    nextTick(() => inputBox.value?.focus())
  }
}

async function send() {
  const text = input.value
  if (!text.trim() || typing.value) return

  input.value = ''
  scrollBottom()
  await sendMessage(text)
  if (!open.value) unread.value++
  scrollBottom()
}

function quickSend(text: string) {
  input.value = text
  send()
}

async function retryClick(msg: ChatMessage) {
  await retry(msg)
  if (!open.value) unread.value++
  scrollBottom()
}

async function onClear() {
  await clearHistory()
  scrollBottom()
}

function handleKeydown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key === '/') {
    e.preventDefault()
    toggle()
  }
}

onMounted(() => document.addEventListener('keydown', handleKeydown))
onUnmounted(() => document.removeEventListener('keydown', handleKeydown))
</script>

<template>
  <div>
    <button
      type="button"
      class="fixed bottom-20 right-4 z-[200] flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-gold to-gold/70 text-black shadow-[0_8px_32px_rgba(212,175,55,0.4)] transition-all duration-300 hover:scale-110 active:scale-95 md:bottom-6 md:right-6 md:h-14 md:w-14"
      title="Asistente Virtual"
      @click="toggle"
    >
      <svg v-if="!open" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
      </svg>
      <svg v-else class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
      </svg>

      <span v-if="unread > 0 && !open" class="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[9px] font-black text-white">
        {{ unread }}
      </span>
    </button>

    <Teleport to="body">
      <div
        v-show="open"
        class="fixed bottom-[132px] right-4 z-[199] flex flex-col overflow-hidden rounded-2xl border border-line bg-card shadow-[0_20px_60px_rgba(0,0,0,0.9)] md:bottom-[88px] md:right-6"
        style="width: min(390px, calc(100vw - 32px)); height: min(540px, calc(100dvh - 164px));"
      >
        <header class="flex shrink-0 items-center justify-between border-b border-line bg-main/40 px-5 py-4">
          <div class="flex items-center gap-3">
            <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-gold/20 bg-gold/10">
              <svg class="h-5 w-5 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div>
              <h3 class="text-[11px] font-black uppercase tracking-widest text-ink">Concierge UrbanBlade</h3>
              <div class="mt-0.5 flex items-center gap-1.5">
                <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                <span class="text-[8px] font-bold uppercase tracking-widest text-muted">Asistente IA · En línea</span>
              </div>
            </div>
          </div>
          <div class="flex items-center gap-1">
            <button type="button" title="Nueva conversación" aria-label="Nueva conversación" class="flex h-7 w-7 items-center justify-center rounded-lg text-muted transition-all hover:bg-accent hover:text-ink" @click="onClear">
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            <button type="button" aria-label="Cerrar chat" class="flex h-7 w-7 items-center justify-center rounded-lg text-muted transition-all hover:bg-accent hover:text-ink" @click="toggle">
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </header>

        <div ref="chatBox" class="flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4">
          <div v-for="msg in messages" :key="msg.id" :class="msg.role === 'user' ? 'flex justify-end' : 'flex justify-start gap-2'">
            <div v-if="msg.role === 'bot'" class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-gold/20 bg-gold/10">
              <svg class="h-3 w-3 text-gold/60" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2a2 2 0 012 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 017 7h1a1 1 0 110 2h-1v1a2 2 0 01-2 2H5a2 2 0 01-2-2v-1H2a1 1 0 110-2h1a7 7 0 017-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 012-2zM9 9a5 5 0 00-5 5v3h16v-3a5 5 0 00-5-5H9z" />
              </svg>
            </div>
            <div class="flex max-w-[82%] flex-col" :class="msg.role === 'user' ? 'items-end' : 'items-start'">
              <div
                class="whitespace-pre-line break-words rounded-2xl px-3.5 py-2.5 text-[12px] leading-relaxed"
                :class="msg.role === 'user' ? 'rounded-tr-sm bg-gold font-medium text-black' : 'rounded-tl-sm border border-line bg-accent text-ink'"
              >
                {{ msg.text }}
              </div>
              <div class="mt-1 flex items-center gap-2 px-1">
                <span class="text-[9px] text-muted/50">{{ fmtTime(msg.timestamp) }}</span>
                <button
                  v-if="msg.retryText" type="button"
                  class="text-[9px] font-bold uppercase tracking-wide text-gold/80 hover:text-gold"
                  @click="retryClick(msg)"
                >
                  Reintentar
                </button>
                <template v-if="msg.role === 'bot' && msg.question">
                  <button
                    type="button" aria-label="Respuesta útil"
                    class="text-muted/50 transition-colors hover:text-emerald-400"
                    :class="{ 'text-emerald-400': msg.feedback === 'up' }"
                    :disabled="msg.feedback !== null" @click="sendFeedback(msg, true)"
                  >
                    <svg class="h-3 w-3" viewBox="0 0 24 24" :fill="msg.feedback === 'up' ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z" />
                    </svg>
                  </button>
                  <button
                    type="button" aria-label="Respuesta no útil"
                    class="text-muted/50 transition-colors hover:text-red-400"
                    :class="{ 'text-red-400': msg.feedback === 'down' }"
                    :disabled="msg.feedback !== null" @click="sendFeedback(msg, false)"
                  >
                    <svg class="h-3 w-3" viewBox="0 0 24 24" :fill="msg.feedback === 'down' ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3H10z" />
                    </svg>
                  </button>
                </template>
              </div>
            </div>
          </div>

          <div v-if="typing" class="flex justify-start gap-2">
            <div class="h-6 w-6 shrink-0 rounded-lg border border-gold/20 bg-gold/10" />
            <div class="flex items-center gap-1.5 rounded-2xl rounded-tl-sm border border-line bg-accent px-4 py-3">
              <span class="h-1.5 w-1.5 animate-bounce rounded-full bg-muted" style="animation-delay:0s" />
              <span class="h-1.5 w-1.5 animate-bounce rounded-full bg-muted" style="animation-delay:0.15s" />
              <span class="h-1.5 w-1.5 animate-bounce rounded-full bg-muted" style="animation-delay:0.3s" />
            </div>
          </div>
        </div>

        <div v-if="messages.length <= 2" class="flex shrink-0 flex-wrap gap-1.5 px-4 pb-3">
          <button
            v-for="chip in quickChips" :key="chip" type="button"
            class="rounded-lg border border-line bg-accent px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-muted transition-all hover:border-gold/40 hover:bg-gold/5 hover:text-gold"
            @click="quickSend(chip)"
          >
            {{ chip.replace(/[¿?]/g, '') }}
          </button>
        </div>

        <div class="shrink-0 border-t border-line px-4 pb-4 pt-2">
          <div class="flex items-end gap-2">
            <textarea
              ref="inputBox" v-model="input" rows="1" :disabled="typing" placeholder="Escribe tu consulta…"
              class="max-h-[100px] min-h-[40px] flex-1 resize-none rounded-xl border border-line bg-main px-3.5 py-2.5 text-[12px] leading-relaxed text-ink placeholder-muted/60 transition-all focus:border-gold/40 focus:ring-1 focus:ring-gold/40"
              @keydown.enter.exact.prevent="send"
            />
            <button
              type="button" :disabled="!input.trim() || typing"
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold text-black transition-all"
              :class="!input.trim() || typing ? 'cursor-not-allowed opacity-30' : 'hover:bg-gold-dim'"
              aria-label="Enviar mensaje" @click="send"
            >
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
          <p class="mt-2 text-center text-[8px] font-bold uppercase tracking-widest text-muted/50">
            Enter para enviar · Shift+Enter nueva línea
          </p>
        </div>
      </div>
    </Teleport>
  </div>
</template>
