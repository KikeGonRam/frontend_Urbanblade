/*
 * Estado del shell (rail del sidebar colapsable + acordeón de secciones +
 * drawer móvil), portado del x-data de barber/resources/views/app.blade.php.
 * useState() lo comparte entre AppSidebar/MobileTopbar/MobileBottomNav/
 * MobileDrawer sin pasar props en cascada; localStorage replica la
 * persistencia que allá daba Alpine.
 */
export function useShellState() {
  const railCollapsed = useState('shell_rail_collapsed', () => false)
  const openSections = useState<Record<string, boolean>>('shell_open_sections', () => ({}))
  const drawerOpen = useState('shell_drawer_open', () => false)

  onMounted(() => {
    try {
      railCollapsed.value = localStorage.getItem('sidebarRail') === 'true'
    } catch {
      // localStorage puede fallar (modo privado, storage bloqueado) — se
      // queda con el default (rail expandido) sin romper el shell.
    }
  })

  function toggleRail() {
    railCollapsed.value = !railCollapsed.value
    try {
      localStorage.setItem('sidebarRail', String(railCollapsed.value))
    } catch {
      // ver comentario en onMounted — persistencia es best-effort.
    }
  }

  function initSection(key: string, active: boolean) {
    if (key in openSections.value) return

    try {
      const stored = localStorage.getItem(`nav_sec_${key}`)
      openSections.value[key] = active ? true : stored === 'true'
    } catch {
      openSections.value[key] = active
    }
  }

  function toggleSection(key: string) {
    openSections.value[key] = !openSections.value[key]
    try {
      localStorage.setItem(`nav_sec_${key}`, String(openSections.value[key]))
    } catch {
      // best-effort, ver arriba.
    }
  }

  return { railCollapsed, toggleRail, openSections, initSection, toggleSection, drawerOpen }
}
