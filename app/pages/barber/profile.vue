<script setup lang="ts">
/*
 * Perfil profesional del barbero. Además de editar especialidades, "sobre mí" y foto
 * (POST /barber/profile), muestra sus números (GET /barber/me) y cómo lo ven los clientes:
 * sus últimos trabajos y reseñas de su ficha pública (GET /barbers/{slug}), con enlace a ella.
 */
definePageMeta({ middleware: ['auth', 'barber'], layout: 'dashboard' })

interface Profile {
  id: string
  name: string
  email: string
  especialidades: string
  descripcion: string
  foto_url: string | null
  calificacion_promedio: number | null
  total_resenas: number
  member_since: string
  years_experience: number
  portfolio_total: number
  stats: {
    citas_hoy: number
    completadas_mes: number
    total_completadas: number
  }
}

interface PublicBarber {
  barber: { slug: string | null }
  works: Array<{ id: string; title: string; images: string[] }>
  reviews: Array<{ id: string; rating: number; comment: string | null; created_at: string | null; client: { user: { name: string | null } } }>
}

const { apiFetch } = useApi()
const { user } = useAuth()
const { data, pending, error, refresh } = await useAsyncData<Profile>('barber-profile', () => apiFetch('/barber/me'), { lazy: true })

// Ficha pública: se busca su slug en el catálogo y se trae su portafolio y reseñas.
const { data: publicProfile } = await useAsyncData<PublicBarber | null>(
  'barber-public-profile',
  async () => {
    const list = await apiFetch<{ data: Array<{ slug: string | null; user: { id: string } | null }> }>('/barbers')
    const mine = list.data.find((b) => b.user?.id === user.value?.id)

    return mine?.slug ? await apiFetch<PublicBarber>(`/barbers/${mine.slug}`) : null
  },
  { lazy: true, server: false },
)

const publicUrl = computed(() => (publicProfile.value?.barber.slug ? `/equipo/${publicProfile.value.barber.slug}` : null))
const recentWorks = computed(() => (publicProfile.value?.works ?? []).slice(0, 4))
const recentReviews = computed(() => (publicProfile.value?.reviews ?? []).slice(0, 3))
const isVideo = (url: string) => /\.(mp4|webm|mov|ogg)(\?|$)/i.test(url)

const especialidades = ref('')
const descripcion = ref('')
const foto = ref<File | null>(null)
const saving = ref(false)
const message = ref('')
const errorMessage = ref('')

watchEffect(() => {
  if (data.value && !especialidades.value && !descripcion.value) {
    especialidades.value = data.value.especialidades ?? ''
    descripcion.value = data.value.descripcion ?? ''
  }
})

// Sin foto de barbero se muestra la de su cuenta (p. ej. la de Google), igual que en el catálogo.
const photo = computed(() => data.value?.foto_url || user.value?.avatar_url || null)
const specialtyChips = computed(() => especialidades.value.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 6))

const kpis = computed(() => {
  const d = data.value
  if (!d) return []

  return [
    { label: 'Citas de hoy', value: String(d.stats.citas_hoy), hint: 'En tu agenda' },
    { label: 'Completadas este mes', value: String(d.stats.completadas_mes), hint: `${d.stats.total_completadas} en total` },
    { label: 'Calificación', value: d.calificacion_promedio ? `${d.calificacion_promedio.toFixed(1)} ★` : '—', hint: `${d.total_resenas} reseña${d.total_resenas === 1 ? '' : 's'}` },
    { label: 'Portafolio', value: String(d.portfolio_total), hint: `trabajo${d.portfolio_total === 1 ? '' : 's'} publicado${d.portfolio_total === 1 ? '' : 's'}` },
  ]
})

async function save() {
  saving.value = true
  message.value = ''
  errorMessage.value = ''

  try {
    const body = new FormData()
    body.append('especialidades', especialidades.value)
    body.append('descripcion', descripcion.value)
    if (foto.value) {
      body.append('foto', foto.value)
    }

    await apiFetch('/barber/profile', { method: 'POST', body })
    message.value = 'Perfil actualizado correctamente.'
    foto.value = null
    await refresh()
  } catch (err: unknown) {
    const dataErr = (err as { data?: { message?: string } })?.data
    errorMessage.value = dataErr?.message ?? 'No se pudo guardar la información.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="p-4 sm:p-6 lg:p-8">
    <header class="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p class="text-sm text-muted">Mi espacio</p>
        <h1 class="mt-1 text-2xl font-semibold text-ink">
          Mi <span class="text-gold">perfil profesional</span>
        </h1>
        <p class="mt-1 text-sm text-muted">Lo que ven tus clientes al reservar contigo.</p>
      </div>
      <NuxtLink v-if="publicUrl" :to="publicUrl" class="ui-btn-secondary min-h-10 px-4 text-sm">Ver mi perfil público →</NuxtLink>
    </header>

    <div v-if="pending" class="flex items-center gap-3 py-8 text-sm text-muted">
      <div class="h-5 w-5 animate-spin rounded-full border-2 border-gold border-t-transparent" />
      <span>Cargando perfil…</span>
    </div>

    <BrandStatePanel
      v-else-if="error"
      mascot="bruno"
      state="error"
      tone="danger"
      title="No se pudo cargar tu perfil"
      action-label="Reintentar"
      @action="refresh"
    />

    <div v-else-if="data" class="space-y-6">
      <section class="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="Tus números">
        <UiStatCard v-for="k in kpis" :key="k.label" :label="k.label" :value="k.value" :hint="k.hint" />
      </section>

      <div class="grid gap-6 lg:grid-cols-[340px_1fr]">
        <aside class="space-y-4">
          <section class="ub-rise rounded-2xl border border-line bg-card p-6 text-center">
            <img
              v-if="photo"
              :src="photo"
              :alt="data.name"
              referrerpolicy="no-referrer"
              class="mx-auto h-28 w-28 rounded-full border border-line object-cover"
            >
            <div
              v-else
              class="mx-auto flex h-28 w-28 items-center justify-center rounded-full bg-gold/10 text-3xl font-black text-gold"
            >
              {{ data.name.slice(0, 2).toUpperCase() }}
            </div>
            <h2 class="mt-4 text-xl font-semibold text-ink">{{ data.name }}</h2>
            <p class="text-sm text-muted">{{ data.years_experience }} año{{ data.years_experience === 1 ? '' : 's' }} en UrbanBlade</p>
            <ul v-if="specialtyChips.length" class="mt-4 flex flex-wrap justify-center gap-2" aria-label="Especialidades">
              <li v-for="chip in specialtyChips" :key="chip" class="rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-xs font-semibold text-gold">
                {{ chip }}
              </li>
            </ul>
            <p v-if="descripcion" class="mt-4 text-sm leading-relaxed text-muted">{{ descripcion }}</p>
          </section>

          <section class="ub-rise rounded-2xl border border-line bg-card p-5 text-sm">
            <p class="font-medium text-muted">Cuenta</p>
            <p class="mt-1 font-semibold text-ink">{{ data.email }}</p>
            <div class="mt-4 grid grid-cols-3 gap-2 text-center">
              <NuxtLink to="/barber/agenda" class="rounded-xl border border-line px-2 py-2 text-xs font-semibold text-ink hover:border-gold/40">Agenda</NuxtLink>
              <NuxtLink to="/barber/schedule" class="rounded-xl border border-line px-2 py-2 text-xs font-semibold text-ink hover:border-gold/40">Horario</NuxtLink>
              <NuxtLink to="/barber/portfolio" class="rounded-xl border border-line px-2 py-2 text-xs font-semibold text-ink hover:border-gold/40">Portafolio</NuxtLink>
            </div>
          </section>
        </aside>

        <div class="space-y-6">
          <form class="ub-rise space-y-5 rounded-2xl border border-line bg-card p-6" @submit.prevent="save">
            <h2 class="text-base font-semibold text-ink">Editar mi presentación</h2>
            <div>
              <label for="barber-especialidades" class="mb-1 block text-sm font-medium text-ink">Especialidades</label>
              <input
                id="barber-especialidades"
                v-model="especialidades"
                maxlength="1000"
                class="ui-input w-full"
                placeholder="Fade, Barba clásica, Colorimetría, Diseños…"
              >
              <p class="mt-1 text-xs text-muted">Sepáralas con comas; se muestran como etiquetas en tu perfil.</p>
            </div>

            <div>
              <label for="barber-bio" class="mb-1 block text-sm font-medium text-ink">Sobre mí</label>
              <textarea
                id="barber-bio"
                v-model="descripcion"
                maxlength="1000"
                rows="5"
                class="ui-input w-full"
                placeholder="Cuéntale a tus clientes sobre tu experiencia y tu estilo…"
              />
            </div>

            <UiImageUpload
              id="barber-photo"
              v-model="foto"
              label="Foto de perfil profesional"
              :current-url="photo"
              :max-mb="4"
              round
            />

            <p v-if="message" class="text-sm font-medium text-success" role="status">{{ message }}</p>
            <p v-if="errorMessage" class="text-sm font-medium text-danger" role="alert">{{ errorMessage }}</p>

            <button type="submit" :disabled="saving" class="ui-btn min-h-11 px-6 text-sm disabled:opacity-50">
              {{ saving ? 'Guardando cambios…' : 'Guardar cambios' }}
            </button>
          </form>

          <section class="ub-rise rounded-2xl border border-line bg-card p-6" aria-labelledby="barber-seen">
            <header class="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 id="barber-seen" class="text-base font-semibold text-ink">Así te ven tus clientes</h2>
                <p class="mt-0.5 text-sm text-muted">Tus últimos trabajos y reseñas en tu perfil público.</p>
              </div>
              <NuxtLink to="/barber/portfolio" class="text-sm font-semibold text-gold hover:underline">Publicar trabajo</NuxtLink>
            </header>

            <div v-if="recentWorks.length" class="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <figure v-for="w in recentWorks" :key="w.id" class="overflow-hidden rounded-xl border border-line bg-main">
                <video v-if="w.images[0] && isVideo(w.images[0])" :src="w.images[0]" muted playsinline preload="metadata" class="aspect-square w-full object-cover" />
                <img v-else-if="w.images[0]" :src="w.images[0]" :alt="w.title" loading="lazy" class="aspect-square w-full object-cover">
                <figcaption class="truncate px-3 py-2 text-xs font-medium text-ink">{{ w.title }}</figcaption>
              </figure>
            </div>
            <p v-else class="rounded-xl border border-dashed border-line py-6 text-center text-sm text-muted">
              Aún no publicas trabajos. Los clientes reservan más cuando ven tus cortes.
            </p>

            <h3 class="mb-3 mt-6 text-sm font-medium text-muted">Últimas reseñas</h3>
            <ul v-if="recentReviews.length" class="space-y-3">
              <li v-for="r in recentReviews" :key="r.id" class="rounded-xl border border-line p-4">
                <div class="flex items-center justify-between gap-3">
                  <span class="text-sm font-semibold text-ink">{{ r.client.user.name ?? 'Cliente' }}</span>
                  <span class="text-sm text-gold" :aria-label="`${r.rating} de 5 estrellas`">{{ '★'.repeat(r.rating) }}<span class="text-ink/20">{{ '★'.repeat(5 - r.rating) }}</span></span>
                </div>
                <p v-if="r.comment" class="mt-1 text-sm text-muted">{{ r.comment }}</p>
              </li>
            </ul>
            <p v-else class="text-sm text-muted">Todavía no tienes reseñas. Aparecen cuando un cliente califica su visita.</p>
          </section>
        </div>
      </div>
    </div>
  </div>
</template>
