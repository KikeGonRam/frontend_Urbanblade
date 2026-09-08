<script setup lang="ts">
definePageMeta({ middleware: ['auth', 'barber'], layout: 'dashboard' })

interface Media {
  id: string
  url: string
  type: 'image' | 'video'
}

interface Work {
  id: string
  title: string
  description: string | null
  media: Media[]
  reactions_count: number
  comments_count: number
  created_at: string
}

interface PortfolioResponse {
  works: Work[]
  stats: Record<string, number>
}

const { apiFetch } = useApi()
const { confirm } = useConfirm()

const { data, pending, error, refresh } = await useAsyncData<PortfolioResponse>(
  'barber-portfolio',
  () => apiFetch('/barber/portfolio'),
)

const works = computed(() => data.value?.works ?? [])
const stats = computed(() => data.value?.stats ?? {})

const showForm = ref(false)
const title = ref('')
const description = ref('')
const files = ref<File[]>([])
const filePreviews = ref<Array<{ url: string, isVideo: boolean }>>([])
const saving = ref(false)
const formError = ref('')

function selectFiles(event: Event) {
  const selected = Array.from((event.target as HTMLInputElement).files ?? [])
  if (selected.length > 10) {
    formError.value = 'Solo puedes subir hasta 10 archivos por publicación.'
    return
  }
  files.value = selected
  filePreviews.value = selected.map(file => ({
    url: URL.createObjectURL(file),
    isVideo: file.type.startsWith('video/'),
  }))
  formError.value = ''
}

function removeSelectedFile(index: number) {
  files.value.splice(index, 1)
  filePreviews.value.splice(index, 1)
}

function closeForm() {
  showForm.value = false
  title.value = ''
  description.value = ''
  files.value = []
  filePreviews.value = []
  formError.value = ''
}

async function publish() {
  if (!title.value.trim()) {
    formError.value = 'El título es obligatorio.'
    return
  }
  if (!files.value.length) {
    formError.value = 'Selecciona al menos una foto o video para tu trabajo.'
    return
  }

  saving.value = true
  formError.value = ''

  try {
    const body = new FormData()
    body.append('title', title.value)
    if (description.value) {
      body.append('description', description.value)
    }
    files.value.forEach(file => body.append('media[]', file))

    await apiFetch('/barber/works', { method: 'POST', body })
    closeForm()
    await refresh()
  } catch (err: unknown) {
    const dataErr = (err as { data?: { message?: string } })?.data
    formError.value = dataErr?.message ?? 'No se pudo publicar el trabajo.'
  } finally {
    saving.value = false
  }
}

async function remove(work: Work) {
  const ok = await confirm({
    title: 'Eliminar trabajo',
    message: `¿Estás seguro de que deseas eliminar "${work.title}" de tu portafolio? Esta acción no se puede deshacer.`,
    confirmText: 'Sí, eliminar',
    isDanger: true,
  })
  if (!ok) return

  try {
    await apiFetch(`/barber/works/${work.id}`, { method: 'DELETE' })
    await refresh()
  } catch (err: unknown) {
    const dataErr = (err as { data?: { message?: string } })?.data
    alert(dataErr?.message ?? 'No se pudo eliminar el trabajo.')
  }
}
</script>

<template>
  <div class="p-4 sm:p-6 lg:p-8">
    <header class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p class="text-xs uppercase tracking-widest text-muted">Mi espacio</p>
        <h1 class="mt-1 text-2xl font-semibold text-ink">
          Mi <span class="text-gold">Portafolio</span>
        </h1>
        <p class="mt-1 text-sm text-muted">Tu carta de presentación profesional para atraer nuevos clientes.</p>
      </div>
      <button
        type="button"
        class="rounded-lg bg-gold px-4 py-2 text-sm font-bold text-black hover:bg-gold-dim"
        @click="showForm = true"
      >
        + Publicar trabajo
      </button>
    </header>

    <!-- Métricas del portafolio -->
    <section class="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div
        v-for="card in [
          { k: 'total_works', l: 'Trabajos' },
          { k: 'total_reactions', l: 'Reacciones' },
          { k: 'total_comments', l: 'Comentarios' },
          { k: 'total_saves', l: 'Guardados' },
        ]"
        :key="card.k"
        class="ui-card p-4"
      >
        <p class="text-xs font-semibold uppercase tracking-wider text-muted">{{ card.l }}</p>
        <p class="mt-2 text-2xl font-black text-ink">{{ stats[card.k] ?? 0 }}</p>
      </div>
    </section>

    <div v-if="pending" class="flex items-center gap-3 py-12 text-sm text-muted">
      <div class="h-5 w-5 animate-spin rounded-full border-2 border-gold border-t-transparent" />
      <span>Cargando portafolio…</span>
    </div>

    <p v-else-if="error" class="text-sm text-red-400">No se pudo cargar el portafolio.</p>

    <section v-else class="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
      <article
        v-for="work in works"
        :key="work.id"
        class="ui-card overflow-hidden transition-shadow hover:shadow-lg"
      >
        <div class="aspect-video w-full bg-main">
          <video
            v-if="work.media[0]?.type === 'video'"
            :src="work.media[0].url"
            controls
            class="h-full w-full object-cover"
          />
          <img
            v-else-if="work.media[0]"
            :src="work.media[0].url"
            :alt="work.title"
            class="h-full w-full object-cover"
          >
          <div v-else class="flex h-full items-center justify-center text-xs text-muted">
            Sin medio
          </div>
        </div>

        <div class="p-5">
          <div class="flex items-start justify-between gap-3">
            <div>
              <h2 class="font-bold text-ink">{{ work.title }}</h2>
              <p v-if="work.description" class="mt-1 text-sm text-muted">{{ work.description }}</p>
            </div>
            <button
              type="button"
              class="rounded-lg border border-red-500/20 px-2.5 py-1 text-xs text-red-400 hover:bg-red-500/10"
              @click="remove(work)"
            >
              Eliminar
            </button>
          </div>
          <div class="mt-4 flex items-center justify-between border-t border-line/60 pt-3 text-xs text-muted">
            <span>{{ work.reactions_count }} reacciones · {{ work.comments_count }} comentarios</span>
            <span>{{ work.media.length }} {{ work.media.length === 1 ? 'archivo' : 'archivos' }}</span>
          </div>
        </div>
      </article>

      <div
        v-if="!works.length"
        class="ui-card col-span-full py-16 text-center text-sm text-muted"
      >
        Aún no has publicado trabajos. Haz clic en "+ Publicar trabajo" para comenzar a mostrar tus cortes.
      </div>
    </section>

    <!-- Modal para publicar nuevo trabajo -->
    <div
      v-if="showForm"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-label="Publicar nuevo trabajo"
      @click.self="closeForm"
    >
      <form
        class="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-line bg-card p-6 shadow-2xl"
        @submit.prevent="publish"
      >
        <h2 class="text-lg font-bold text-ink">Publicar trabajo en portafolio</h2>

        <div class="mt-4 space-y-4">
          <div>
            <label for="work-title" class="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">
              Título del corte o diseño
            </label>
            <input
              id="work-title"
              v-model="title"
              required
              maxlength="255"
              placeholder="Ej. Low Fade + Diseño personalizado"
              class="w-full rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink focus:border-gold focus:outline-hidden"
            >
          </div>

          <div>
            <label for="work-description" class="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">
              Descripción o técnicas aplicadas (opcional)
            </label>
            <textarea
              id="work-description"
              v-model="description"
              maxlength="2000"
              rows="3"
              placeholder="Detalles sobre el estilo, productos utilizados o corte realizado…"
              class="w-full rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink focus:border-gold focus:outline-hidden"
            />
          </div>

          <div>
            <label for="work-files" class="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">
              Fotos y videos del trabajo
            </label>
            <input
              id="work-files"
              type="file"
              required
              multiple
              accept="image/*,video/*"
              class="w-full text-sm text-muted file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-gold file:px-4 file:py-2 file:text-xs file:font-semibold file:text-black hover:file:bg-gold-dim"
              @change="selectFiles"
            >
            <p class="mt-1 text-xs text-muted">Hasta 10 archivos. Máximo 50 MB por archivo.</p>
          </div>

          <!-- Previsualización de archivos seleccionados -->
          <div v-if="filePreviews.length" class="space-y-2">
            <p class="text-xs font-semibold uppercase tracking-wider text-muted">Archivos seleccionados ({{ filePreviews.length }}):</p>
            <div class="grid grid-cols-4 gap-2">
              <div
                v-for="(prev, i) in filePreviews"
                :key="i"
                class="group relative aspect-square overflow-hidden rounded-lg border border-line bg-main"
              >
                <video v-if="prev.isVideo" :src="prev.url" class="h-full w-full object-cover" />
                <img v-else :src="prev.url" alt="Preview" class="h-full w-full object-cover">
                <button
                  type="button"
                  class="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/80 text-xs text-white opacity-0 group-hover:opacity-100"
                  title="Quitar"
                  @click="removeSelectedFile(i)"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        </div>

        <p v-if="formError" class="mt-3 text-xs text-red-400">{{ formError }}</p>

        <div class="mt-6 flex justify-end gap-3">
          <button
            type="button"
            class="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-muted hover:text-ink"
            @click="closeForm"
          >
            Cancelar
          </button>
          <button
            type="submit"
            :disabled="saving || !files.length"
            class="rounded-lg bg-gold px-5 py-2 text-sm font-bold text-black hover:bg-gold-dim disabled:opacity-50"
          >
            {{ saving ? 'Publicando…' : 'Publicar trabajo' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
