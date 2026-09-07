<script setup lang="ts">
definePageMeta({ middleware: 'guest', pageTransition: { name: 'auth', mode: 'out-in' } })

const name = ref('')
const email = ref('')
const password = ref('')
const passwordConfirmation = ref('')
const acceptedTerms = ref(false)
const errorMessage = ref('')
const loading = ref(false)

const config = useRuntimeConfig()
const { register } = useAuth()
const { secondsLeft, handle: handleRateLimit } = useRetryCountdown()

const googleLoginUrl = computed(() => `${config.public.apiBase}/auth/google/redirect`)

// Feedback en vivo de confirmación de contraseña -- solo una vez que ambos
// campos tienen contenido, para no regañar al usuario a mitad de escribir la
// primera contraseña.
const passwordsMatch = computed(() => {
  if (!password.value || !passwordConfirmation.value) return null

  return password.value === passwordConfirmation.value
})

async function onSubmit() {
  errorMessage.value = ''

  if (!acceptedTerms.value) {
    errorMessage.value = 'Debes aceptar los Términos y el Aviso de Privacidad para continuar.'

    return
  }

  if (password.value !== passwordConfirmation.value) {
    errorMessage.value = 'Las contraseñas no coinciden.'

    return
  }

  loading.value = true
  try {
    const user = await register(name.value, email.value, password.value, passwordConfirmation.value)

    // El registro por correo solo pide nombre/correo/contraseña, así que un
    // cliente recién creado SIEMPRE tiene el perfil incompleto (le faltan
    // teléfono y fecha de nacimiento, ver User::profileCompletion() en
    // barber). Mandarlo a completarlo en vez de al dashboard, igual que el
    // callback de Google.
    await navigateTo(user.profile_complete ? '/dashboard' : '/complete-profile')
  } catch (error: unknown) {
    if (handleRateLimit(error)) return

    const data = (error as { data?: { message?: string, errors?: Record<string, string[]> } })?.data
    errorMessage.value = data?.errors ? Object.values(data.errors).flat()[0] ?? data.message ?? '' : data?.message ?? 'No se pudo crear la cuenta. Intenta de nuevo.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthShell mascot="bladebot.png" mascot-name="Bladebot">
    <h1 class="mb-1 text-center text-lg font-black uppercase tracking-widest text-white">
      Únete a la <span class="font-serif text-base italic normal-case text-gold">élite</span>
    </h1>
    <p class="mb-6 text-center text-[10px] font-bold uppercase tracking-widest text-muted">Crea tu cuenta para gestionar tus citas premium</p>

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
        <label for="name" class="mb-1 block text-sm text-muted">Nombre completo</label>
        <input
          id="name" v-model="name" type="text" required autofocus autocomplete="name" placeholder="Ej: Juan Pérez"
          class="w-full rounded-lg border border-line bg-main px-3 py-2 text-ink transition-all duration-200 focus:border-gold focus:shadow-[0_0_0_3px_rgba(212,175,55,0.15)] focus:outline-none"
        >
      </div>

      <div>
        <label for="email" class="mb-1 block text-sm text-muted">Correo</label>
        <input
          id="email" v-model="email" type="email" required autocomplete="username" placeholder="tu@email.com"
          class="w-full rounded-lg border border-line bg-main px-3 py-2 text-ink transition-all duration-200 focus:border-gold focus:shadow-[0_0_0_3px_rgba(212,175,55,0.15)] focus:outline-none"
        >
      </div>

      <div>
        <label for="password" class="mb-1 block text-sm text-muted">Contraseña</label>
        <AuthPasswordField id="password" v-model="password" autocomplete="new-password" placeholder="••••••••" :minlength="8" />
        <AuthPasswordStrength :password="password" />
      </div>

      <div>
        <label for="password_confirmation" class="mb-1 block text-sm text-muted">Confirmar contraseña</label>
        <AuthPasswordField id="password_confirmation" v-model="passwordConfirmation" autocomplete="new-password" placeholder="Repite tu contraseña" />
        <p v-if="passwordsMatch === true" class="mt-1.5 flex items-center gap-1 text-xs text-emerald-400">
          <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
          Las contraseñas coinciden
        </p>
        <p v-else-if="passwordsMatch === false" class="mt-1.5 text-xs text-red-400">Las contraseñas no coinciden todavía</p>
      </div>

      <label class="flex items-start gap-2 text-xs leading-relaxed text-muted">
        <input v-model="acceptedTerms" type="checkbox" class="mt-0.5 h-4 w-4 shrink-0 rounded border-line bg-main text-gold focus:ring-gold/40">
        <span>
          Acepto los <NuxtLink to="/terminos" target="_blank" class="text-gold hover:underline">Términos y Condiciones</NuxtLink>
          y el <NuxtLink to="/privacidad" target="_blank" class="text-gold hover:underline">Aviso de Privacidad</NuxtLink> de UrbanBlade.
        </span>
      </label>

      <p v-if="secondsLeft > 0" class="text-sm text-amber-400">Demasiados intentos. Espera {{ secondsLeft }}s para volver a intentar.</p>
      <p v-else-if="errorMessage" class="text-sm text-red-400">{{ errorMessage }}</p>

      <button
        type="submit" :disabled="loading || secondsLeft > 0 || !acceptedTerms"
        class="w-full rounded-lg bg-gold px-4 py-2 font-semibold text-black transition-all duration-200 hover:scale-[1.02] hover:bg-gold-dim hover:shadow-lg hover:shadow-gold/20 active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100"
      >
        {{ secondsLeft > 0 ? `Espera ${secondsLeft}s…` : loading ? 'Creando cuenta…' : 'Crear mi cuenta' }}
      </button>

      <p class="pt-2 text-center text-[10px] font-bold uppercase tracking-widest text-muted">
        ¿Ya tienes cuenta? <NuxtLink to="/login" class="text-gold hover:underline">Inicia sesión aquí</NuxtLink>
      </p>
    </form>
  </AuthShell>
</template>
