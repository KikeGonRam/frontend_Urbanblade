<script setup lang="ts">
definePageMeta({ middleware: 'auth', layout: 'dashboard' })

interface ProfileResponse {
  user: {
    name: string
    email: string
    avatar_url: string | null
    client: { telefono: string | null, fecha_nacimiento: string | null } | null
  }
}

interface UpdateResponse {
  message: string
  user: ReturnType<typeof useAuth>['user']['value']
}

const { apiFetch } = useApi()
const { user } = useAuth()
const name = ref('')
const email = ref('')
const telefono = ref('')
const fechaNacimiento = ref('')
const selectedAvatar = ref<File | null>(null)
const avatarPreview = ref<string | null>(null)
const loading = ref(true)
const saving = ref(false)
const uploading = ref(false)
const message = ref('')
const errorMessage = ref('')

onMounted(async () => {
  try {
    const response = await apiFetch<ProfileResponse>('/profile')
    name.value = response.user.name
    email.value = response.user.email
    telefono.value = response.user.client?.telefono ?? ''
    fechaNacimiento.value = response.user.client?.fecha_nacimiento ?? ''
  } catch {
    errorMessage.value = 'No se pudo cargar tu perfil.'
  } finally {
    loading.value = false
  }
})

function selectAvatar(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0] ?? null
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
    message.value = 'Foto actualizada.'
  } catch (error: unknown) {
    errorMessage.value = (error as { data?: { message?: string } })?.data?.message ?? 'No se pudo actualizar la foto.'
  } finally {
    uploading.value = false
  }
}

async function submit() {
  saving.value = true
  message.value = ''
  errorMessage.value = ''
  try {
    const response = await apiFetch<UpdateResponse>('/profile', {
      method: 'PUT',
      body: {
        name: name.value,
        email: email.value,
        telefono: telefono.value || null,
        fecha_nacimiento: fechaNacimiento.value || null,
      },
    })
    user.value = response.user
    message.value = response.message
  } catch (error: unknown) {
    errorMessage.value = (error as { data?: { message?: string } })?.data?.message ?? 'No se pudo guardar tu perfil.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-3xl space-y-6 p-4 sm:p-6 lg:p-8">
    <header>
      <p class="text-xs font-black uppercase tracking-[0.2em] text-gold">Cuenta</p>
      <h1 class="mt-2 text-3xl font-black text-ink">Mi perfil</h1>
      <p class="mt-2 text-sm text-muted">Administra tus datos personales y tu foto.</p>
    </header>

    <p v-if="loading" class="text-sm text-muted">Cargando perfil…</p>
    <template v-else>
      <section class="ui-card flex flex-col gap-5 p-6 sm:flex-row sm:items-center">
        <img v-if="avatarPreview || user?.avatar_url" :src="avatarPreview || user?.avatar_url || ''" :alt="`Foto de ${name}`" class="h-24 w-24 rounded-full border border-line object-cover">
        <div v-else class="flex h-24 w-24 items-center justify-center rounded-full bg-gold/15 text-xl font-black text-gold">{{ name.slice(0, 2).toUpperCase() }}</div>
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
            <button type="button" :disabled="!selectedAvatar || uploading" class="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-black disabled:opacity-50" @click="uploadAvatar">{{ uploading ? 'Subiendo…' : 'Guardar foto' }}</button>
          </div>
        </div>
      </section>

      <form class="ui-card space-y-4 p-6" @submit.prevent="submit">
        <div>
          <label for="profile-name" class="mb-1 block text-sm text-muted">Nombre</label>
          <input id="profile-name" v-model="name" required maxlength="255" class="w-full rounded-lg border border-line bg-main px-3 py-2 text-ink focus:border-gold focus:outline-none">
        </div>
        <div>
          <label for="profile-email" class="mb-1 block text-sm text-muted">Correo</label>
          <input id="profile-email" v-model="email" type="email" required maxlength="255" class="w-full rounded-lg border border-line bg-main px-3 py-2 text-ink focus:border-gold focus:outline-none">
        </div>
        <div class="grid gap-4 sm:grid-cols-2">
          <div>
            <label for="profile-phone" class="mb-1 block text-sm text-muted">Teléfono</label>
            <input id="profile-phone" v-model="telefono" type="tel" maxlength="30" class="w-full rounded-lg border border-line bg-main px-3 py-2 text-ink focus:border-gold focus:outline-none">
          </div>
          <div>
            <label for="profile-birthday" class="mb-1 block text-sm text-muted">Fecha de nacimiento</label>
            <input id="profile-birthday" v-model="fechaNacimiento" type="date" class="w-full rounded-lg border border-line bg-main px-3 py-2 text-ink focus:border-gold focus:outline-none">
          </div>
        </div>
        <p v-if="message" class="text-sm text-emerald-400">{{ message }}</p>
        <p v-if="errorMessage" class="text-sm text-red-400">{{ errorMessage }}</p>
        <button type="submit" :disabled="saving" class="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-black disabled:opacity-50">{{ saving ? 'Guardando…' : 'Guardar cambios' }}</button>
      </form>
    </template>
  </div>
</template>
