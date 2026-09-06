export interface NavItem {
  label: string
  to: string
  icon: string
  primary: boolean
  badge: number | null
  /** false = la página aún no existe en este repo (fases futuras); se muestra deshabilitado. */
  implemented: boolean
}

export interface NavSection {
  key: string
  title: string
  collapsible: boolean
  items: NavItem[]
}

/*
 * Paths de íconos (viewBox 24x24, stroke-width 1.5) — copiados tal cual de
 * barber/app/Helpers/NavigationMenu.php (ICONS), son solo datos SVG, no
 * dependen de Blade/Alpine.
 */
const ICONS: Record<string, string> = {
  dashboard: '<path d="M3 12l9-8 9 8v8a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />',
  wall: '<path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />',
  appointments: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/>',
  calendar: '<path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/><circle cx="12" cy="15" r="2"/>',
  clients: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  payments: '<path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />',
  orders: '<path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m-6 9l2 2 4-4"/>',
  movements: '<path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4"/><path d="M4 6v12a2 2 0 0 0 2 2h14v-4"/><path d="M18 12a2 2 0 0 0-2 2c0 1.1.9 2 2 2h4v-4h-4z"/>',
  barbers: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  users: '<path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>',
  services: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
  products: '<path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 1v6m0 6v6M4.22 4.22l4.24 4.24m5.08 5.08l4.24 4.24M1 12h6m6 0h6M4.22 19.78l4.24-4.24m5.08-5.08l4.24-4.24"/>',
  reports: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>',
  campaigns: '<path d="M3 8l7.89 5.26a2 2 0 0 0 2.22 0L21 8M5 19h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2z"/>',
  logs: '<polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>',
  agenda: '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  schedule: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  profile: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  my_appointments: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  cart: '<path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/>',
  barbers_client: '<path stroke-linecap="round" stroke-linejoin="round" d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758L5 19m0-14l4.121 4.121"/><circle cx="17" cy="7" r="3"/>',
  invoices: '<path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>',
  analytics: '<path d="M3 3v18h18"/><path d="M18.7 8.3l-4.2 4.2-2.8-2.8L7 14.4"/>',
  reviews: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  raffles: '<circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/>',
}

/** Único path real hoy — todo lo demás se muestra pero deshabilitado ("Próximamente") hasta su fase. */
const IMPLEMENTED_PATHS = new Set([
  '/dashboard', '/appointments', '/appointments/calendar', '/clients', '/payments',
  '/orders', '/store', '/cart', '/my/orders', '/inventory/products', '/inventory/movements',
  '/services', '/users',
  '/barber/agenda', '/barber/portfolio', '/barber/schedule', '/barber/profile',
  '/my/appointments', '/barbers', '/my/invoices',
])

function item(label: string, to: string, icon: string, primary = false, badge: number | null = null): NavItem {
  return { label, to, icon: ICONS[icon] ?? '', primary, badge, implemented: IMPLEMENTED_PATHS.has(to) }
}

/**
 * Mismas secciones/roles que barber/app/Helpers/NavigationMenu.php::sections(),
 * adaptado a rutas Nuxt (este repo elige su propio esquema de URLs, no
 * reutiliza los nombres de ruta de Laravel). Los ítems fuera de fase 3
 * (todo salvo /dashboard) quedan visibles pero `implemented: false` — el
 * shell ya muestra la navegación completa por rol, las páginas se activan
 * fase a fase.
 */
export function useNavigation() {
  const { user, hasRole } = useAuth()

  const isAdmin = computed(() => hasRole('administrador'))
  const isReception = computed(() => hasRole('recepcionista'))
  const isBarber = computed(() => hasRole('barbero'))
  const isClient = computed(() => hasRole('cliente'))

  const sections = computed<NavSection[]>(() => {
    if (!user.value) return []

    const out: NavSection[] = []

    out.push({
      key: 'principal',
      title: 'Principal',
      collapsible: false,
      items: [
        item('Dashboard', '/dashboard', 'dashboard', true),
        item('Muro Inspiración', '/social/feed', 'wall'),
      ],
    })

    if (isAdmin.value || isReception.value) {
      out.push({
        key: 'operacion',
        title: 'Operación',
        collapsible: true,
        items: [
          item('Citas', '/appointments', 'appointments', true),
          item('Calendario', '/appointments/calendar', 'calendar'),
          item('Clientes', '/clients', 'clients', isAdmin.value),
          item('Pagos', '/payments', 'payments', true),
          item('Pedidos', '/orders', 'orders', isReception.value),
          item('Movimientos', '/inventory/movements', 'movements'),
          ...(isReception.value ? [item('Analítica', '/analytics', 'analytics')] : []),
        ],
      })
    }

    if (isAdmin.value) {
      out.push({
        key: 'gestion',
        title: 'Gestión',
        collapsible: true,
        items: [
          item('Barberos', '/barbers', 'barbers'),
          item('Reseñas', '/reviews', 'reviews'),
          item('Usuarios', '/users', 'users'),
          item('Servicios', '/services', 'services'),
          item('Productos', '/inventory/products', 'products'),
          item('Configuración', '/settings', 'settings'),
        ],
      })
      out.push({
        key: 'analisis',
        title: 'Análisis',
        collapsible: true,
        items: [
          item('Analítica', '/analytics', 'analytics'),
          item('Reportes', '/reports', 'reports'),
          item('Campañas', '/campaigns', 'campaigns'),
          item('Sorteos', '/raffles', 'raffles'),
          item('Logs', '/logs', 'logs'),
        ],
      })
    }

    if (isBarber.value) {
      out.push({
        key: 'mi-espacio',
        title: 'Mi Espacio',
        collapsible: true,
        items: [
          item('Mi Agenda', '/barber/agenda', 'agenda', true),
          item('Mi Portafolio', '/barber/portfolio', 'wall', true),
          item('Mi Horario', '/barber/schedule', 'schedule', true),
          item('Mi Perfil', '/barber/profile', 'profile'),
          item('Mi Analítica', '/analytics', 'analytics'),
        ],
      })
    }

    if (isClient.value) {
      out.push({
        key: 'mi-cuenta',
        title: 'Mi Cuenta',
        collapsible: true,
        items: [
          item('Mis Citas', '/my/appointments', 'my_appointments', true),
          item('Tienda', '/store', 'products'),
          item('Carrito', '/cart', 'cart', true),
          item('Mis Pedidos', '/my/orders', 'orders'),
          item('Nuestros Barberos', '/barbers', 'barbers_client', true),
          item('Mis Facturas', '/my/invoices', 'invoices'),
          item('Recomendado para ti', '/analytics', 'analytics'),
        ],
      })
    }

    return out
  })

  const primaryItems = computed<NavItem[]>(() =>
    sections.value.flatMap((s) => s.items.filter((i) => i.primary)).slice(0, 4),
  )

  return { sections, primaryItems }
}
