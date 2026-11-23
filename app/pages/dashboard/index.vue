<script setup lang="ts">
definePageMeta({ middleware: "auth", layout: "dashboard" });

// WCAG 2.1 A (2.4.2 Page Titled): el panel salia sin <title>. noindex porque
// toda el area autenticada queda fuera de buscadores.
useSeoMeta({ title: "Panel — UrbanBlade", robots: "noindex" });

interface DashboardResponse {
  role: string;
  data: Record<string, unknown>;
}

const { user, fetchMe } = useAuth();
const { apiFetch } = useApi();

// Confirma el token contra /auth/me al entrar — si quedó inválido/expirado,
// useAuth().fetchMe() limpia la sesión y el próximo guard manda a /login.
await callOnce(fetchMe);

const {
  data: dashboard,
  pending,
  error,
  refresh,
} = await useAsyncData(
  "dashboard",
  () => apiFetch<DashboardResponse>("/dashboard"),
  { lazy: true },
);

const firstName = computed(() => (user.value?.name ?? "Usuario").split(" ")[0]);
const fullName = computed(() => user.value?.name ?? "");
</script>

<template>
  <div class="p-4 sm:p-6 lg:p-8">
    <UiSkeleton v-if="pending" variant="cards" label="Cargando tu panel…" />
    <BrandStatePanel
      v-else-if="error"
      mascot="bruno"
      state="error"
      tone="danger"
      title="No se pudo cargar tu panel"
      description="Revisa tu conexión e inténtalo de nuevo para recuperar tus indicadores."
      action-label="Reintentar"
      @action="refresh"
    />

    <LazyDashboardRecepcion
      v-else-if="dashboard?.role === 'recepcionista'"
      :data="dashboard.data as any"
      :first-name="firstName"
    />

    <LazyDashboardBarbero
      v-else-if="dashboard?.role === 'barbero'"
      :data="dashboard.data as any"
      :first-name="firstName"
      @refresh="refresh"
    />

    <LazyDashboardCliente
      v-else-if="dashboard?.role === 'cliente'"
      :data="dashboard.data as any"
      :first-name="firstName"
      :full-name="fullName"
    />

    <LazyDashboardAdministrador
      v-else-if="dashboard?.role === 'administrador'"
      :data="dashboard.data as any"
    />

    <!--
      Rol sin panel (p. ej. una cuenta del antiguo rol ingeniero, que ya no existe, o sin rol): antes decía que el
      panel seguía «en la versión Inertia de barber», que se retiró. Ahora explica qué hacer.
    -->
    <BrandStatePanel
      v-else-if="dashboard"
      mascot="bruno"
      state="lost"
      title="Tu cuenta todavía no tiene un panel"
      description="Pide a administración que revise tu rol. Mientras tanto puedes revisar tus datos en tu perfil."
      action-label="Ir a mi perfil"
      action-to="/profile"
    />
  </div>
</template>
