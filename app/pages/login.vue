<script setup lang="ts">
definePageMeta({ middleware: 'guest' })

const email = ref('')
const password = ref('')
const errorMessage = ref('')
const loading = ref(false)

const route = useRoute()
const { login } = useAuth()

async function onSubmit() {
  errorMessage.value = ''
  loading.value = true

  try {
    await login(email.value, password.value)
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/dashboard'
    await navigateTo(redirect)
  } catch (error: unknown) {
    const status = (error as { response?: { status?: number } })?.response?.status
    if (status === 422) {
      errorMessage.value = 'Las credenciales no son válidas.'
    } else if (status === 403) {
      errorMessage.value = 'Debes verificar tu correo para iniciar sesión.'
    } else {
      errorMessage.value = 'No se pudo iniciar sesión. Intenta de nuevo.'
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center p-6 font-sans text-ink">
    <div class="w-full max-w-sm rounded-xl border border-line bg-card p-8">
      <p class="text-sm uppercase tracking-widest text-muted">UrbanBlade</p>
      <h1 class="mt-1 font-analytics text-2xl font-semibold text-ink">Iniciar sesión</h1>

      <form class="mt-6 space-y-4" @submit.prevent="onSubmit">
        <div>
          <label for="email" class="mb-1 block text-sm text-muted">Correo</label>
          <input
            id="email"
            v-model="email"
            type="email"
            required
            autocomplete="email"
            class="w-full rounded-lg border border-line bg-main px-3 py-2 text-ink focus:border-gold focus:outline-none"
          >
        </div>

        <div>
          <label for="password" class="mb-1 block text-sm text-muted">Contraseña</label>
          <input
            id="password"
            v-model="password"
            type="password"
            required
            autocomplete="current-password"
            class="w-full rounded-lg border border-line bg-main px-3 py-2 text-ink focus:border-gold focus:outline-none"
          >
        </div>

        <p v-if="errorMessage" class="text-sm text-red-400">
          {{ errorMessage }}
        </p>

        <button
          type="submit"
          :disabled="loading"
          class="w-full rounded-lg bg-gold px-4 py-2 font-semibold text-black transition hover:bg-gold-dim disabled:opacity-50"
        >
          {{ loading ? 'Ingresando…' : 'Ingresar' }}
        </button>
      </form>
    </div>
  </div>
</template>
