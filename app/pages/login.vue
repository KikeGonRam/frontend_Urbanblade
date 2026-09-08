<script setup lang="ts">
definePageMeta({ middleware: 'guest', pageTransition: { name: 'auth', mode: 'out-in' } })

const email = ref('')
const password = ref('')
const errorMessage = ref('')
const loading = ref(false)

const route = useRoute()
const config = useRuntimeConfig()
const { login } = useAuth()
const { secondsLeft, handle: handleRateLimit } = useRetryCountdown()

const googleLoginUrl = computed(() => `${config.public.apiBase}/auth/google/redirect`)

if (route.query.error === 'google_failed') {
  errorMessage.value = 'No se pudo completar el acceso con Google. Intenta de nuevo.'
}

async function onSubmit() {
  errorMessage.value = ''
  loading.value = true

  try {
    const user = await login(email.value, password.value)

    // Mismo criterio que el callback de Google (pages/auth/callback.vue): un
    // cliente sin teléfono/fecha de nacimiento va primero a completar su
    // perfil. Antes solo el camino de Google lo respetaba, así que quien se
    // registraba por correo (que nunca pide esos dos datos) entraba al
    // dashboard con el perfil incompleto y nada volvía a pedírselo.
    if (!user.profile_complete) {
      await navigateTo('/complete-profile')

      return
    }

    const redirect = getSafeRedirectUrl(route.query.redirect, '/dashboard')
    await navigateTo(redirect)
  } catch (error: unknown) {
    if (handleRateLimit(error)) return

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

    <a
      :href="googleLoginUrl"
      class="mb-5 flex w-full items-center justify-center gap-2 rounded-lg border border-line bg-main px-4 py-2 text-sm font-semibold text-ink transition-all duration-200 hover:border-gold/40 hover:bg-card"
    >
      <svg class="h-4 w-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" /><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0012 23z" /><path fill="#FBBC05" d="M5.84 14.09A6.6 6.6 0 015.5 12c0-.73.13-1.43.34-2.09V7.07H2.18A11 11 0 001 12c0 1.77.43 3.45 1.18 4.93l3.66-2.84z" /><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1a11 11 0 00-9.82 6.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" /></svg>
      Continuar con Google
    </a>

    <div class="mb-5 flex items-center gap-3">
      <span class="h-px flex-1 bg-line" /><span class="text-[10px] font-bold uppercase tracking-widest text-muted">o con tu correo</span><span class="h-px flex-1 bg-line" />
    </div>

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

      <p v-if="secondsLeft > 0" class="text-sm text-amber-400">Demasiados intentos. Espera {{ secondsLeft }}s para volver a intentar.</p>
      <p v-else-if="errorMessage" class="text-sm text-red-400">{{ errorMessage }}</p>

      <button
        type="submit" :disabled="loading || secondsLeft > 0"
        class="w-full rounded-lg bg-gold px-4 py-2 font-semibold text-black transition-all duration-200 hover:scale-[1.02] hover:bg-gold-dim hover:shadow-lg hover:shadow-gold/20 active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100"
      >
        {{ secondsLeft > 0 ? `Espera ${secondsLeft}s…` : loading ? 'Ingresando…' : 'Ingresar' }}
      </button>

      <p class="pt-2 text-center text-[10px] font-bold uppercase tracking-widest text-muted">
        ¿Aún no tienes cuenta? <NuxtLink to="/register" class="text-gold hover:underline">Regístrate ahora</NuxtLink>
      </p>
    </form>
  </AuthShell>
</template>
