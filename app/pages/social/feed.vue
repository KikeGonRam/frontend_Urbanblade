<script setup lang="ts">
/*
 * Muro/Reseñas (fase post-9.9) — Muro de Inspiración, puerto de
 * Social\SocialController (web). El feed ya existía como API (Api\Social\
 * SocialController) desde antes de esta fase; se amplió de forma aditiva
 * con 'media' (tipo imagen/video), 'comments' (últimos 3) y barber.slug/foto
 * para poder construir esta página. 'images' se conserva sin cambios.
 */
definePageMeta({ middleware: ['auth'], layout: 'dashboard' })

interface Media { url: string, type: 'image' | 'video' }
interface CommentPreview { id: string, comment: string, user: { name: string | null }, created_at: string | null }
interface WorkRow {
  id: string
  title: string
  description: string | null
  barber: { id: string | null, name: string | null, slug: string | null, foto: string | null }
  media: Media[]
  reactions_count: number
  comments_count: number
  saved_count: number
  is_reacted: boolean
  is_saved: boolean
  comments: CommentPreview[]
}
interface FeedResponse { data: WorkRow[], meta: { current_page: number, last_page: number, total: number } }

const { apiFetch } = useApi()

const { data, pending, error } = await useAsyncData('social-feed', () => apiFetch<FeedResponse>('/social/feed'), { lazy: true })
const works = ref<WorkRow[]>([])
watchEffect(() => { works.value = data.value?.data ?? [] })

const commentDrafts = reactive<Record<string, string>>({})
const commentSending = reactive<Record<string, boolean>>({})

function fmtDate(iso: string | null) {
  if (!iso) return '—'

  return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

async function toggleReact(work: WorkRow) {
  const wasReacted = work.is_reacted
  work.is_reacted = !wasReacted
  work.reactions_count += wasReacted ? -1 : 1
  try {
    await apiFetch<{ status: string, count: number }>(`/social/work/${work.id}/react`, { method: 'POST' })
  } catch {
    work.is_reacted = wasReacted
    work.reactions_count += wasReacted ? 1 : -1
  }
}

async function toggleSave(work: WorkRow) {
  const wasSaved = work.is_saved
  work.is_saved = !wasSaved
  work.saved_count += wasSaved ? -1 : 1
  try {
    await apiFetch<{ status: string }>(`/social/work/${work.id}/save`, { method: 'POST' })
  } catch {
    work.is_saved = wasSaved
    work.saved_count += wasSaved ? 1 : -1
  }
}

async function submitComment(work: WorkRow) {
  const text = (commentDrafts[work.id] ?? '').trim()
  if (!text) return

  commentSending[work.id] = true
  try {
    const res = await apiFetch<{ data: CommentPreview }>(`/social/work/${work.id}/comment`, {
      method: 'POST',
      body: { comment: text },
    })
    work.comments = [res.data, ...work.comments].slice(0, 3)
    work.comments_count += 1
    commentDrafts[work.id] = ''
  } catch {
    // Sin acción especial: el mensaje queda en el textarea para reintentar.
  } finally {
    commentSending[work.id] = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-xl p-4 sm:p-6 lg:p-8">
    <header class="mb-6">
      <p class="text-sm uppercase tracking-widest text-muted">UrbanBlade</p>
      <h1 class="mt-1 text-2xl font-semibold text-ink">
        Muro de <span class="text-gold">Inspiración</span>
      </h1>
      <p class="mt-1 text-sm text-muted">Los últimos trabajos publicados por nuestros barberos.</p>
    </header>

    <p v-if="pending" class="text-sm text-muted">Cargando…</p>
    <p v-else-if="error" class="text-sm text-red-400">No se pudo cargar el muro.</p>
    <p v-else-if="!works.length" class="rounded-2xl border border-dashed border-line p-12 text-center text-sm text-muted">
      Todavía no hay trabajos publicados.
    </p>

    <div v-else class="space-y-6">
      <article v-for="work in works" :key="work.id" class="ui-card overflow-hidden">
        <header class="flex items-center gap-3 p-4">
          <img
            v-if="work.barber.foto" :src="work.barber.foto" :alt="work.barber.name ?? ''"
            class="h-10 w-10 rounded-full object-cover"
          >
          <div v-else class="flex h-10 w-10 items-center justify-center rounded-full bg-main text-sm font-black text-muted">
            {{ (work.barber.name ?? '?').charAt(0) }}
          </div>
          <div class="min-w-0 flex-1">
            <NuxtLink
              v-if="work.barber.slug" :to="`/barbers/${work.barber.slug}`"
              class="truncate font-bold text-ink hover:text-gold"
            >
              {{ work.barber.name }}
            </NuxtLink>
            <p v-else class="truncate font-bold text-ink">{{ work.barber.name ?? 'Barbero' }}</p>
            <p class="text-xs text-muted">{{ work.title }}</p>
          </div>
        </header>

        <div class="aspect-square bg-main">
          <video v-if="work.media[0]?.type === 'video'" :src="work.media[0].url" controls class="h-full w-full object-cover" />
          <img v-else-if="work.media[0]" :src="work.media[0].url" :alt="work.title" class="h-full w-full object-cover">
          <div v-else class="flex h-full items-center justify-center text-muted">Sin imagen</div>
        </div>

        <div class="p-4">
          <div class="flex items-center gap-4">
            <button type="button" class="flex items-center gap-1.5 text-sm font-semibold" :class="work.is_reacted ? 'text-gold' : 'text-muted hover:text-ink'" @click="toggleReact(work)">
              <svg viewBox="0 0 24 24" class="h-5 w-5" :fill="work.is_reacted ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4.318 6.318a4.5 4.5 0 0 1 6.364 0L12 7.636l1.318-1.318a4.5 4.5 0 1 1 6.364 6.364L12 21l-7.682-8.318a4.5 4.5 0 0 1 0-6.364z" /></svg>
              {{ work.reactions_count }}
            </button>
            <span class="flex items-center gap-1.5 text-sm text-muted">
              <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 0 1-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
              {{ work.comments_count }}
            </span>
            <button type="button" class="ml-auto flex items-center gap-1.5 text-sm font-semibold" :class="work.is_saved ? 'text-gold' : 'text-muted hover:text-ink'" @click="toggleSave(work)">
              <svg viewBox="0 0 24 24" class="h-5 w-5" :fill="work.is_saved ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /></svg>
              {{ work.saved_count }}
            </button>
          </div>

          <p v-if="work.description" class="mt-3 text-sm text-ink">{{ work.description }}</p>

          <ul v-if="work.comments.length" class="mt-3 space-y-1.5">
            <li v-for="c in work.comments" :key="c.id" class="text-sm">
              <span class="font-bold text-ink">{{ c.user.name ?? 'Usuario' }}</span>
              <span class="ml-1.5 text-muted">{{ c.comment }}</span>
              <span class="ml-1.5 text-[10px] text-muted">{{ fmtDate(c.created_at) }}</span>
            </li>
          </ul>

          <form class="mt-3 flex gap-2" @submit.prevent="submitComment(work)">
            <input
              v-model="commentDrafts[work.id]" type="text" maxlength="500" placeholder="Agrega un comentario…"
              class="flex-1 rounded-lg border border-line bg-main px-3 py-1.5 text-sm text-ink"
            >
            <button
              type="submit" :disabled="commentSending[work.id] || !(commentDrafts[work.id] ?? '').trim()"
              class="rounded-lg bg-gold px-3 py-1.5 text-sm font-semibold text-black disabled:opacity-50"
            >
              Enviar
            </button>
          </form>
        </div>
      </article>
    </div>
  </div>
</template>
