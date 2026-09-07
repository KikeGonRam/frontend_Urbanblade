<script setup lang="ts">
const route = useRoute();
const { railCollapsed, toggleRail } = useShellState();
const { theme, apply, THEMES, THEME_LABELS } = useTheme();
const { user } = useAuth();
const avatarFailed = ref(false);
const search = ref("");
const pageName = computed(() => {
  const segment = route.path.split("/").filter(Boolean).at(-1) ?? "dashboard";
  return segment.replaceAll("-", " ");
});
watch(
  () => user.value?.avatar_url,
  () => {
    avatarFailed.value = false;
  },
);
</script>

<template>
  <header class="ub-desktop-topbar hidden md:flex">
    <div class="ub-desktop-topbar__start">
      <button
        type="button"
        class="ub-topbar-button"
        :aria-label="railCollapsed ? 'Expandir menú' : 'Colapsar menú'"
        @click="toggleRail"
      >
        <ShellNavIcon paths="<path d='M4 7h16M4 12h10M4 17h16' />" />
      </button>
      <div class="ub-desktop-topbar__context">
        <small>UrbanBlade</small>
        <strong class="capitalize">{{ pageName }}</strong>
      </div>
    </div>

    <label class="ub-topbar-search">
      <ShellNavIcon
        paths="<circle cx='11' cy='11' r='7' /><path d='m20 20-4-4' />"
      />
      <span class="sr-only">Buscar</span>
      <input
        v-model="search"
        type="search"
        placeholder="Buscar clientes, citas, servicios…"
      />
    </label>

    <div class="ub-desktop-topbar__actions">
      <label class="ub-theme-switcher">
        <span>Tema</span>
        <select
          :value="theme"
          aria-label="Seleccionar tema"
          @change="
            apply(($event.target as HTMLSelectElement).value as typeof theme)
          "
        >
          <option v-for="option in THEMES" :key="option" :value="option">
            {{ THEME_LABELS[option] }}
          </option>
        </select>
      </label>
      <ShellPushToggle />
      <div class="ub-topbar-profile">
        <img
          v-if="user?.avatar_url && !avatarFailed"
          :src="user.avatar_url"
          :alt="`Foto de ${user.name}`"
          class="ub-sidebar__avatar object-cover"
          @error="avatarFailed = true"
        />
        <span v-else class="ub-sidebar__avatar">{{
          (user?.name ?? "U").slice(0, 2).toUpperCase()
        }}</span>
        <span
          ><strong>{{ user?.name }}</strong
          ><small>{{ user?.roles.join(", ") }}</small></span
        >
      </div>
    </div>
  </header>
</template>
