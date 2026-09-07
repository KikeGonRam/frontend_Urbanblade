<script setup lang="ts">
import BrandMark from "~/components/brand/BrandMark.vue";
import type { NavSection } from "~/composables/useNavigation";
const route = useRoute();
const { sections } = useNavigation();
const { theme, THEME_LABELS } = useTheme();
const { themeMascot, mascots } = useBrandMascots();
const { railCollapsed, toggleRail, openSections, initSection, toggleSection } =
  useShellState();
const { user, logout, hasRole } = useAuth();
const avatarFailed = ref(false);
const activeMascot = computed(() => mascots[themeMascot.value]);
const quickAction = computed(() =>
  hasRole("cliente")
    ? { to: "/store", label: "Explorar tienda" }
    : hasRole("barbero")
      ? { to: "/barber/agenda", label: "Ver mi agenda" }
      : hasRole("ingeniero")
        ? { to: "/system", label: "Revisar sistema" }
        : { to: "/appointments", label: "Nueva cita" },
);
function isActive(to: string) {
  return route.path === to || route.path.startsWith(`${to}/`);
}
watch(
  () => user.value?.avatar_url,
  () => {
    avatarFailed.value = false;
  },
);
function sectionActive(section: NavSection) {
  return section.items.some((item) => isActive(item.to));
}
watch(
  sections,
  (list) => {
    for (const section of list)
      if (section.collapsible) initSection(section.key, sectionActive(section));
  },
  { immediate: true },
);
function openConcierge() {
  window.dispatchEvent(new CustomEvent("urbanblade:open-concierge"));
}
async function onLogout() {
  await logout();
  await navigateTo("/login");
}
</script>
<template>
  <aside
    class="ub-sidebar hidden flex-col md:flex"
    :data-variant="theme"
    :data-collapsed="railCollapsed"
    :class="railCollapsed ? 'w-[88px]' : 'w-[272px]'"
  >
    <header class="ub-sidebar__brand">
      <BrandMark class="h-10 w-10 shrink-0" />
      <NuxtLink
        v-show="!railCollapsed"
        to="/dashboard"
        class="ub-sidebar__wordmark"
        >Urban<span>Blade</span
        ><small>{{ THEME_LABELS[theme] }}</small></NuxtLink
      >
      <button
        v-show="!railCollapsed"
        type="button"
        class="ub-sidebar__collapse"
        aria-label="Colapsar menú"
        @click="toggleRail"
      >
        <span aria-hidden="true">‹</span>
      </button>
    </header>
    <NuxtLink
      :to="quickAction.to"
      class="ub-sidebar__quick"
      :class="{ 'is-collapsed': railCollapsed }"
      ><span>＋</span
      ><strong v-show="!railCollapsed">{{
        quickAction.label
      }}</strong></NuxtLink
    >
    <nav class="ub-sidebar__nav" aria-label="Navegación principal">
      <section
        v-for="section in sections"
        :key="section.key"
        class="ub-sidebar__section"
      >
        <button
          v-if="section.collapsible"
          type="button"
          class="ub-sidebar__section-title"
          :class="{ 'is-collapsed': railCollapsed }"
          @click="toggleSection(section.key)"
        >
          <span v-show="!railCollapsed">{{ section.title }}</span
          ><b
            v-show="!railCollapsed"
            :class="{ open: openSections[section.key] }"
            >⌄</b
          >
        </button>
        <p
          v-else
          class="ub-sidebar__section-title"
          :class="{ 'is-collapsed': railCollapsed }"
        >
          <span v-show="!railCollapsed">{{ section.title }}</span>
        </p>
        <ul
          v-show="
            !section.collapsible || openSections[section.key] || railCollapsed
          "
        >
          <li v-for="item in section.items" :key="item.to">
            <NuxtLink
              v-if="item.implemented"
              :to="item.to"
              class="ub-sidebar__item"
              :class="{
                'is-active': isActive(item.to),
                'is-collapsed': railCollapsed,
              }"
              :aria-current="isActive(item.to) ? 'page' : undefined"
              :title="railCollapsed ? item.label : undefined"
              ><ShellNavIcon :paths="item.icon" /><span
                v-show="!railCollapsed"
                >{{ item.label }}</span
              ><b v-if="item.badge && !railCollapsed">{{
                item.badge > 99 ? "99+" : item.badge
              }}</b></NuxtLink
            >
            <span
              v-else
              class="ub-sidebar__item is-disabled"
              :class="{ 'is-collapsed': railCollapsed }"
              ><ShellNavIcon :paths="item.icon" /><span
                v-show="!railCollapsed"
                >{{ item.label }}</span
              ><small v-show="!railCollapsed">Próx.</small></span
            >
          </li>
        </ul>
      </section>
    </nav>
    <button
      v-show="!railCollapsed"
      type="button"
      class="ub-sidebar__helper"
      @click="openConcierge"
    >
      <BrandMascot :mascot="themeMascot" state="welcome" size="sm" /><span
        ><strong>¿Necesitas ayuda?</strong
        ><small>{{ activeMascot.name }} · {{ activeMascot.role }}</small
        ><em>Abrir Concierge →</em></span
      >
    </button>
    <footer
      class="ub-sidebar__profile"
      :class="{ 'is-collapsed': railCollapsed }"
    >
      <img
        v-if="user?.avatar_url && !avatarFailed"
        :src="user.avatar_url"
        :alt="`Foto de ${user.name}`"
        class="ub-sidebar__avatar object-cover"
        @error="avatarFailed = true"
      /><span v-else class="ub-sidebar__avatar">{{
        (user?.name ?? "U").slice(0, 2).toUpperCase()
      }}</span
      ><span v-show="!railCollapsed"
        ><strong>{{ user?.name }}</strong
        ><small>{{ user?.roles.join(", ") }}</small></span
      ><button
        v-show="!railCollapsed"
        type="button"
        aria-label="Cerrar sesión"
        title="Cerrar sesión"
        @click="onLogout"
      >
        Salir
      </button>
    </footer>
  </aside>
</template>
