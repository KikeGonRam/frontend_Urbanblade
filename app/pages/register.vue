<script setup lang="ts">
definePageMeta({ middleware: 'guest' })

const name = ref('')
const email = ref('')
const password = ref('')
const passwordConfirmation = ref('')
const errorMessage = ref('')
const loading = ref(false)

const { register } = useAuth()

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
          class="w-full rounded-lg border border-line bg-main px-3 py-2 text-ink focus:border-gold focus:outline-none"
        >
      </div>

      <div>
        <label for="email" class="mb-1 block text-sm text-muted">Correo</label>
        <input
          id="email" v-model="email" type="email" required autocomplete="username" placeholder="tu@email.com"
          class="w-full rounded-lg border border-line bg-main px-3 py-2 text-ink focus:border-gold focus:outline-none"
        >
      </div>

      <div>
        <label for="password" class="mb-1 block text-sm text-muted">Contraseña</label>
        <input
          id="password" v-model="password" type="password" required autocomplete="new-password" placeholder="••••••••" minlength="8"
          class="w-full rounded-lg border border-line bg-main px-3 py-2 text-ink focus:border-gold focus:outline-none"
        >
      </div>

      <div>
        <label for="password_confirmation" class="mb-1 block text-sm text-muted">Confirmar contraseña</label>
        <input
          id="password_confirmation" v-model="passwordConfirmation" type="password" required autocomplete="new-password" placeholder="Repite tu contraseña"
          class="w-full rounded-lg border border-line bg-main px-3 py-2 text-ink focus:border-gold focus:outline-none"
        >
      </div>

      <p v-if="errorMessage" class="text-sm text-red-400">{{ errorMessage }}</p>

      <button
        type="submit" :disabled="loading"
        class="w-full rounded-lg bg-gold px-4 py-2 font-semibold text-black transition hover:bg-gold-dim disabled:opacity-50"
      >
        {{ loading ? 'Creando cuenta…' : 'Crear mi cuenta' }}
      </button>

      <p class="pt-2 text-center text-[10px] font-bold uppercase tracking-widest text-muted">
        ¿Ya tienes cuenta? <NuxtLink to="/login" class="text-gold hover:underline">Inicia sesión aquí</NuxtLink>
      </p>
    </form>
  </AuthShell>
</template>
