<script setup lang="ts">
definePageMeta({ middleware: 'auth', layout: 'dashboard' })

interface ProfileResponse {
  user: {
    name: string
    email: string
    avatar_url: string | null
    roles: string[]
    client: { telefono: string | null, fecha_nacimiento: string | null, sexo: string | null } | null
  }
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

onMounted(async () => {
  try {
    const response = await apiFetch<ProfileResponse>('/profile')
    name.value = response.user.name
    email.value = response.user.email
    telefono.value = response.user.client?.telefono ?? ''
    fechaNacimiento.value = response.user.client?.fecha_nacimiento ?? ''
    sexo.value = response.user.client?.sexo ?? ''
  } catch {
    errorMessage.value = 'No se pudo cargar tu perfil.'
  } finally {
    loading.value = false
  }
})

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

async function submitDeleteAccount() {
  if (!deletePassword.value) {
    deleteError.value = 'Ingresa tu contraseña para confirmar la eliminación.'
    return
  }

  deleting.value = true
  deleteError.value = ''

  try {
    await apiFetch('/profile', {
      method: 'DELETE',
      body: { password: deletePassword.value },
    })
    await logout()
    await navigateTo('/login', { replace: true })
  } catch (error: unknown) {
    const data = (error as { data?: { message?: string } })?.data
    deleteError.value = data?.message ?? 'No se pudo eliminar tu cuenta. Verifica tu contraseña.'
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-3xl space-y-8 p-4 sm:p-6 lg:p-8">
    <header>
      <p class="text-xs font-black uppercase tracking-[0.2em] text-gold">Cuenta</p>
      <h1 class="mt-2 text-3xl font-black text-ink">Mi perfil</h1>
      <p class="mt-2 text-sm text-muted">Administra tus datos personales, foto y credenciales de acceso.</p>
    </header>

    <div v-if="loading" class="flex items-center gap-3 py-12 text-sm text-muted">
      <div class="h-5 w-5 animate-spin rounded-full border-2 border-gold border-t-transparent" />
      <span>Cargando perfil…</span>
    </div>

    <template v-else>
      <!-- 1. Foto de perfil -->
      <section class="ui-card flex flex-col gap-5 p-6 sm:flex-row sm:items-center">
        <img
          v-if="avatarPreview || user?.avatar_url"
          :src="avatarPreview || user?.avatar_url || ''"
          :alt="`Foto de ${name}`"
          class="h-24 w-24 rounded-full border border-line object-cover"
        >
        <div v-else class="flex h-24 w-24 items-center justify-center rounded-full bg-gold/15 text-xl font-black text-gold">
          {{ name.slice(0, 2).toUpperCase() }}
        </div>
        <div class="space-y-3">
          <div>
            <h2 class="font-black text-ink">Foto de perfil</h2>
            <p class="text-sm text-muted">JPG, PNG o WebP, máximo 4 MB.</p>
          </div>
          <div class="flex flex-wrap gap-3">
            <label class="cursor-pointer rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink hover:border-gold">
              Elegir foto
              <input type="file" accept="image/jpeg,image/png,image/webp" class="sr-only" @change="selectAvatar">
            </label>
            <button
              type="button"
              :disabled="!selectedAvatar || uploading"
              class="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-black hover:bg-gold-dim disabled:opacity-50"
              @click="uploadAvatar"
            >
              {{ uploading ? 'Subiendo…' : 'Guardar foto' }}
            </button>
          </div>
        </div>
      </section>

      <!-- 2. Datos personales -->
      <form class="ui-card space-y-4 p-6" @submit.prevent="submitProfile">
        <h2 class="text-lg font-bold text-ink">Información personal</h2>
        <div>
          <label for="profile-name" class="mb-1 block text-sm font-medium text-muted">Nombre completo</label>
          <input
            id="profile-name"
            v-model="name"
            required
            maxlength="255"
            :aria-invalid="!!fieldErrors.name"
            :aria-describedby="fieldErrors.name ? 'profile-name-error' : undefined"
            :class="['w-full rounded-lg border bg-main px-3 py-2 text-ink focus:outline-hidden', fieldErrors.name ? 'border-red-500/60 focus:border-red-500' : 'border-line focus:border-gold']"
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
            :class="['w-full rounded-lg border bg-main px-3 py-2 text-ink focus:outline-hidden', fieldErrors.email ? 'border-red-500/60 focus:border-red-500' : 'border-line focus:border-gold']"
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
              :class="['w-full rounded-lg border bg-main px-3 py-2 text-ink focus:outline-hidden', fieldErrors.telefono ? 'border-red-500/60 focus:border-red-500' : 'border-line focus:border-gold']"
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
              :class="['w-full rounded-lg border bg-main px-3 py-2 text-ink focus:outline-hidden', fieldErrors.fecha_nacimiento ? 'border-red-500/60 focus:border-red-500' : 'border-line focus:border-gold']"
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
              :class="['w-full rounded-lg border bg-main px-3 py-2 text-ink focus:outline-hidden', fieldErrors.sexo ? 'border-red-500/60 focus:border-red-500' : 'border-line focus:border-gold']"
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
          class="rounded-lg bg-gold px-5 py-2.5 text-sm font-semibold text-black hover:bg-gold-dim disabled:opacity-50"
        >
          {{ saving ? 'Guardando cambios…' : 'Guardar cambios' }}
        </button>
      </form>

      <!-- 3. Seguridad: Actualizar Contraseña -->
      <form class="ui-card space-y-4 p-6" @submit.prevent="submitChangePassword">
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
            :class="['w-full rounded-lg border bg-main px-3 py-2 text-ink focus:outline-hidden', passwordFieldErrors.current_password ? 'border-red-500/60 focus:border-red-500' : 'border-line focus:border-gold']"
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
              :class="['w-full rounded-lg border bg-main px-3 py-2 text-ink focus:outline-hidden', passwordFieldErrors.password ? 'border-red-500/60 focus:border-red-500' : 'border-line focus:border-gold']"
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
              :class="['w-full rounded-lg border bg-main px-3 py-2 text-ink focus:outline-hidden', passwordFieldErrors.password_confirmation ? 'border-red-500/60 focus:border-red-500' : 'border-line focus:border-gold']"
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
      <section class="rounded-2xl border border-red-500/25 bg-red-500/5 p-6">
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
            @click="showDeleteModal = true"
          >
            Eliminar mi cuenta
          </button>
        </div>
      </section>

      <!-- Modal de confirmación para eliminar cuenta -->
      <div
        v-if="showDeleteModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs"
        role="dialog"
        aria-modal="true"
        aria-label="Confirmar eliminación de cuenta"
        @click.self="showDeleteModal = false"
      >
        <div class="w-full max-w-md rounded-2xl border border-line bg-card p-6 shadow-2xl">
          <h3 class="text-lg font-bold text-red-400">¿Estás seguro de eliminar tu cuenta?</h3>
          <p class="mt-2 text-sm text-muted">
            Esta acción es irreversible. Para confirmar tu identidad, escribe tu contraseña actual.
          </p>

          <form class="mt-4 space-y-4" @submit.prevent="submitDeleteAccount">
            <div>
              <label for="delete-account-password" class="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">Tu contraseña</label>
              <input
                id="delete-account-password"
                v-model="deletePassword"
                type="password"
                required
                placeholder="Ingresa tu contraseña"
                class="w-full rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink focus:border-red-500 focus:outline-hidden"
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
        </div>
      </div>
    </template>
  </div>
</template>
