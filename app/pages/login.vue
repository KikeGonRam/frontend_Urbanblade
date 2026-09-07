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
  <AuthShell mascot="nava-panther.png" mascot-name="Nava">
    <h1 class="mb-1 text-center text-lg font-black uppercase tracking-widest text-white">
      Bienvenido <span class="font-serif text-base italic normal-case text-gold">de nuevo</span>
    </h1>
    <p class="mb-6 text-center text-[10px] font-bold uppercase tracking-widest text-muted">Introduce tus credenciales para continuar</p>

    <form class="space-y-4" @submit.prevent="onSubmit">
      <div>
        <label for="email" class="mb-1 block text-sm text-muted">Correo</label>
        <input
          id="email" v-model="email" type="email" required autofocus autocomplete="username" placeholder="tu@email.com"
          class="w-full rounded-lg border border-line bg-main px-3 py-2 text-ink transition-all duration-200 focus:border-gold focus:shadow-[0_0_0_3px_rgba(212,175,55,0.15)] focus:outline-none"
        >
      </div>

      <div>
        <div class="mb-1 flex items-center justify-between">
          <label for="password" class="block text-sm text-muted">Contraseña</label>
          <NuxtLink to="/forgot-password" class="text-[10px] font-bold uppercase tracking-widest text-muted hover:text-gold">¿Olvidaste tu contraseña?</NuxtLink>
        </div>
        <AuthPasswordField id="password" v-model="password" autocomplete="current-password" placeholder="••••••••" />
      </div>

      <p v-if="errorMessage" class="text-sm text-red-400">{{ errorMessage }}</p>

      <button
        type="submit" :disabled="loading"
        class="w-full rounded-lg bg-gold px-4 py-2 font-semibold text-black transition-all duration-200 hover:scale-[1.02] hover:bg-gold-dim hover:shadow-lg hover:shadow-gold/20 active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100"
      >
        {{ loading ? 'Ingresando…' : 'Ingresar' }}
      </button>

      <p class="pt-2 text-center text-[10px] font-bold uppercase tracking-widest text-muted">
        ¿Aún no tienes cuenta? <NuxtLink to="/register" class="text-gold hover:underline">Regístrate ahora</NuxtLink>
      </p>
    </form>
  </AuthShell>
</template>
