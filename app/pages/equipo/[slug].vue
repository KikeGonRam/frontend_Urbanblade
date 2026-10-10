<script setup lang="ts">
/*
 * Perfil público de barbero -- puerto de barber's /equipo/{barber} (Blade,
 * BarberController::show()): portafolio, reseñas y, solo si el visitante ya
 * inició sesión como cliente con una cita completada con él y no lo ha
 * reseñado, el formulario para dejar reseña. Mismo endpoint que
 * app/pages/barbers/[slug].vue (ya no requiere token desde que
 * GET barbers/{barber} salió de mobile.auth el 2026-09-09), pero sin
 * middleware ni layout de dashboard: cualquier visitante puede entrar aquí.
 */
import { publicImageUrl } from '~/utils/publicImage'

definePageMeta({ layout: 'public' })

interface Work { id: string, title: string | null, description: string | null, images: string[] }
interface Review { id: string, rating: number, comment: string | null, created_at: string | null, client: { user: { name: string | null } }, service?: string | null }

interface BarberDetail {
  barber: { id: string, slug: string | null, descripcion: string | null, especialidades: string | null, foto: string | null, user: { id: string, name: string } | null }
  works: Work[]
  reviews: Review[]
  avg_rating: number | null
  total_reviews: number
  citas_completadas: number
  can_review: boolean
  already_reviewed: boolean
  reviewable_services?: Array<{ id: string, nombre: string }>
}

const route = useRoute()
const { apiFetch } = useApi()
const { user, hasRole, fetchMe, isAuthenticated } = useAuth()

if (isAuthenticated.value && !user.value) {
  await fetchMe()
}

const { data: response, pending, error, refresh } = await useAsyncData(
  `public-barber-detail-${route.params.slug}`,
  () => apiFetch<BarberDetail>(`/barbers/${route.params.slug}`),
)

useSeoMeta({
  title: () => response.value?.barber.user?.name ? `${response.value.barber.user.name} — UrbanBlade` : 'Equipo — UrbanBlade',
  description: () => response.value?.barber.descripcion || 'Conoce el portafolio y las reseñas de este barbero de UrbanBlade.',
})

const barber = computed(() => response.value?.barber ?? null)
const works = computed(() => response.value?.works ?? [])
const reviews = computed(() => response.value?.reviews ?? [])
const brokenWorkImages = reactive<Record<string, boolean>>({})
const specialties = computed(() => (barber.value?.especialidades ?? '').split(',').map(item => item.trim()).filter(Boolean))
const isClient = computed(() => hasRole('cliente'))
const canReview = computed(() => isClient.value && (response.value?.can_review ?? false))

function fmtDate(iso: string | null) {
  if (!iso) return '—'

  return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ── Enviar reseña ────────────────────────────────────────────────────────
const rating = ref(5)
const serviceId = ref('')
const reviewableServices = computed(() => response.value?.reviewable_services ?? [])
watch(reviewableServices, (list) => {
  if (!serviceId.value && list.length === 1) serviceId.value = list[0]!.id
}, { immediate: true })
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
      body: { rating: rating.value, comment: comment.value || undefined, service_id: serviceId.value || undefined },
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
  <div class="relative overflow-hidden">
    <div class="pointer-events-none absolute -top-56 left-1/2 h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-gold/8 blur-[120px]" />
    <div class="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-16 lg:px-8">
    <NuxtLink to="/equipo" class="mb-8 inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.25em] text-muted transition-colors hover:text-gold">
      <span aria-hidden="true">←</span> Nuestro equipo
    </NuxtLink>

    <BrandStatePanel v-if="pending" mascot="bladebot" state="waiting" title="Cargando perfil…" />
    <BrandStatePanel
      v-else-if="error || !barber"
      mascot="bruno"
      state="error"
      tone="danger"
      title="No se pudo cargar este barbero"
      description="Inténtalo nuevamente en unos minutos."
      action-label="Reintentar"
      @action="refresh"
    />

    <template v-else>
      <header class="relative mb-14 overflow-hidden rounded-[2rem] border border-line bg-panel p-6 shadow-[0_30px_100px_rgba(0,0,0,0.28)] sm:p-10">
        <div class="absolute inset-y-0 right-0 hidden w-1/2 bg-[radial-gradient(circle_at_70%_35%,rgba(212,175,55,0.16),transparent_58%)] sm:block" />
        <div class="relative z-10 flex flex-col gap-8 md:flex-row md:items-center">
          <div class="relative shrink-0">
        <img
          v-if="barber.foto" :src="publicImageUrl(barber.foto, 1200) ?? undefined" :alt="barber.user?.name ?? 'Barbero'"
          class="h-28 w-28 rounded-[1.5rem] border border-gold/30 object-cover shadow-[0_12px_35px_rgba(0,0,0,0.35)] sm:h-36 sm:w-36"
        >
        <div v-else class="flex h-28 w-28 items-center justify-center rounded-[1.5rem] bg-gold/10 text-4xl font-black text-gold sm:h-36 sm:w-36">
          {{ (barber.user?.name ?? '?').charAt(0) }}
        </div>
          <span class="absolute -bottom-3 left-4 rounded-full border border-gold/30 bg-main px-3 py-1 text-[9px] font-black uppercase tracking-widest text-gold">UrbanBlade</span>
          </div>
          <div class="min-w-0">
            <p class="mb-3 text-[10px] font-black uppercase tracking-[0.35em] text-gold">Maestro barbero</p>
            <h1 class="max-w-2xl text-3xl font-black uppercase leading-[0.95] tracking-tight text-ink sm:text-5xl">{{ barber.user?.name ?? 'Barbero' }}</h1>
            <div v-if="specialties.length" class="mt-5 flex flex-wrap gap-2">
              <span v-for="specialty in specialties" :key="specialty" class="rounded-full border border-gold/20 bg-gold/8 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-gold">{{ specialty }}</span>
            </div>
            <p class="mt-5 max-w-xl text-sm leading-relaxed text-muted">{{ barber.descripcion || 'Especialista en crear una experiencia de grooming precisa, personal y a tu medida.' }}</p>
          </div>
          <NuxtLink :to="`/reservar?barbero=${barber.id}`" class="ui-btn shrink-0 px-6 py-3 text-[11px] tracking-[0.16em] md:ml-auto">
            Reservar cita <span aria-hidden="true">→</span>
          </NuxtLink>
        </div>
        <div class="relative z-10 mt-10 grid grid-cols-3 divide-x divide-line border-t border-line pt-6">
          <div class="px-3 text-center first:pl-0"><p class="text-xl font-black text-ink">{{ response?.citas_completadas ?? 0 }}</p><p class="mt-1 text-[9px] font-black uppercase tracking-widest text-muted">Citas completadas</p></div>
          <div class="px-3 text-center"><p class="text-xl font-black text-ink">{{ response?.total_reviews ?? 0 }}</p><p class="mt-1 text-[9px] font-black uppercase tracking-widest text-muted">Reseñas</p></div>
          <div class="px-3 text-center last:pr-0"><p class="text-xl font-black text-gold">{{ response?.avg_rating ? `★ ${response.avg_rating}` : '—' }}</p><p class="mt-1 text-[9px] font-black uppercase tracking-widest text-muted">Calificación</p></div>
        </div>
      </header>

      <section class="mb-16">
        <div class="mb-6 flex items-end justify-between gap-4">
          <div>
            <p class="mb-2 text-[10px] font-black uppercase tracking-[0.3em] text-gold">Trabajo seleccionado</p>
            <h2 class="text-2xl font-black uppercase tracking-tight text-ink">Portafolio <span class="text-gold">del maestro</span></h2>
          </div>
          <span v-if="works.length" class="text-xs text-muted">{{ works.length }} {{ works.length === 1 ? 'trabajo' : 'trabajos' }}</span>
        </div>
        <p v-if="!works.length" class="ui-card p-8 text-sm text-muted">Todavía no ha publicado trabajos.</p>
        <div v-else class="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <article v-for="(work, index) in works" :key="work.id" class="group relative overflow-hidden rounded-2xl border border-line bg-card shadow-[0_16px_40px_rgba(0,0,0,0.2)]" :class="{ 'sm:col-span-2 sm:row-span-2': index === 0 }">
            <div class="aspect-square h-full min-h-40">
              <img
                v-if="work.images[0] && !brokenWorkImages[work.id]"
                :src="publicImageUrl(work.images[0], 1800) ?? undefined"
                :alt="work.title ?? 'Trabajo de barbería'"
                loading="lazy"
                decoding="async"
                class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                @error="brokenWorkImages[work.id] = true"
              >
              <div v-else class="flex h-full w-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-gold/10 via-card to-main p-5 text-center">
                <svg class="h-8 w-8 text-gold/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.4" d="m3 16 5-5 4 4 3-3 6 6M15 8h.01M5 20h14a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1Z" /></svg>
                <span class="text-[10px] font-black uppercase tracking-widest text-muted">Imagen no disponible</span>
              </div>
            </div>
            <div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-4 pt-12">
              <p class="text-sm font-bold text-white">{{ work.title || 'Trabajo de barbería' }}</p>
              <p v-if="work.description" class="mt-1 line-clamp-2 text-xs text-white/70">{{ work.description }}</p>
            </div>
          </article>
        </div>
      </section>

      <section>
        <div class="mb-6">
          <p class="mb-2 text-[10px] font-black uppercase tracking-[0.3em] text-gold">Experiencias reales</p>
          <h2 class="text-2xl font-black uppercase tracking-tight text-ink">Lo que dicen sus <span class="text-gold">clientes</span></h2>
        </div>

        <div v-if="canReview" class="ui-card mb-5 p-5">
          <p v-if="submitted" class="text-sm text-emerald-400">¡Gracias por tu reseña!</p>
          <form v-else class="space-y-3" @submit.prevent="submitReview">
            <fieldset v-if="reviewableServices.length">
              <legend class="mb-2 block text-xs text-muted">¿Qué servicio calificas?</legend>
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="s in reviewableServices"
                  :key="s.id"
                  type="button"
                  :aria-pressed="serviceId === s.id"
                  class="rounded-full border px-3 py-1.5 text-xs font-semibold transition"
                  :class="serviceId === s.id ? 'border-gold bg-gold/15 text-gold' : 'border-line text-muted hover:border-gold/40'"
                  @click="serviceId = serviceId === s.id ? '' : s.id"
                >
                  {{ s.nombre }}
                </button>
              </div>
            </fieldset>
            <fieldset>
              <legend class="mb-1 block text-xs text-muted">Calificación</legend>
              <div class="flex gap-1" role="radiogroup" aria-label="Calificación">
                <button
                  v-for="n in 5"
                  :key="n"
                  type="button"
                  role="radio"
                  :aria-checked="rating === n"
                  :aria-label="`${n} estrella${n === 1 ? '' : 's'}`"
                  class="text-3xl leading-none transition-transform hover:scale-110"
                  :class="n <= rating ? 'text-gold' : 'text-ink/20'"
                  @click="rating = n"
                >
                  ★
                </button>
              </div>
            </fieldset>
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
            <p class="mb-1 text-gold">
              {{ '★'.repeat(review.rating) }}{{ '☆'.repeat(5 - review.rating) }}
              <span v-if="review.service" class="ml-2 rounded-full border border-gold/30 bg-gold/10 px-2 py-0.5 text-[11px] font-semibold">{{ review.service }}</span>
            </p>
            <p v-if="review.comment" class="text-sm text-muted">{{ review.comment }}</p>
          </div>
        </div>
      </section>
    </template>
    </div>
  </div>
</template>
