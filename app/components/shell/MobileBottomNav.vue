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
    class="fixed inset-x-0 bottom-0 z-30 flex h-16 items-stretch border-t border-line bg-main/95 backdrop-blur md:hidden"
    aria-label="Navegación principal"
  >
    <NuxtLink
      v-for="navItem in primaryItems"
      :key="navItem.to"
      :to="navItem.implemented ? navItem.to : '#'"
      class="flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px]"
      :class="isActive(navItem.to) && navItem.implemented ? 'text-gold' : 'text-muted'"
    >
      <ShellNavIcon :paths="navItem.icon" />
      <span class="truncate px-1">{{ navItem.label }}</span>
    </NuxtLink>

    <button
      type="button"
      class="flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px]"
      :class="drawerOpen ? 'text-gold' : 'text-muted'"
      aria-label="Más opciones"
      @click="drawerOpen = !drawerOpen"
    >
      <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" />
      </svg>
      <span>Más</span>
    </button>
  </nav>
</template>
