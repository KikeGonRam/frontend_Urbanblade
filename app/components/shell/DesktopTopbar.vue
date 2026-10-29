<script setup lang="ts">
const route = useRoute();
const { railCollapsed, toggleRail } = useShellState();
const { theme, apply, THEMES, THEME_LABELS } = useTheme();
const { user } = useAuth();
const avatarFailed = ref(false);
const { sections } = useNavigation();
// Pantallas que no están en el menú (perfil, detalle de una cita, etc.).
const EXTRA_TITLES: Record<string, string> = {
  profile: "Mi perfil",
  reservar: "Reservar cita",
  corte: "Corte de caja",
  pending: "Pagos pendientes",
  calendar: "Calendario",
  feed: "Muro Inspiración",
};
// El título sale del nombre en español del menú (el más específico que coincida con la ruta), no de la URL:
// antes la barra decía "Appointments" o "Feed" en inglés.
const pageName = computed(() => {
  const match = sections.value
    .flatMap((s) => s.items)
    .filter((i) => route.path === i.to || route.path.startsWith(`${i.to}/`))
    .sort((a, b) => b.to.length - a.to.length)[0];
  if (match) return match.label;
  const segment = route.path.split("/").filter(Boolean).at(-1) ?? "dashboard";

  const texto = EXTRA_TITLES[segment] ?? segment.replaceAll("-", " ");

  // Solo la primera letra en mayúscula («Lista de espera»); antes `capitalize` ponía cada palabra («Lista De Espera»).
  return texto.charAt(0).toUpperCase() + texto.slice(1);
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
        <strong>{{ pageName }}</strong>
      </div>
    </div>

    <ShellGlobalSearch />

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
      <NuxtLink to="/profile" class="ub-topbar-profile" title="Mi perfil">
        <img
          v-if="user?.avatar_url && !avatarFailed"
          referrerpolicy="no-referrer"
          :src="user.avatar_url"
          :alt="`Foto de ${user.name}`"
          class="ub-sidebar__avatar object-cover"
          @error="avatarFailed = true"
        >
        <span v-else class="ub-sidebar__avatar">{{
          (user?.name ?? "U").slice(0, 2).toUpperCase()
        }}</span>
        <span
          ><strong>{{ user?.name }}</strong
          ><small>{{ user?.roles.join(", ") }}</small></span
        >
      </NuxtLink>
    </div>
  </header>
</template>
