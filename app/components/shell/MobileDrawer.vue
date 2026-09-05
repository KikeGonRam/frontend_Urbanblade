<script setup lang="ts">
const { sections } = useNavigation()
const { drawerOpen } = useShellState()
const { user, logout } = useAuth()

async function onLogout() {
  drawerOpen.value = false
  await logout()
  await navigateTo('/login')
}
</script>

<template>
  <Transition
    enter-active-class="transition-opacity duration-200" enter-from-class="opacity-0" enter-to-class="opacity-100"
    leave-active-class="transition-opacity duration-150" leave-from-class="opacity-100" leave-to-class="opacity-0"
  >
    <div v-if="drawerOpen" class="fixed inset-0 z-40 bg-black/50 md:hidden" @click="drawerOpen = false" />
  </Transition>

  <Transition
    enter-active-class="transition-transform duration-200" enter-from-class="translate-y-full" enter-to-class="translate-y-0"
    leave-active-class="transition-transform duration-150" leave-from-class="translate-y-0" leave-to-class="translate-y-full"
  >
    <div
      v-if="drawerOpen"
      class="fixed inset-x-0 bottom-0 z-50 max-h-[80vh] overflow-y-auto rounded-t-2xl border-t border-line bg-panel p-4 md:hidden"
    >
      <div class="mx-auto mb-3 h-1 w-10 rounded-full bg-line" />

      <div v-for="section in sections" :key="section.key" class="mb-4">
        <p class="mb-1 px-1 text-xs font-semibold uppercase tracking-wider text-muted">{{ section.title }}</p>
        <ul class="space-y-0.5">
          <li v-for="navItem in section.items" :key="navItem.to">
            <NuxtLink
              v-if="navItem.implemented"
              :to="navItem.to"
              class="flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm text-ink hover:bg-accent"
              @click="drawerOpen = false"
            >
              <ShellNavIcon :paths="navItem.icon" />
              {{ navItem.label }}
            </NuxtLink>
            <span v-else class="flex cursor-not-allowed items-center gap-3 rounded-lg px-2.5 py-2 text-sm text-muted/50">
              <ShellNavIcon :paths="navItem.icon" />
              {{ navItem.label }}
              <span class="ml-auto rounded-full border border-line px-1.5 py-0.5 text-[9px] text-muted">Próx.</span>
            </span>
          </li>
        </ul>
      </div>

      <div class="flex items-center gap-2 border-t border-line pt-3">
        <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold/20 text-xs font-semibold text-gold">
          {{ (user?.name ?? 'U').slice(0, 2).toUpperCase() }}
        </div>
        <div class="min-w-0">
          <p class="truncate text-sm text-ink">{{ user?.name }}</p>
          <p class="truncate text-xs text-muted">{{ user?.roles.join(', ') }}</p>
        </div>
        <button type="button" class="ml-auto shrink-0 text-sm text-gold" @click="onLogout">
          Cerrar sesión
        </button>
      </div>
    </div>
  </Transition>
</template>
