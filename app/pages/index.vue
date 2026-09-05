<script setup lang="ts">
const { theme, apply, THEMES, THEME_LABELS } = useTheme()
const { isAuthenticated } = useAuth()
</script>

<template>
  <div class="min-h-screen p-8 font-sans text-ink">
    <header class="mb-10 flex items-start justify-between">
      <div>
        <p class="text-sm uppercase tracking-widest text-muted">UrbanBlade</p>
        <h1 class="mt-1 text-3xl font-semibold text-ink">Frontend Nuxt — verificación</h1>
        <p class="mt-2 max-w-xl text-sm text-muted">
          Fase 1: sistema de 4 temas. Fase 2: auth por token Bearer contra la API de
          barber. Cambia de tema abajo, o entra a la sesión para probar el flujo
          completo.
        </p>
      </div>
      <NuxtLink
        :to="isAuthenticated ? '/dashboard' : '/login'"
        class="shrink-0 rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-black hover:bg-gold-dim"
      >
        {{ isAuthenticated ? 'Ir al dashboard' : 'Iniciar sesión' }}
      </NuxtLink>
    </header>

    <div class="mb-8 flex flex-wrap gap-2">
      <button
        v-for="t in THEMES"
        :key="t"
        type="button"
        class="rounded-full border px-4 py-2 text-sm font-medium transition"
        :class="theme === t
          ? 'border-gold bg-gold/10 text-gold'
          : 'border-line bg-card text-ink hover:border-gold-dim'"
        @click="apply(t)"
      >
        {{ THEME_LABELS[t] }}
      </button>
    </div>

    <section class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <article class="rounded-xl border border-line bg-card p-5">
        <h2 class="font-analytics text-lg font-semibold text-ink">Tarjeta .bg-card</h2>
        <p class="mt-1 text-sm text-muted">Texto secundario en --muted.</p>
        <button class="mt-4 rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-black hover:bg-gold-dim">
          Acento .bg-gold
        </button>
      </article>

      <article class="rounded-xl border border-line bg-panel p-5">
        <h2 class="font-analytics text-lg font-semibold text-ink">Panel .bg-panel</h2>
        <p class="mt-1 text-sm text-muted">Fondo de tablas / paneles.</p>
        <div class="mt-4 flex gap-2">
          <span class="rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-xs text-gold">bg-gold/10</span>
          <span class="rounded-full bg-ink/10 px-3 py-1 text-xs text-ink">bg-ink/10</span>
        </div>
      </article>

      <article class="rounded-xl border border-line bg-accent p-5">
        <h2 class="font-analytics text-lg font-semibold text-ink">Hover .bg-accent</h2>
        <p class="mt-1 text-sm text-muted">Fondo de hover / elementos secundarios.</p>
      </article>
    </section>
  </div>
</template>
