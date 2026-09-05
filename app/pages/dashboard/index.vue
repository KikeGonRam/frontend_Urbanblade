<script setup lang="ts">
definePageMeta({ middleware: 'auth', layout: 'dashboard' })

const { user, fetchMe } = useAuth()

// Confirma el token contra /auth/me al entrar — si quedó inválido/expirado,
// useAuth().fetchMe() limpia la sesión y el próximo guard manda a /login.
await callOnce(fetchMe)
</script>

<template>
  <div class="p-4 sm:p-6 lg:p-8">
    <header class="mb-6">
      <p class="text-sm uppercase tracking-widest text-muted">UrbanBlade</p>
      <h1 class="mt-1 text-2xl font-semibold text-ink">Dashboard</h1>
    </header>

    <section v-if="user" class="ui-card-premium p-5">
      <p class="text-sm text-muted">Sesión activa vía token Bearer (mobile_api_tokens):</p>
      <dl class="mt-3 space-y-1 text-sm">
        <div><dt class="inline text-muted">Nombre: </dt><dd class="inline">{{ user.name }}</dd></div>
        <div><dt class="inline text-muted">Email: </dt><dd class="inline">{{ user.email }}</dd></div>
        <div><dt class="inline text-muted">Roles: </dt><dd class="inline">{{ user.roles.join(', ') }}</dd></div>
      </dl>
      <p class="mt-4 text-xs text-muted">
        El resto del sidebar (Citas, Clientes, Pagos…) ya está armado por rol — se activa
        página por página en las siguientes fases. Los ítems marcados "Próx." aún no
        tienen página propia en este repo.
      </p>
    </section>
    <p v-else class="text-sm text-muted">Cargando datos del usuario…</p>
  </div>
</template>
