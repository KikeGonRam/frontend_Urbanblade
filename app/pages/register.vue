<script setup lang="ts">
definePageMeta({ middleware: 'guest' })

const name = ref('')
const email = ref('')
const password = ref('')
const passwordConfirmation = ref('')
const errorMessage = ref('')
const loading = ref(false)

const { register } = useAuth()

// Feedback en vivo de confirmación de contraseña -- solo una vez que ambos
// campos tienen contenido, para no regañar al usuario a mitad de escribir la
// primera contraseña.
const passwordsMatch = computed(() => {
  if (!password.value || !passwordConfirmation.value) return null

  return password.value === passwordConfirmation.value
})

async function onSubmit() {
  errorMessage.value = ''

  if (password.value !== passwordConfirmation.value) {
    errorMessage.value = 'Las contraseñas no coinciden.'

    return
  }

  loading.value = true
  try {
    await register(name.value, email.value, password.value, passwordConfirmation.value)
    await navigateTo('/dashboard')
  } catch (error: unknown) {
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

      <p v-if="errorMessage" class="text-sm text-red-400">{{ errorMessage }}</p>

      <button
        type="submit" :disabled="loading"
        class="w-full rounded-lg bg-gold px-4 py-2 font-semibold text-black transition-all duration-200 hover:scale-[1.02] hover:bg-gold-dim hover:shadow-lg hover:shadow-gold/20 active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100"
      >
        {{ loading ? 'Creando cuenta…' : 'Crear mi cuenta' }}
      </button>

      <p class="pt-2 text-center text-[10px] font-bold uppercase tracking-widest text-muted">
        ¿Ya tienes cuenta? <NuxtLink to="/login" class="text-gold hover:underline">Inicia sesión aquí</NuxtLink>
      </p>
    </form>
  </AuthShell>
</template>
