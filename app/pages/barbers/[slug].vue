<script setup lang="ts">
/*
 * Fase 9.8 — perfil público de un barbero: portafolio, reseñas y (solo para
 * clientes que ya tuvieron una cita completada con él y no lo han reseñado
 * antes) el formulario para dejar una reseña — mismas reglas de elegibilidad
 * de BarberReviewService, ya resueltas por el backend en can_review/already_reviewed.
 */
definePageMeta({ middleware: ['auth'], layout: 'dashboard' })

interface Work { id: string, title: string | null, description: string | null, images: string[] }
interface Review { id: string, rating: number, comment: string | null, created_at: string | null, client: { user: { name: string | null } } }

interface BarberDetail {
  barber: { id: string, slug: string | null, descripcion: string | null, especialidades: string | null, foto: string | null, user: { id: string, name: string } | null }
  works: Work[]
  reviews: Review[]
  avg_rating: number | null
  total_reviews: number
  citas_completadas: number
  can_review: boolean
  already_reviewed: boolean
}

const route = useRoute()
const { apiFetch } = useApi()
const { hasRole } = useAuth()

const { data: response, pending, error, refresh } = await useAsyncData(
  `barber-detail-${route.params.slug}`,
  () => apiFetch<BarberDetail>(`/barbers/${route.params.slug}`),
)

const barber = computed(() => response.value?.barber ?? null)
const works = computed(() => response.value?.works ?? [])
const reviews = computed(() => response.value?.reviews ?? [])
const canReview = computed(() => hasRole('cliente') && (response.value?.can_review ?? false))

function fmtDate(iso: string | null) {
  if (!iso) return '—'

  return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ── Enviar reseña ────────────────────────────────────────────────────────
const rating = ref(5)
const comment = ref('')
const submitting = ref(false)
const submitError = ref('')
const submitted = ref(false)

async function submitReview() {
  if (!barber.value) return

  submitting.value = true
  submitError.value = ''
  try {
    await apiFetch(`/barbers/${barber.value.slug}/review`, {
      method: 'POST',
      body: { rating: rating.value, comment: comment.value || undefined },
    })
    submitted.value = true
    comment.value = ''
    await refresh()
  } catch (err: unknown) {
    submitError.value = (err as { data?: { message?: string } })?.data?.message ?? 'No se pudo enviar la reseña.'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="p-4 sm:p-6 lg:p-8">
    <NuxtLink to="/barbers" class="mb-5 inline-block text-xs font-bold uppercase tracking-widest text-muted hover:text-ink">
      ← Nuestros Barberos
    </NuxtLink>

    <p v-if="pending" class="text-sm text-muted">Cargando perfil…</p>
    <p v-else-if="error || !barber" class="text-sm text-red-400">No se pudo cargar este barbero.</p>

    <template v-else>
      <header class="mb-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        <img
          v-if="barber.foto" :src="barber.foto" :alt="barber.user?.name ?? 'Barbero'"
          class="h-20 w-20 rounded-full object-cover"
        >
        <div v-else class="flex h-20 w-20 items-center justify-center rounded-full bg-gold/10 text-2xl font-black text-gold">
          {{ (barber.user?.name ?? '?').charAt(0) }}
        </div>
        <div>
          <h1 class="text-2xl font-semibold text-ink">{{ barber.user?.name ?? 'Barbero' }}</h1>
          <p v-if="barber.especialidades" class="text-sm font-bold uppercase tracking-wide text-gold">{{ barber.especialidades }}</p>
          <p class="mt-1 text-sm text-muted">
            <span v-if="response?.avg_rating">★ {{ response.avg_rating }} ({{ response.total_reviews }} reseñas)</span>
            <span v-else>Sin reseñas aún</span>
            · {{ response?.citas_completadas ?? 0 }} citas completadas
          </p>
        </div>
      </header>

      <p v-if="barber.descripcion" class="mb-8 max-w-2xl text-sm text-muted">{{ barber.descripcion }}</p>

      <section class="mb-10">
        <h2 class="mb-3 text-lg font-semibold text-ink">Portafolio</h2>
        <p v-if="!works.length" class="text-sm text-muted">Todavía no ha publicado trabajos.</p>
        <div v-else class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <div v-for="work in works" :key="work.id" class="ui-card overflow-hidden">
            <img v-if="work.images[0]" :src="work.images[0]" :alt="work.title ?? 'Trabajo'" class="aspect-square w-full object-cover">
            <p v-if="work.title" class="p-2 text-xs font-bold text-ink">{{ work.title }}</p>
          </div>
        </div>
      </section>

      <section>
        <h2 class="mb-3 text-lg font-semibold text-ink">Reseñas</h2>

        <div v-if="canReview" class="ui-card mb-5 p-5">
          <p v-if="submitted" class="text-sm text-emerald-400">¡Gracias por tu reseña!</p>
          <form v-else class="space-y-3" @submit.prevent="submitReview">
            <div>
              <label class="mb-1 block text-xs text-muted">Calificación</label>
              <select v-model.number="rating" class="w-full rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink">
                <option v-for="n in [5, 4, 3, 2, 1]" :key="n" :value="n">{{ n }} estrella{{ n === 1 ? '' : 's' }}</option>
              </select>
            </div>
            <div>
              <label class="mb-1 block text-xs text-muted">Comentario (opcional)</label>
              <textarea v-model="comment" rows="2" maxlength="500" class="w-full rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink" />
            </div>
            <p v-if="submitError" class="text-sm text-red-400">{{ submitError }}</p>
            <button type="submit" :disabled="submitting" class="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-black hover:bg-gold-dim disabled:opacity-50">
              {{ submitting ? 'Enviando…' : 'Enviar reseña' }}
            </button>
          </form>
        </div>

        <p v-if="!reviews.length" class="text-sm text-muted">Todavía no tiene reseñas.</p>
        <div v-else class="space-y-3">
          <div v-for="review in reviews" :key="review.id" class="ui-card p-4">
            <div class="mb-1 flex items-center justify-between">
              <p class="font-bold text-ink">{{ review.client.user.name ?? 'Cliente' }}</p>
              <p class="text-xs text-muted">{{ fmtDate(review.created_at) }}</p>
            </div>
            <p class="mb-1 text-gold">{{ '★'.repeat(review.rating) }}{{ '☆'.repeat(5 - review.rating) }}</p>
            <p v-if="review.comment" class="text-sm text-muted">{{ review.comment }}</p>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>
