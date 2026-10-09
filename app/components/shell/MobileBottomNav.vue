<script setup lang="ts">
const route = useRoute()
const { primaryItems } = useNavigation()
const { drawerOpen } = useShellState()

function isActive(to: string) {
  return route.path === to || route.path.startsWith(`${to}/`)
}
</script>

<template>
  <nav
    class="ub-mobile-bottomnav fixed inset-x-0 bottom-0 z-30 flex h-16 items-stretch border-t border-line backdrop-blur md:hidden"
    aria-label="Navegación principal"
  >
    <template v-for="navItem in primaryItems" :key="navItem.to">
      <NuxtLink
        v-if="navItem.implemented"
        :to="navItem.to"
        class="ub-mobile-nav-item flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] active:scale-[.98]"
        :class="isActive(navItem.to) ? 'is-active text-gold' : 'text-muted'"
        :aria-current="isActive(navItem.to) ? 'page' : undefined"
      >
        <ShellNavIcon :paths="navItem.icon" />
        <span class="truncate px-1">{{ navItem.label }}</span>
      </NuxtLink>
      <span
        v-else
        class="ub-mobile-nav-item flex flex-1 cursor-not-allowed flex-col items-center justify-center gap-0.5 text-[11px] text-muted/50"
        :aria-label="`${navItem.label}, próximamente`"
        aria-disabled="true"
        title="Próximamente"
      >
        <ShellNavIcon :paths="navItem.icon" />
        <span class="truncate px-1">{{ navItem.label }}</span>
      </span>
    </template>

    <button
      type="button"
      class="ub-mobile-nav-item flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px]"
      :class="drawerOpen ? 'is-active text-gold' : 'text-muted'"
      aria-label="Más opciones"
      :aria-expanded="drawerOpen"
      aria-controls="mobile-navigation-drawer"
      @click="drawerOpen = !drawerOpen"
    >
      <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" />
      </svg>
      <span>Más</span>
    </button>
  </nav>
</template>
