<script setup lang="ts">
import type { NavSection } from '~/composables/useNavigation'

const route = useRoute()
const { sections } = useNavigation()
const { railCollapsed, toggleRail, openSections, initSection, toggleSection } = useShellState()
const { user, logout } = useAuth()

function isActive(to: string) {
  return route.path === to || route.path.startsWith(`${to}/`)
}

function sectionActive(section: NavSection) {
  return section.items.some((i) => isActive(i.to))
}

watch(sections, (list) => {
  for (const section of list) {
    if (section.collapsible) initSection(section.key, sectionActive(section))
  }
}, { immediate: true })

async function onLogout() {
  await logout()
  await navigateTo('/login')
}
</script>

<template>
  <aside
    class="sticky top-0 hidden h-screen flex-col border-r border-line bg-panel transition-[width] duration-200 md:flex md:w-[88px]"
    :class="railCollapsed ? 'lg:w-[88px]' : 'lg:w-[264px]'"
  >
    <div class="flex h-16 shrink-0 items-center gap-2 border-b border-line px-4">
      <BrandBrandMark class="h-9 w-9 shrink-0" />
      <NuxtLink to="/dashboard" class="truncate font-analytics text-lg font-semibold text-ink">
        <span class="hidden" :class="{ 'lg:inline': !railCollapsed }">Urban<span class="text-gold">Blade</span></span>
      </NuxtLink>
      <div class="ml-auto flex items-center gap-1">
        <ShellPushToggle />
        <button
          type="button"
          class="hidden rounded-lg p-1.5 text-muted hover:bg-accent hover:text-ink lg:block"
          :aria-label="railCollapsed ? 'Expandir menú' : 'Colapsar menú'"
          @click="toggleRail"
        >
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path v-if="railCollapsed" d="M9 6l6 6-6 6" stroke-linecap="round" stroke-linejoin="round" />
            <path v-else d="M15 6l-6 6 6 6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
      </div>
    </div>

    <nav class="flex-1 space-y-5 overflow-y-auto px-3 py-5">
      <div v-for="section in sections" :key="section.key">
        <button
          v-if="section.collapsible"
          type="button"
          class="flex w-full items-center justify-between rounded-lg px-2 py-1 text-left text-[10px] font-black uppercase tracking-[0.18em] text-muted/70 transition-colors hover:text-ink"
          :class="{ 'lg:justify-center': railCollapsed }"
          @click="toggleSection(section.key)"
        >
          <span :class="{ 'lg:hidden': railCollapsed }">{{ section.title }}</span>
          <svg
            class="h-3 w-3 shrink-0 transition-transform"
            :class="{ 'rotate-180': openSections[section.key], 'lg:hidden': railCollapsed }"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
          >
            <path d="M6 9l6 6 6-6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
        <p v-else class="px-2 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-muted/70" :class="{ 'lg:hidden': railCollapsed }">
          {{ section.title }}
        </p>

        <ul
          v-show="!section.collapsible || openSections[section.key] || railCollapsed"
          class="mt-2 space-y-1"
        >
          <li v-for="navItem in section.items" :key="navItem.to">
            <NuxtLink
              v-if="navItem.implemented"
              :to="navItem.to"
              class="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all"
              :class="[
                railCollapsed ? 'lg:justify-center' : '',
                isActive(navItem.to) ? 'bg-gold/15 font-bold text-gold' : 'font-medium text-ink/80 hover:bg-accent hover:text-ink',
              ]"
            >
              <ShellNavIcon :paths="navItem.icon" />
              <span class="truncate" :class="{ 'lg:hidden': railCollapsed }">{{ navItem.label }}</span>
              <span
                v-if="navItem.badge"
                class="ml-auto rounded-full bg-gold px-1.5 py-0.5 text-[10px] font-bold text-black"
                :class="{ 'lg:hidden': railCollapsed }"
              >
                {{ navItem.badge > 9 ? '9+' : navItem.badge }}
              </span>
            </NuxtLink>
            <span
              v-else
              class="flex cursor-not-allowed items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted/50"
              :class="{ 'lg:justify-center': railCollapsed }"
            >
              <ShellNavIcon :paths="navItem.icon" />
              <span class="truncate" :class="{ 'lg:hidden': railCollapsed }">{{ navItem.label }}</span>
              <span
                class="ml-auto rounded-full border border-line px-1.5 py-0.5 text-[9px] text-muted"
                :class="{ 'lg:hidden': railCollapsed }"
              >
                Próx.
              </span>
            </span>
          </li>
        </ul>
      </div>
    </nav>

    <div class="shrink-0 border-t border-line p-3">
      <div
        class="flex items-center gap-2.5 rounded-xl p-2 transition-colors hover:bg-accent"
        :class="{ 'lg:justify-center': railCollapsed }"
      >
        <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold/20 text-xs font-bold text-gold">
          {{ (user?.name ?? 'U').slice(0, 2).toUpperCase() }}
        </div>
        <div class="min-w-0" :class="{ 'lg:hidden': railCollapsed }">
          <p class="truncate text-sm font-semibold text-ink">{{ user?.name }}</p>
          <p class="truncate text-xs capitalize text-muted">{{ user?.roles.join(', ') }}</p>
        </div>
        <button
          type="button"
          class="ml-auto shrink-0 rounded-lg p-1.5 text-muted hover:bg-card hover:text-ink"
          :class="{ 'lg:hidden': railCollapsed }"
          aria-label="Cerrar sesión"
          @click="onLogout"
        >
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  </aside>
</template>
