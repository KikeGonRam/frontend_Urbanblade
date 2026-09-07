<script setup lang="ts">
import DesktopTopbar from '~/components/shell/DesktopTopbar.vue'

/*
 * Shell para el área autenticada — equivalente Nuxt de barber/resources/
 * views/app.blade.php (sidebar + topbar móvil + bottom-nav + drawer), pero
 * como componentes Vue reales en vez de Blade+Alpine, ya que aquí no hay
 * servidor renderizando el shell. Ver .claude/skills/nuxt-migration-plan
 * (Fase 3) para el porqué de cada pieza.
 */
</script>

<template>
  <div class="ub-dashboard-shell min-h-screen font-sans text-ink">
    <a class="ub-skip-link" href="#dashboard-content">Saltar al contenido</a>
    <ShellAppSidebarV2 />
    <ShellMobileTopbar />

    <div class="ub-dashboard-main min-w-0 pb-20 md:pb-0">
      <DesktopTopbar />
      <main id="dashboard-content" tabindex="-1" class="ub-dashboard-content">
        <slot />
      </main>
    </div>

    <ShellMobileBottomNav />
    <ShellMobileDrawer />
    <ChatWidget />
  </div>
</template>
