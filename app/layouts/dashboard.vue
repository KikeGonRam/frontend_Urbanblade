<script setup lang="ts">
import DesktopTopbar from '~/components/shell/DesktopTopbar.vue'

const route = useRoute()
const { hasRole } = useAuth()
// Administración, recepción e ingeniería viven en datos y tablas: carcasa corporativa (plana, densa, sin brillos).
// Cliente y barbero usan la carcasa amable de siempre (islas flotantes, esquinas suaves).
const uiMode = computed(() => (hasRole('administrador') || hasRole('recepcionista') || hasRole('ingeniero') ? 'data' : 'friendly'))
const content = ref<HTMLElement | null>(null)
const { aviso, limpiar } = useAccesoDenegado()
watch(() => route.path, async () => {
  await nextTick()
  content.value?.scrollTo({ top: 0, left: 0 })
})

/*
 * Shell para el área autenticada — equivalente Nuxt de barber/resources/
 * views/app.blade.php (sidebar + topbar móvil + bottom-nav + drawer), pero
 * como componentes Vue reales en vez de Blade+Alpine, ya que aquí no hay
 * servidor renderizando el shell. Ver .claude/skills/nuxt-migration-plan
 * (Fase 3) para el porqué de cada pieza.
 */
</script>

<template>
  <div class="ub-dashboard-shell min-h-screen font-sans text-ink" :data-ui="uiMode">
    <a class="ub-skip-link" href="#dashboard-content">Saltar al contenido</a>
    <ShellAppSidebarV2 />
    <ShellMobileTopbar />

    <div class="ub-dashboard-main min-w-0 pb-20 md:pb-0">
      <DesktopTopbar />
      <main id="dashboard-content" ref="content" tabindex="-1" class="ub-dashboard-content">
        <div
          v-if="aviso"
          role="alert"
          class="mb-4 flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm"
          style="border-color: var(--gold-dim); background: rgba(var(--gold-rgb) / 0.08); color: var(--ink)"
        >
          <span>{{ aviso }}</span>
          <button type="button" class="font-semibold underline" @click="limpiar">Entendido</button>
        </div>
        <slot />
      </main>
    </div>

    <ShellMobileBottomNav />
    <ShellMobileDrawer />
    <ChatWidget />
    <UiChartDetailModal />
  </div>
</template>
