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
        <AuthPasswordField id="password" v-model="password" autocomplete="new-password" placeholder="••••••••" :minlength="8" />
      </div>

      <div>
        <label for="password_confirmation" class="mb-1 block text-sm text-muted">Confirmar contraseña</label>
        <AuthPasswordField id="password_confirmation" v-model="passwordConfirmation" autocomplete="new-password" placeholder="Repite tu nueva contraseña" />
        <p v-if="passwordsMatch === true" class="mt-1.5 flex items-center gap-1 text-xs text-emerald-400">
          <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
          Las contraseñas coinciden
        </p>
        <p v-else-if="passwordsMatch === false" class="mt-1.5 text-xs text-red-400">Las contraseñas no coinciden todavía</p>
      </div>

      <p v-if="errorMessage" class="text-sm text-red-400">{{ errorMessage }}</p>

      <button
        type="submit" :disabled="loading || !token"
        class="w-full rounded-lg bg-gold px-4 py-2 font-semibold text-black transition-all duration-200 hover:scale-[1.02] hover:bg-gold-dim hover:shadow-lg hover:shadow-gold/20 active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100"
      >
        {{ loading ? 'Restableciendo…' : 'Restablecer contraseña' }}
      </button>
    </form>
  </AuthShell>
</template>
