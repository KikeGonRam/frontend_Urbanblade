<script setup lang="ts">
definePageMeta({ middleware: 'guest' })

const route = useRoute()
const token = computed(() => (typeof route.query.token === 'string' ? route.query.token : ''))
const email = ref(typeof route.query.email === 'string' ? route.query.email : '')
const password = ref('')
const passwordConfirmation = ref('')
const errorMessage = ref('')
const loading = ref(false)

const { resetPassword } = useAuth()

async function onSubmit() {
  errorMessage.value = ''

  if (password.value !== passwordConfirmation.value) {
    errorMessage.value = 'Las contraseñas no coinciden.'

    return
  }

  loading.value = true
  try {
    await resetPassword(token.value, email.value, password.value, passwordConfirmation.value)
    await navigateTo('/login')
  } catch (error: unknown) {
    errorMessage.value = (error as { data?: { message?: string } })?.data?.message ?? 'No se pudo restablecer la contraseña. El enlace puede haber expirado.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthShell mascot="bruno-raven.png" mascot-name="Bruno">
    <h1 class="mb-1 text-center text-lg font-black uppercase tracking-widest text-white">
      Nueva <span class="font-serif text-base italic normal-case text-gold">contraseña</span>
    </h1>
    <p class="mb-6 text-center text-[10px] font-bold uppercase tracking-widest text-muted">Establece tu nueva clave de acceso premium</p>

    <form class="space-y-4" @submit.prevent="onSubmit">
      <div>
        <label for="email" class="mb-1 block text-sm text-muted">Correo</label>
        <input
          id="email" v-model="email" type="email" required readonly autocomplete="username"
          class="w-full cursor-not-allowed rounded-lg border border-line bg-main/50 px-3 py-2 text-muted focus:outline-none"
        >
      </div>

      <div>
        <label for="password" class="mb-1 block text-sm text-muted">Nueva contraseña</label>
        <input
          id="password" v-model="password" type="password" required autocomplete="new-password" placeholder="••••••••" minlength="8"
          class="w-full rounded-lg border border-line bg-main px-3 py-2 text-ink focus:border-gold focus:outline-none"
        >
      </div>

      <div>
        <label for="password_confirmation" class="mb-1 block text-sm text-muted">Confirmar contraseña</label>
        <input
          id="password_confirmation" v-model="passwordConfirmation" type="password" required autocomplete="new-password" placeholder="Repite tu nueva contraseña"
          class="w-full rounded-lg border border-line bg-main px-3 py-2 text-ink focus:border-gold focus:outline-none"
        >
      </div>

      <p v-if="errorMessage" class="text-sm text-red-400">{{ errorMessage }}</p>

      <button
        type="submit" :disabled="loading || !token"
        class="w-full rounded-lg bg-gold px-4 py-2 font-semibold text-black transition hover:bg-gold-dim disabled:opacity-50"
      >
        {{ loading ? 'Restableciendo…' : 'Restablecer contraseña' }}
      </button>
    </form>
  </AuthShell>
</template>
