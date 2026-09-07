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
      <p class="rounded-lg border border-gold/30 bg-gold/5 p-3 text-center text-sm text-gold">{{ message }}</p>
      <NuxtLink to="/login" class="mt-6 block text-center text-[10px] font-black uppercase tracking-widest text-muted hover:text-gold">
        &larr; Volver al inicio de sesión
      </NuxtLink>
    </template>

    <form v-else class="space-y-4" @submit.prevent="onSubmit">
      <div>
        <label for="email" class="mb-1 block text-sm text-muted">Correo</label>
        <input
          id="email" v-model="email" type="email" required autofocus placeholder="tu@email.com"
          class="w-full rounded-lg border border-line bg-main px-3 py-2 text-ink focus:border-gold focus:outline-none"
        >
      </div>

      <p v-if="errorMessage" class="text-sm text-red-400">{{ errorMessage }}</p>

      <button
        type="submit" :disabled="loading"
        class="w-full rounded-lg bg-gold px-4 py-2 font-semibold text-black transition hover:bg-gold-dim disabled:opacity-50"
      >
        {{ loading ? 'Enviando…' : 'Enviar enlace de recuperación' }}
      </button>

      <NuxtLink to="/login" class="block pt-2 text-center text-[10px] font-black uppercase tracking-widest text-muted hover:text-gold">
        &larr; Volver al inicio de sesión
      </NuxtLink>
    </form>
  </AuthShell>
</template>
