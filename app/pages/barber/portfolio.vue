<script setup lang="ts">
definePageMeta({ middleware: ['auth', 'barber'], layout: 'dashboard' })

useSeoMeta({ title: 'Mi portafolio — UrbanBlade', robots: 'noindex' })

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
  { lazy: true },
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
const actionError = ref('')

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
    actionError.value = ''
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
    actionError.value = dataErr?.message ?? 'No se pudo eliminar el trabajo.'
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
    <p v-if="actionError" role="alert" class="mb-4 text-sm text-danger">{{ actionError }}</p>

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

    <BrandStatePanel v-if="pending" mascot="bladebot" state="waiting" title="Cargando portafolio…" />

    <BrandStatePanel v-else-if="error" mascot="bruno" state="error" tone="danger" title="No se pudo cargar el portafolio" description="Inténtalo nuevamente en unos minutos." />

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
              class="rounded-lg border border-danger/20 px-2.5 py-1 text-xs text-danger hover:bg-danger/10 min-h-10"
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

      <BrandStatePanel
        v-if="!works.length"
        class="col-span-full"
        mascot="nava"
        state="empty"
        title="Aún no has publicado trabajos"
        description="Usa “Publicar trabajo” para comenzar a mostrar tus cortes."
      />
    </section>

    <UiFormSheet
      v-if="showForm"
      title="Publicar trabajo"
      kicker="Portafolio"
      icon="image"
      subtitle="Muestra tu mejor corte con fotos o video."
      badge="Nuevo"
      form-id="work-form"
      submit-label="Publicar trabajo"
      hint="Se publica en tu perfil público"
      :submit-disabled="!files.length"
      :busy="saving"
      @close="closeForm"
    >
      <form id="work-form" class="space-y-6" @submit.prevent="publish">
        <section class="space-y-4" aria-labelledby="wk-info">
          <p id="wk-info" class="ub-form-section__title">El trabajo</p>
          <UiFormField field-id="work-title" label="Título del corte o diseño" icon="scissors">
            <input
              id="work-title"
              v-model="title"
              aria-label="Título del corte o diseño"
              required
              maxlength="255"
              placeholder="Ej. Low Fade + Diseño personalizado"
              class="ui-input w-full"
            >
          </UiFormField>
          <UiFormField field-id="work-description" label="Descripción o técnicas aplicadas (opcional)" icon="text" top>
            <textarea
              id="work-description"
              v-model="description"
              aria-label="Descripción o técnicas aplicadas (opcional)"
              maxlength="2000"
              rows="3"
              placeholder="Detalles sobre el estilo, productos utilizados o corte realizado…"
              class="ui-input w-full"
            />
          </UiFormField>
        </section>

        <section class="space-y-4" aria-labelledby="wk-files">
          <p id="wk-files" class="ub-form-section__title">Fotos y videos</p>
          <UiFormField
            field-id="work-files"
            label="Archivos del trabajo"
            icon="image"
            hint="Hasta 10 archivos. Máximo 50 MB por archivo."
          >
            <input
              id="work-files"
              aria-label="Fotos y videos del trabajo"
              type="file"
              required
              multiple
              accept="image/*,video/*"
              class="ui-input w-full text-sm text-muted file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-gold file:px-4 file:py-1.5 file:text-xs file:font-semibold file:text-black hover:file:bg-gold-dim"
              @change="selectFiles"
            >
          </UiFormField>
          <div v-if="filePreviews.length" class="space-y-2">
            <p class="ub-form-help">Archivos seleccionados ({{ filePreviews.length }})</p>
            <div class="grid grid-cols-3 gap-2 sm:grid-cols-4">
              <div
                v-for="(prev, i) in filePreviews"
                :key="i"
                class="group relative aspect-square overflow-hidden rounded-xl border border-line bg-main"
              >
                <video v-if="prev.isVideo" :src="prev.url" class="h-full w-full object-cover" />
                <img v-else :src="prev.url" alt="Vista previa" class="h-full w-full object-cover">
                <button
                  type="button"
                  class="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/80 text-white opacity-0 focus-visible:opacity-100 group-hover:opacity-100"
                  aria-label="Quitar archivo"
                  @click="removeSelectedFile(i)"
                >
                  <UiIcon name="x" />
                </button>
              </div>
            </div>
          </div>
        </section>

        <p v-if="formError" role="alert" class="text-sm text-danger">{{ formError }}</p>
      </form>
    </UiFormSheet>
  </div>
</template>
