<script setup lang="ts">
definePageMeta({ middleware: 'guest' })

const email = ref('')
const message = ref('')
const errorMessage = ref('')
const loading = ref(false)
const sent = ref(false)

const { forgotPassword } = useAuth()

async function onSubmit() {
  errorMessage.value = ''
  loading.value = true
  try {
    const res = await forgotPassword(email.value)
    message.value = res.message
    sent.value = true
  } catch (error: unknown) {
    errorMessage.value = (error as { data?: { message?: string } })?.data?.message ?? 'No se pudo enviar el enlace de recuperación.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthShell mascot="bruno-raven.png" mascot-name="Bruno">
    <h1 class="mb-1 text-center text-lg font-black uppercase tracking-widest text-white">
      Recuperar <span class="font-serif text-base italic normal-case text-gold">acceso</span>
    </h1>
    <p class="mb-6 text-center text-[10px] font-bold uppercase leading-relaxed tracking-widest text-muted">
      ¿Olvidaste tu contraseña? No hay problema. Introduce tu correo y te enviaremos un enlace para elegir una nueva.
    </p>

    <template v-if="sent">
      <div class="animate-[auth-pop_.4s_cubic-bezier(.16,1,.3,1)_both] rounded-lg border border-gold/30 bg-gold/5 p-4 text-center">
        <svg class="mx-auto mb-2 h-8 w-8 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
        </svg>
        <p class="text-sm text-gold">{{ message }}</p>
      </div>
      <NuxtLink to="/login" class="mt-6 block text-center text-[10px] font-black uppercase tracking-widest text-muted hover:text-gold">
        &larr; Volver al inicio de sesión
      </NuxtLink>
    </template>

    <form v-else class="space-y-4" @submit.prevent="onSubmit">
      <div>
        <label for="email" class="mb-1 block text-sm text-muted">Correo</label>
        <input
          id="email" v-model="email" type="email" required autofocus placeholder="tu@email.com"
          class="w-full rounded-lg border border-line bg-main px-3 py-2 text-ink transition-all duration-200 focus:border-gold focus:shadow-[0_0_0_3px_rgba(212,175,55,0.15)] focus:outline-none"
        >
      </div>

      <p v-if="errorMessage" class="text-sm text-red-400">{{ errorMessage }}</p>

      <button
        type="submit" :disabled="loading"
        class="w-full rounded-lg bg-gold px-4 py-2 font-semibold text-black transition-all duration-200 hover:scale-[1.02] hover:bg-gold-dim hover:shadow-lg hover:shadow-gold/20 active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100"
      >
        {{ loading ? 'Enviando…' : 'Enviar enlace de recuperación' }}
      </button>

      <NuxtLink to="/login" class="block pt-2 text-center text-[10px] font-black uppercase tracking-widest text-muted hover:text-gold">
        &larr; Volver al inicio de sesión
      </NuxtLink>
    </form>
  </AuthShell>
</template>
