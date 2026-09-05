<script setup lang="ts">
definePageMeta({ middleware: 'auth', layout: 'dashboard' })

interface DashboardResponse {
  role: string
  data: Record<string, unknown>
}

const { user, fetchMe } = useAuth()
const { apiFetch } = useApi()

// Confirma el token contra /auth/me al entrar — si quedó inválido/expirado,
// useAuth().fetchMe() limpia la sesión y el próximo guard manda a /login.
await callOnce(fetchMe)

const { data: dashboard, pending, error, refresh } = await useAsyncData('dashboard', () =>
  apiFetch<DashboardResponse>('/dashboard'),
)

const firstName = computed(() => (user.value?.name ?? 'Usuario').split(' ')[0])
const fullName = computed(() => user.value?.name ?? '')
</script>

<template>
  <div class="p-4 sm:p-6 lg:p-8">
    <p v-if="pending" class="text-sm text-muted">Cargando dashboard…</p>
    <p v-else-if="error" class="text-sm text-red-400">No se pudo cargar el dashboard. Intenta recargar.</p>

    <DashboardRecepcion
      v-else-if="dashboard?.role === 'recepcionista'"
      :data="(dashboard.data as any)"
      :first-name="firstName"
    />

    <DashboardBarbero
      v-else-if="dashboard?.role === 'barbero'"
      :data="(dashboard.data as any)"
      :first-name="firstName"
      @refresh="refresh"
    />

    <DashboardCliente
      v-else-if="dashboard?.role === 'cliente'"
      :data="(dashboard.data as any)"
      :first-name="firstName"
      :full-name="fullName"
    />

    <section v-else-if="dashboard" class="ui-card-premium p-5">
      <header class="mb-4">
        <p class="text-sm uppercase tracking-widest text-muted">UrbanBlade</p>
        <h1 class="mt-1 text-2xl font-semibold text-ink">Dashboard</h1>
      </header>
      <p class="text-sm text-muted">
        Sesión activa como <strong class="text-ink">{{ dashboard.role }}</strong>. El
        dashboard de este rol todavía no está migrado a Nuxt — sigue disponible en la
        versión Inertia de <code>barber</code> mientras tanto.
      </p>
    </section>
  </div>
</template>
