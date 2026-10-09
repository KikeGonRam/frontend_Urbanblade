<script setup lang="ts">
definePageMeta({ middleware: 'auth', layout: 'dashboard' })

interface ProfileResponse {
  user: {
    id: string
    name: string
    email: string
    avatar_url: string | null
    roles: string[]
    created_at?: string
    profile_complete?: boolean
    profile_missing?: string[]
    client: { telefono: string | null, fecha_nacimiento: string | null, sexo: string | null } | null
  }
}

interface BarberProfileResponse {
  name: string
  email: string
  especialidades: string
  descripcion: string
  foto_url: string | null
  calificacion_promedio: number | null
  total_resenas: number
  years_experience: number
  portfolio_total: number
}

interface UpdateResponse {
  message: string
  user: ReturnType<typeof useAuth>['user']['value']
}

const { apiFetch } = useApi()
const { user, logout } = useAuth()

// ── Datos personales ────────────────────────────────────────────────────────
const name = ref('')
const email = ref('')
const telefono = ref('')
const fechaNacimiento = ref('')
const sexo = ref('')
const selectedAvatar = ref<File | null>(null)
const avatarPreview = ref<string | null>(null)
const loading = ref(true)
const saving = ref(false)
const uploading = ref(false)
const message = ref('')
const errorMessage = ref('')
const fieldErrors = ref<Record<string, string[]>>({})
const profileComplete = ref(false)
const profileMissing = ref<string[]>([])
const barberProfile = ref<BarberProfileResponse | null>(null)
const barberSpecialties = ref('')
const barberDescription = ref('')
const barberPhoto = ref<File | null>(null)
const barberPhotoPreview = ref<string | null>(null)
const barberSaving = ref(false)
const barberMessage = ref('')
const barberError = ref('')
const barberFieldErrors = ref<Record<string, string[]>>({})
const activeSection = ref<'public' | 'personal' | 'security' | 'danger'>('personal')

// ── Cambio de contraseña ───────────────────────────────────────────────────
const currentPassword = ref('')
const newPassword = ref('')
const newPasswordConfirmation = ref('')
const savingPassword = ref(false)
const passwordMessage = ref('')
const passwordErrorMessage = ref('')
const passwordFieldErrors = ref<Record<string, string[]>>({})

// ── Eliminación de cuenta ──────────────────────────────────────────────────
const showDeleteModal = ref(false)
const deletePassword = ref('')
const deleting = ref(false)
const deleteError = ref('')

const isAdministrator = computed(() => user.value?.roles?.includes('administrador') ?? false)
const isClient = computed(() => user.value?.roles?.includes('cliente') ?? false)
const isBarber = computed(() => user.value?.roles?.includes('barbero') ?? false)

onMounted(async () => {
  try {
    const response = await apiFetch<ProfileResponse>('/profile')
    name.value = response.user.name
    email.value = response.user.email
    telefono.value = response.user.client?.telefono ?? ''
    fechaNacimiento.value = response.user.client?.fecha_nacimiento ?? ''
    sexo.value = response.user.client?.sexo ?? ''
    profileComplete.value = response.user.profile_complete ?? false
    profileMissing.value = response.user.profile_missing ?? []
    if (user.value?.roles?.includes('barbero')) {
      const barber = await apiFetch<BarberProfileResponse>('/barber/me')
      barberProfile.value = barber
      barberSpecialties.value = barber.especialidades
      barberDescription.value = barber.descripcion
      activeSection.value = 'public'
    }
  } catch {
    errorMessage.value = 'No se pudo cargar tu perfil.'
  } finally {
    loading.value = false
  }

})

async function submitBarberProfile() {
  if (barberSaving.value) return
  barberSaving.value = true
  barberMessage.value = ''
  barberError.value = ''
  barberFieldErrors.value = {}
  try {
    const body = new FormData()
    body.append('especialidades', barberSpecialties.value)
    body.append('descripcion', barberDescription.value)
    if (barberPhoto.value) body.append('foto', barberPhoto.value)
    const response = await apiFetch<Pick<BarberProfileResponse, 'especialidades' | 'descripcion' | 'foto_url'> & { message: string }>('/barber/profile', {
      method: 'POST',
      body,
      headers: { Accept: 'application/json' },
    })
    barberSpecialties.value = response.especialidades
    barberDescription.value = response.descripcion
    if (barberProfile.value) barberProfile.value.foto_url = response.foto_url
    barberPhoto.value = null
    barberPhotoPreview.value = null
    barberMessage.value = response.message
  } catch (error: unknown) {
    const data = (error as { data?: { message?: string, errors?: Record<string, string[]> } })?.data
    barberFieldErrors.value = data?.errors ?? {}
    barberError.value = data?.message ?? 'No se pudo guardar tu perfil público.'
  } finally {
    barberSaving.value = false
  }
}

function selectAvatar(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0] ?? null
  if (file && file.size > 4 * 1024 * 1024) {
    errorMessage.value = 'La imagen excede el límite máximo de 4 MB.'
    return
  }
  selectedAvatar.value = file
  avatarPreview.value = file ? URL.createObjectURL(file) : null
}

async function uploadAvatar() {
  if (!selectedAvatar.value) return

  uploading.value = true
  errorMessage.value = ''
  try {
    const body = new FormData()
    body.append('avatar', selectedAvatar.value)
    const response = await apiFetch<UpdateResponse>('/profile/avatar', {
      method: 'POST',
      body,
      headers: { Accept: 'application/json' },
    })
    user.value = response.user
    selectedAvatar.value = null
    avatarPreview.value = null
    message.value = 'Foto de perfil actualizada correctamente.'
  } catch (error: unknown) {
    const data = (error as { data?: { message?: string } })?.data
    errorMessage.value = data?.message ?? 'No se pudo actualizar la foto.'
  } finally {
    uploading.value = false
  }
}

async function submitProfile() {
  if (saving.value) return
  saving.value = true
  message.value = ''
  errorMessage.value = ''
  fieldErrors.value = {}

  try {
    const response = await apiFetch<UpdateResponse>('/profile', {
      method: 'PUT',
      body: {
        name: name.value,
        email: email.value,
        telefono: telefono.value || null,
        fecha_nacimiento: fechaNacimiento.value || null,
        sexo: sexo.value || null,
      },
    })
    user.value = response.user
    telefono.value = response.user?.client?.telefono ?? telefono.value
    fechaNacimiento.value = response.user?.client?.fecha_nacimiento ?? fechaNacimiento.value
    sexo.value = response.user?.client?.sexo ?? sexo.value
    message.value = response.message
  } catch (error: unknown) {
    const data = (error as { data?: { message?: string, errors?: Record<string, string[]> } })?.data
    if (data?.errors) {
      fieldErrors.value = data.errors
    }
    errorMessage.value = data?.message ?? 'No se pudo guardar tu perfil. Revisa los campos marcados.'
  } finally {
    saving.value = false
  }
}

async function submitChangePassword() {
  savingPassword.value = true
  passwordMessage.value = ''
  passwordErrorMessage.value = ''
  passwordFieldErrors.value = {}

  try {
    const response = await apiFetch<{ message: string }>('/profile/password', {
      method: 'PUT',
      body: {
        current_password: currentPassword.value,
        password: newPassword.value,
        password_confirmation: newPasswordConfirmation.value,
      },
    })
    passwordMessage.value = response.message
    currentPassword.value = ''
    newPassword.value = ''
    newPasswordConfirmation.value = ''
  } catch (error: unknown) {
    const data = (error as { data?: { message?: string, errors?: Record<string, string[]> } })?.data
    if (data?.errors) {
      passwordFieldErrors.value = data.errors
    }
    passwordErrorMessage.value = data?.message ?? 'No se pudo actualizar la contraseña.'
  } finally {
    savingPassword.value = false
  }
}

// Quien entró con Google no conoce su contraseña (se genera al azar): en una sesión abierta con
// Google se confirma escribiendo ELIMINAR. /auth/me dice cómo se abrió la sesión.
const viaGoogle = ref(false)
async function openDeleteModal() {
  deletePassword.value = ''
  deleteError.value = ''
  showDeleteModal.value = true
  try {
    viaGoogle.value = (await apiFetch<{ sesion_con_google?: boolean }>('/auth/me')).sesion_con_google === true
  } catch {
    viaGoogle.value = false
  }
}

async function submitDeleteAccount() {
  if (!deletePassword.value) {
    deleteError.value = viaGoogle.value
      ? 'Escribe ELIMINAR para confirmar.'
      : 'Ingresa tu contraseña para confirmar la eliminación.'
    return
  }

  deleting.value = true
  deleteError.value = ''

  try {
    await apiFetch('/profile', {
      method: 'DELETE',
      body: viaGoogle.value ? { confirmacion: deletePassword.value.trim() } : { password: deletePassword.value },
    })
    await logout()
    await navigateTo('/login', { replace: true })
  } catch (error: unknown) {
    const data = (error as { data?: { message?: string } })?.data
    deleteError.value = data?.message ?? (viaGoogle.value ? 'No se pudo eliminar tu cuenta.' : 'No se pudo eliminar tu cuenta. Verifica tu contraseña.')
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-4xl space-y-5 p-4 sm:p-6 lg:p-8">
    <header class="relative overflow-hidden rounded-3xl border border-line bg-card p-5 shadow-[0_20px_60px_rgba(0,0,0,0.12)] sm:p-7">
      <div class="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-gold/10 blur-3xl" />
      <div class="relative flex flex-col gap-5 sm:flex-row sm:items-center">
        <div class="shrink-0">
          <img
            v-if="avatarPreview || user?.avatar_url"
            :src="avatarPreview || user?.avatar_url || ''"
            :alt="`Foto de ${name}`"
            class="h-20 w-20 rounded-2xl border-2 border-gold/35 object-cover shadow-xl shadow-black/20"
          >
          <div v-else class="flex h-20 w-20 items-center justify-center rounded-2xl bg-gold/15 text-xl font-black text-gold">
            {{ name.slice(0, 2).toUpperCase() }}
          </div>
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-xs font-black uppercase tracking-[0.2em] text-gold">Cuenta</p>
          <h1 class="mt-2 text-3xl font-black tracking-tight text-ink">{{ name || 'Mi perfil' }}</h1>
          <p class="mt-1 truncate text-sm text-muted">{{ email }}</p>
          <div class="mt-3 flex flex-wrap gap-2">
            <span v-for="role in (user?.roles ?? [])" :key="role" class="rounded-full border border-gold/25 bg-gold/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-gold">{{ role }}</span>
            <span class="rounded-full border border-line bg-main/60 px-2.5 py-1 text-[10px] font-bold text-muted">{{ profileComplete ? 'Perfil completo' : 'Perfil por completar' }}</span>
          </div>
          <div class="mt-4 flex flex-wrap gap-2">
            <label class="ui-btn-secondary cursor-pointer px-3 py-2 text-xs">
              Cambiar foto
              <input type="file" accept="image/jpeg,image/png,image/webp" class="sr-only" @change="selectAvatar">
            </label>
            <button v-if="selectedAvatar" type="button" class="ui-btn px-3 py-2 text-xs" :disabled="uploading" @click="uploadAvatar">
              {{ uploading ? 'Subiendo…' : 'Guardar foto' }}
            </button>
          </div>
        </div>
      </div>
      <div class="relative mt-6 max-w-xl">
        <div class="mb-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-muted">
          <span>Completitud del perfil</span>
          <span class="text-gold">{{ profileComplete ? '100' : Math.max(25, 100 - profileMissing.length * 20) }}%</span>
        </div>
        <div class="h-1.5 overflow-hidden rounded-full bg-main">
          <div class="h-full rounded-full bg-gold transition-[width] duration-200" :style="{ width: `${profileComplete ? 100 : Math.max(25, 100 - profileMissing.length * 20)}%` }" />
        </div>
        <p v-if="profileMissing.length" class="mt-2 text-xs text-muted">Completa: {{ profileMissing.join(', ') }}</p>
      </div>
    </header>

    <nav class="profile-tabs" aria-label="Secciones del perfil">
      <button
        v-if="isBarber"
        type="button"
        :class="['profile-tab', activeSection === 'public' ? 'is-active' : '']"
        :aria-selected="activeSection === 'public'"
        @click="activeSection = 'public'"
      >
        <span class="profile-tab__icon">✦</span>
        <span><strong>Perfil público</strong><small>Tu ficha de barbero</small></span>
      </button>
      <button
        type="button"
        :class="['profile-tab', activeSection === 'personal' ? 'is-active' : '']"
        :aria-selected="activeSection === 'personal'"
        @click="activeSection = 'personal'"
      >
        <span class="profile-tab__icon">◎</span>
        <span><strong>Información</strong><small>Datos de tu cuenta</small></span>
      </button>
      <button
        type="button"
        :class="['profile-tab', activeSection === 'security' ? 'is-active' : '']"
        :aria-selected="activeSection === 'security'"
        @click="activeSection = 'security'"
      >
        <span class="profile-tab__icon">⌁</span>
        <span><strong>Seguridad</strong><small>Contraseña y acceso</small></span>
      </button>
      <button
        type="button"
        :class="['profile-tab profile-tab--danger', activeSection === 'danger' ? 'is-active' : '']"
        :aria-selected="activeSection === 'danger'"
        @click="activeSection = 'danger'"
      >
        <span class="profile-tab__icon">!</span>
        <span><strong>Cuenta</strong><small>Zona de peligro</small></span>
      </button>
    </nav>

    <div v-if="loading" class="flex items-center gap-3 py-12 text-sm text-muted">
      <div class="h-5 w-5 animate-spin rounded-full border-2 border-gold border-t-transparent" />
      <span>Cargando perfil…</span>
    </div>

    <template v-else>
      <form v-if="activeSection === 'public' && isBarber && barberProfile" class="profile-panel ui-card space-y-5 p-5 sm:p-7" @submit.prevent="submitBarberProfile">
        <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p class="text-xs font-black uppercase tracking-[0.18em] text-gold">Perfil público</p>
            <h2 class="mt-2 text-lg font-black text-ink">Así te conocen tus clientes</h2>
            <p class="mt-1 text-sm text-muted">Esta información aparece en tu ficha pública y ayuda a elegirte para una reserva.</p>
          </div>
          <div class="flex gap-3 text-right text-xs text-muted">
            <span><strong class="block text-lg text-ink">{{ barberProfile.portfolio_total }}</strong>trabajos</span>
            <span><strong class="block text-lg text-ink">{{ barberProfile.total_resenas }}</strong>reseñas</span>
          </div>
        </div>
        <div class="grid gap-5 sm:grid-cols-2">
          <div class="sm:col-span-2">
            <label class="mb-2 block text-sm font-bold text-ink">Foto pública del barbero</label>
            <div class="flex flex-wrap items-center gap-3">
              <img v-if="barberPhotoPreview || barberProfile.foto_url" :src="barberPhotoPreview || barberProfile.foto_url || ''" :alt="`Foto pública de ${name}`" class="h-16 w-16 rounded-xl border border-line object-cover">
              <label class="ui-btn-secondary cursor-pointer px-3 py-2 text-xs">
                Elegir imagen
                <input type="file" accept="image/jpeg,image/png,image/webp" class="sr-only" @change="(event) => { const file = (event.target as HTMLInputElement).files?.[0] ?? null; if (file && file.size <= 4 * 1024 * 1024) { barberPhoto = file; barberPhotoPreview = URL.createObjectURL(file) } }">
              </label>
              <span class="text-xs text-muted">JPG, PNG o WebP · máximo 4 MB</span>
            </div>
            <p v-if="barberFieldErrors.foto" class="mt-1 text-xs text-red-400">{{ barberFieldErrors.foto[0] }}</p>
          </div>
          <div class="sm:col-span-2">
            <label for="barber-specialties" class="mb-1 block text-sm font-bold text-ink">Especialidades</label>
            <input
              id="barber-specialties"
              v-model="barberSpecialties"
              maxlength="1000"
              placeholder="Ej. Degradados, diseños y barba clásica"
              :class="['ui-input w-full', barberFieldErrors.especialidades ? 'border-red-500/60' : '']"
            >
            <p class="mt-1 text-xs text-muted">Sepáralas por comas para que se muestren como etiquetas.</p>
            <p v-if="barberFieldErrors.especialidades" class="mt-1 text-xs text-red-400">{{ barberFieldErrors.especialidades[0] }}</p>
          </div>
          <div class="sm:col-span-2">
            <label for="barber-description" class="mb-1 block text-sm font-bold text-ink">Presentación</label>
            <textarea
              id="barber-description"
              v-model="barberDescription"
              rows="4"
              maxlength="1000"
              placeholder="Cuéntales brevemente tu experiencia y el estilo de trabajo que te distingue."
              :class="['ui-input w-full resize-y', barberFieldErrors.descripcion ? 'border-red-500/60' : '']"
            />
            <div class="mt-1 flex justify-between gap-3 text-xs text-muted">
              <span v-if="barberFieldErrors.descripcion" class="text-red-400">{{ barberFieldErrors.descripcion[0] }}</span>
              <span class="ml-auto">{{ barberDescription.length }}/1000</span>
            </div>
          </div>
        </div>
        <p v-if="barberMessage" role="status" class="text-sm font-medium text-emerald-400">{{ barberMessage }}</p>
        <p v-if="barberError" role="alert" class="text-sm font-medium text-red-400">{{ barberError }}</p>
        <div class="flex flex-col-reverse gap-3 border-t border-line pt-4 sm:flex-row sm:justify-end">
          <NuxtLink to="/equipo" class="ui-btn-secondary justify-center px-4 py-2.5 text-sm">Ver perfil público</NuxtLink>
          <button type="submit" :disabled="barberSaving" class="ui-btn justify-center px-5 py-2.5 text-sm disabled:opacity-50">{{ barberSaving ? 'Publicando…' : 'Guardar presentación' }}</button>
        </div>
      </form>

      <!-- 2. Datos personales -->
      <form v-if="activeSection === 'personal'" class="profile-panel ui-card space-y-5 p-5 sm:p-7" @submit.prevent="submitProfile">
        <div>
          <p class="text-xs font-black uppercase tracking-[0.18em] text-gold">Información de cuenta</p>
          <h2 class="mt-2 text-xl font-black text-ink">Tu identidad en UrbanBlade</h2>
          <p class="mt-1 text-sm text-muted">Mantén tus datos actualizados para que tus reservas y comunicaciones sean correctas.</p>
        </div>
        <div>
          <label for="profile-name" class="mb-1 block text-sm font-medium text-muted">Nombre completo</label>
          <input
            id="profile-name"
            v-model="name"
            required
            maxlength="255"
            :aria-invalid="!!fieldErrors.name"
            :aria-describedby="fieldErrors.name ? 'profile-name-error' : undefined"
            :class="['ui-input w-full', fieldErrors.name ? 'border-red-500/60 focus:border-red-500' : '']"
          >
          <p v-if="fieldErrors.name" id="profile-name-error" class="mt-1 text-xs text-red-400">{{ fieldErrors.name[0] }}</p>
        </div>

        <div>
          <label for="profile-email" class="mb-1 block text-sm font-medium text-muted">Correo electrónico</label>
          <input
            id="profile-email"
            v-model="email"
            type="email"
            required
            maxlength="255"
            :aria-invalid="!!fieldErrors.email"
            :aria-describedby="fieldErrors.email ? 'profile-email-error' : undefined"
            :class="['ui-input w-full', fieldErrors.email ? 'border-red-500/60 focus:border-red-500' : '']"
          >
          <p v-if="fieldErrors.email" id="profile-email-error" class="mt-1 text-xs text-red-400">{{ fieldErrors.email[0] }}</p>
        </div>

        <div v-if="isClient" class="grid gap-4 sm:grid-cols-3">
          <div>
            <label for="profile-phone" class="mb-1 block text-sm font-medium text-muted">Teléfono</label>
            <input
              id="profile-phone"
              v-model="telefono"
              type="tel"
              maxlength="30"
              placeholder="Ej. +52 55 1234 5678"
              autocomplete="tel"
              :aria-invalid="!!fieldErrors.telefono"
              :aria-describedby="fieldErrors.telefono ? 'profile-phone-error' : undefined"
              :class="['ui-input w-full', fieldErrors.telefono ? 'border-red-500/60 focus:border-red-500' : '']"
            >
            <p v-if="fieldErrors.telefono" id="profile-phone-error" class="mt-1 text-xs text-red-400">{{ fieldErrors.telefono[0] }}</p>
          </div>
          <div>
            <label for="profile-birthday" class="mb-1 block text-sm font-medium text-muted">Fecha de nacimiento</label>
            <input
              id="profile-birthday"
              v-model="fechaNacimiento"
              type="date"
              autocomplete="bday"
              :aria-invalid="!!fieldErrors.fecha_nacimiento"
              :aria-describedby="fieldErrors.fecha_nacimiento ? 'profile-birthday-error' : undefined"
              :class="['ui-input w-full', fieldErrors.fecha_nacimiento ? 'border-red-500/60 focus:border-red-500' : '']"
            >
            <p v-if="fieldErrors.fecha_nacimiento" id="profile-birthday-error" class="mt-1 text-xs text-red-400">{{ fieldErrors.fecha_nacimiento[0] }}</p>
          </div>
          <div>
            <label for="profile-sex" class="mb-1 block text-sm font-medium text-muted">Sexo (opcional)</label>
            <select
              id="profile-sex"
              v-model="sexo"
              :aria-invalid="!!fieldErrors.sexo"
              :aria-describedby="fieldErrors.sexo ? 'profile-sex-error' : undefined"
              :class="['ui-input w-full', fieldErrors.sexo ? 'border-red-500/60 focus:border-red-500' : '']"
            >
              <option value="">Sin especificar</option>
              <option value="masculino">Masculino</option>
              <option value="femenino">Femenino</option>
              <option value="prefiero_no_decir">Prefiero no decirlo</option>
            </select>
            <p v-if="fieldErrors.sexo" id="profile-sex-error" class="mt-1 text-xs text-red-400">{{ fieldErrors.sexo[0] }}</p>
          </div>
        </div>

        <p v-else class="rounded-lg border border-line bg-main/40 p-3 text-xs text-muted">
          Teléfono, fecha de nacimiento y sexo pertenecen al perfil de cliente. Tu rol actual conserva aquí únicamente nombre y correo.
        </p>

        <p v-if="message" role="status" class="text-sm font-medium text-emerald-400">{{ message }}</p>
        <p v-if="errorMessage" role="alert" class="text-sm font-medium text-red-400">{{ errorMessage }}</p>

        <button
          type="submit"
          :disabled="saving"
          class="ui-btn px-5 py-2.5 text-sm disabled:opacity-50"
        >
          {{ saving ? 'Guardando cambios…' : 'Guardar cambios' }}
        </button>
      </form>

      <!-- 3. Seguridad: Actualizar Contraseña -->
      <form v-if="activeSection === 'security'" class="profile-panel ui-card space-y-5 p-5 sm:p-7" @submit.prevent="submitChangePassword">
        <div>
          <h2 class="text-lg font-bold text-ink">Seguridad y contraseña</h2>
          <p class="text-sm text-muted">Cambia tu contraseña para mantener tu cuenta protegida.</p>
        </div>

        <div>
          <label for="current-password" class="mb-1 block text-sm font-medium text-muted">Contraseña actual</label>
          <input
            id="current-password"
            v-model="currentPassword"
            type="password"
            required
            autocomplete="current-password"
            :class="['ui-input w-full', passwordFieldErrors.current_password ? 'border-red-500/60 focus:border-red-500' : '']"
          >
          <p v-if="passwordFieldErrors.current_password" class="mt-1 text-xs text-red-400">{{ passwordFieldErrors.current_password[0] }}</p>
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <div>
            <label for="new-password" class="mb-1 block text-sm font-medium text-muted">Nueva contraseña</label>
            <input
              id="new-password"
              v-model="newPassword"
              type="password"
              required
              minlength="8"
              autocomplete="new-password"
              :class="['ui-input w-full', passwordFieldErrors.password ? 'border-red-500/60 focus:border-red-500' : '']"
            >
            <p v-if="passwordFieldErrors.password" class="mt-1 text-xs text-red-400">{{ passwordFieldErrors.password[0] }}</p>
          </div>
          <div>
            <label for="new-password-confirmation" class="mb-1 block text-sm font-medium text-muted">Confirmar nueva contraseña</label>
            <input
              id="new-password-confirmation"
              v-model="newPasswordConfirmation"
              type="password"
              required
              minlength="8"
              autocomplete="new-password"
              :class="['ui-input w-full', passwordFieldErrors.password_confirmation ? 'border-red-500/60 focus:border-red-500' : '']"
            >
            <p v-if="passwordFieldErrors.password_confirmation" class="mt-1 text-xs text-red-400">{{ passwordFieldErrors.password_confirmation[0] }}</p>
          </div>
        </div>

        <p v-if="passwordMessage" class="text-sm font-medium text-emerald-400">{{ passwordMessage }}</p>
        <p v-if="passwordErrorMessage" class="text-sm font-medium text-red-400">{{ passwordErrorMessage }}</p>

        <button
          type="submit"
          :disabled="savingPassword"
          class="rounded-lg bg-gold px-5 py-2.5 text-sm font-semibold text-black hover:bg-gold-dim disabled:opacity-50"
        >
          {{ savingPassword ? 'Actualizando…' : 'Actualizar contraseña' }}
        </button>
      </form>

      <!-- 4. Zona de peligro: Eliminar Cuenta -->
      <section v-if="activeSection === 'danger'" class="profile-panel rounded-2xl border border-red-500/25 bg-red-500/5 p-5 sm:p-7">
        <h2 class="text-lg font-bold text-red-400">Zona de peligro</h2>
        <p class="mt-1 text-sm text-muted">
          Al eliminar tu cuenta se revocarán todos tus accesos y tu perfil quedará deshabilitado permanentemente.
        </p>

        <div v-if="isAdministrator" class="mt-4 rounded-lg border border-amber-500/25 bg-amber-500/10 p-3 text-xs text-amber-300">
          Como administrador, no puedes eliminar tu propia cuenta desde el perfil. Debe realizarse desde la gestión global de usuarios.
        </div>
        <div v-else class="mt-4">
          <button
            type="button"
            class="rounded-lg border border-red-500/30 px-4 py-2 text-sm font-semibold text-red-400 hover:bg-red-500/10"
            @click="openDeleteModal"
          >
            Eliminar mi cuenta
          </button>
        </div>
      </section>

      <!-- Modal de confirmación para eliminar cuenta -->
      <UiModal
        v-if="showDeleteModal"
        title="Confirmar eliminación de cuenta"
        :busy="deleting"
        @close="showDeleteModal = false"
      >
          <h3 class="text-lg font-bold text-red-400">¿Estás seguro de eliminar tu cuenta?</h3>
          <p class="mt-2 text-sm text-muted">
            <template v-if="viaGoogle">
              Esta acción es irreversible. Entraste con Google, así que para confirmar escribe <strong class="text-ink">ELIMINAR</strong>.
            </template>
            <template v-else>
              Esta acción es irreversible. Para confirmar tu identidad, escribe tu contraseña actual.
            </template>
          </p>
          <p class="mt-2 text-xs text-muted">
            Se borran tu acceso y tus sesiones. El historial de citas y pagos puede conservarse como registro del
            negocio; si quieres que también se borre, pídelo por correo (ver Aviso de Privacidad).
          </p>

          <form class="mt-4 space-y-4" @submit.prevent="submitDeleteAccount">
            <div>
              <label for="delete-account-password" class="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">{{ viaGoogle ? 'Escribe ELIMINAR' : 'Tu contraseña' }}</label>
              <input
                id="delete-account-password"
                v-model="deletePassword"
                :type="viaGoogle ? 'text' : 'password'"
                required
                autocomplete="off"
                :placeholder="viaGoogle ? 'ELIMINAR' : 'Ingresa tu contraseña'"
                class="w-full rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink focus:border-red-500 focus:outline-none focus:shadow-[0_0_0_3px_rgba(239,68,68,0.15)]"
              >
            </div>

            <p v-if="deleteError" class="text-xs text-red-400">{{ deleteError }}</p>

            <div class="flex justify-end gap-3 pt-2">
              <button
                type="button"
                class="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-muted hover:text-ink"
                @click="showDeleteModal = false"
              >
                Cancelar
              </button>
              <button
                type="submit"
                :disabled="deleting"
                class="rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50"
              >
                {{ deleting ? 'Eliminando…' : 'Sí, eliminar cuenta' }}
              </button>
            </div>
          </form>
      </UiModal>
    </template>
  </div>
</template>
