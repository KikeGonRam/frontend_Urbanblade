<script setup lang="ts">
definePageMeta({ middleware: ['auth', 'barber'], layout: 'dashboard' })

interface Profile {
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

const { apiFetch } = useApi()
const { data, pending, error, refresh } = await useAsyncData<Profile>('barber-profile', () => apiFetch('/barber/me'), { lazy: true })

const especialidades = ref('')
const descripcion = ref('')
const foto = ref<File | null>(null)
const fotoPreview = ref<string | null>(null)
const saving = ref(false)
const message = ref('')
const errorMessage = ref('')

watchEffect(() => {
  if (data.value && !especialidades.value && !descripcion.value) {
    especialidades.value = data.value.especialidades ?? ''
    descripcion.value = data.value.descripcion ?? ''
  }
})

function selectPhoto(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0] ?? null
  if (file && file.size > 4 * 1024 * 1024) {
    errorMessage.value = 'La foto excede el límite máximo de 4 MB.'
    return
  }
  foto.value = file
  fotoPreview.value = file ? URL.createObjectURL(file) : null
  errorMessage.value = ''
}

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
    fotoPreview.value = null
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
    <header class="mb-6">
      <p class="text-xs uppercase tracking-widest text-muted">Mi espacio</p>
      <h1 class="mt-1 text-2xl font-semibold text-ink">
        Mi <span class="text-gold">Perfil Profesional</span>
      </h1>
      <p class="mt-1 text-sm text-muted">Actualiza tu presentación pública y especialidades.</p>
    </header>

    <div v-if="pending" class="flex items-center gap-3 py-8 text-sm text-muted">
      <div class="h-5 w-5 animate-spin rounded-full border-2 border-gold border-t-transparent" />
      <span>Cargando perfil…</span>
    </div>

    <p v-else-if="error" class="text-sm text-red-400">No se pudo cargar tu perfil.</p>

    <div v-else-if="data" class="grid gap-6 lg:grid-cols-[320px_1fr]">
      <!-- Tarjeta lateral de resumen -->
      <aside class="space-y-4">
        <section class="ui-card p-6 text-center">
          <img
            v-if="fotoPreview || data.foto_url"
            :src="fotoPreview || data.foto_url || ''"
            :alt="data.name"
            class="mx-auto h-28 w-28 rounded-full border border-line object-cover"
          >
          <div
            v-else
            class="mx-auto flex h-28 w-28 items-center justify-center rounded-full bg-gold/10 text-3xl font-black text-gold"
          >
            {{ data.name.slice(0, 2).toUpperCase() }}
          </div>

          <h2 class="mt-4 text-xl font-black text-ink">{{ data.name }}</h2>
          <p class="text-sm text-gold">
            {{ especialidades.split(',')[0] || 'Maestro barbero' }}
          </p>

          <div class="mt-5 grid grid-cols-3 border-t border-line pt-4 text-center">
            <div>
              <b class="text-ink">{{ data.calificacion_promedio ?? '—' }}</b>
              <p class="text-xs text-muted">Rating</p>
            </div>
            <div>
              <b class="text-ink">{{ data.stats.total_completadas }}</b>
              <p class="text-xs text-muted">Citas</p>
            </div>
            <div>
              <b class="text-ink">{{ data.years_experience }}a</b>
              <p class="text-xs text-muted">Exp.</p>
            </div>
          </div>
        </section>

        <section class="ui-card p-5 text-sm">
          <p class="text-xs font-semibold uppercase tracking-wider text-muted">Cuenta</p>
          <p class="mt-2 font-bold text-ink">{{ data.email }}</p>
          <p class="mt-1 text-xs text-muted">
            {{ data.total_resenas }} reseñas · {{ data.portfolio_total }} trabajos en portafolio
          </p>
        </section>
      </aside>

      <!-- Formulario de edición -->
      <form class="ui-card space-y-5 p-6" @submit.prevent="save">
        <div>
          <label for="barber-especialidades" class="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">
            Especialidades
          </label>
          <input
            id="barber-especialidades"
            v-model="especialidades"
            maxlength="1000"
            class="w-full rounded-lg border border-line bg-main px-3 py-2 text-ink focus:border-gold focus:outline-hidden"
            placeholder="Fade, Barba clásica, Colorimetría, Diseños…"
          >
          <p class="mt-1 text-xs text-muted">Separa tus técnicas y cortes con comas.</p>
        </div>

        <div>
          <label for="barber-bio" class="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">
            Sobre mí
          </label>
          <textarea
            id="barber-bio"
            v-model="descripcion"
            maxlength="1000"
            rows="5"
            class="w-full rounded-lg border border-line bg-main px-3 py-2 text-ink focus:border-gold focus:outline-hidden"
            placeholder="Cuéntale a tus clientes sobre tu experiencia y pasión por la barbería…"
          />
        </div>

        <div>
          <label for="barber-photo" class="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">
            Foto de perfil profesional
          </label>
          <input
            id="barber-photo"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            class="w-full text-sm text-muted file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-gold file:px-4 file:py-2 file:text-xs file:font-semibold file:text-black hover:file:bg-gold-dim"
            @change="selectPhoto"
          >
          <p class="mt-1 text-xs text-muted">Formatos JPG, PNG o WebP. Máximo 4 MB.</p>
        </div>

        <p v-if="message" class="text-sm font-medium text-emerald-400">{{ message }}</p>
        <p v-if="errorMessage" class="text-sm font-medium text-red-400">{{ errorMessage }}</p>

        <button
          type="submit"
          :disabled="saving"
          class="rounded-lg bg-gold px-5 py-2.5 text-sm font-bold text-black hover:bg-gold-dim disabled:opacity-50"
        >
          {{ saving ? 'Guardando cambios…' : 'Guardar cambios' }}
        </button>
      </form>
    </div>
  </div>
</template>
