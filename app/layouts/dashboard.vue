<script setup lang="ts">
/*
 * Shell para el área autenticada — equivalente Nuxt de barber/resources/
 * views/app.blade.php (sidebar + topbar móvil + bottom-nav + drawer), pero
 * como componentes Vue reales en vez de Blade+Alpine, ya que aquí no hay
 * servidor renderizando el shell. Ver .claude/skills/nuxt-migration-plan
 * (Fase 3) para el porqué de cada pieza.
 */
</script>

<template>
  <div class="min-h-screen font-sans text-ink md:flex">
    <ShellAppSidebar />
    <ShellMobileTopbar />

    <div class="min-w-0 flex-1 pb-20 md:pb-0">
      <slot />
    </div>

    <ShellMobileBottomNav />
    <ShellMobileDrawer />
  </div>
</template>
