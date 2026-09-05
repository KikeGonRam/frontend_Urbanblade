<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const { user, fetchMe, logout } = useAuth()

// Confirma el token contra /auth/me al entrar — si el token quedó
// inválido/expirado, useAuth().fetchMe() lo limpia y el próximo guard lo
// manda a /login.
await callOnce(fetchMe)

async function onLogout() {
  await logout()
  await navigateTo('/login')
}
</script>

<template>
  <div class="min-h-screen p-8 font-sans text-ink">
    <header class="mb-8 flex items-center justify-between">
      <div>
        <p class="text-sm uppercase tracking-widest text-muted">UrbanBlade</p>
        <h1 class="mt-1 text-2xl font-semibold text-ink">Dashboard (verificación de auth)</h1>
      </div>
      <button
        type="button"
        class="rounded-lg border border-line px-4 py-2 text-sm hover:border-gold-dim"
        @click="onLogout"
      >
        Cerrar sesión
      </button>
    </header>

    <section v-if="user" class="rounded-xl border border-line bg-card p-5">
      <p class="text-sm text-muted">Sesión activa vía token Bearer (mobile_api_tokens):</p>
      <dl class="mt-3 space-y-1 text-sm">
        <div><dt class="inline text-muted">Nombre: </dt><dd class="inline">{{ user.name }}</dd></div>
        <div><dt class="inline text-muted">Email: </dt><dd class="inline">{{ user.email }}</dd></div>
        <div><dt class="inline text-muted">Roles: </dt><dd class="inline">{{ user.roles.join(', ') }}</dd></div>
      </dl>
    </section>
    <p v-else class="text-sm text-muted">Cargando datos del usuario…</p>
  </div>
</template>
