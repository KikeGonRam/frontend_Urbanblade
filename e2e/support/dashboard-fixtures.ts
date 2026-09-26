/**
 * Respuestas de GET /dashboard por rol para las pruebas y capturas del kit de dashboards
 * (skill urbanblade-ui-kit, fase 2). Mismo contrato que DashboardController en barber.
 */
export const ADMIN_DASHBOARD = {
  role: "administrador",
  data: {
    todayLabel: "Sábado 26 de septiembre",
    kpis: {
      appointments_today: 8,
      appointments_week: 41,
      appointments_month: 152,
      appointment_growth: 12.5,
      income_today: 2340,
      income_week: 14820,
      income_month: 58640,
      income_growth: -4.2,
      top_barber_name: "Nava Panther",
      top_barber_total: 62,
      new_clients: 23,
      recurring_clients: 61,
      total_clients: 312,
      active_clients: 184,
      retention_rate: 72.6,
      low_stock_count: 3,
      barbers_status: [
        { name: "Nava Panther", is_busy: true, progress: 60 },
        { name: "Luis Enrique", is_busy: false, progress: 0 },
        { name: "Bruno Díaz", is_busy: true, progress: 25 },
      ],
    },
    incomeChart: {
      labels: ["03 Aug", "10 Aug", "17 Aug", "24 Aug", "31 Aug", "07 Sep", "14 Sep", "21 Sep"],
      values: [11200, 12850, 10400, 13900, 15100, 14300, 15480, 14820],
    },
    servicesChart: {
      labels: ["Corte Clásico", "Fade", "Barba", "Combo Corte + Barba", "Tinte"],
      values: [48, 36, 22, 30, 9],
    },
    barberPerformance: {
      labels: ["Nava Panther", "Luis Enrique", "Bruno Díaz"],
      appointments: [62, 48, 42],
      revenue: [18400, 14100, 12900],
    },
    clientTrends: {
      labels: ["01 Sep", "04 Sep", "07 Sep", "10 Sep", "13 Sep", "16 Sep", "19 Sep", "22 Sep", "25 Sep", "28 Sep", "01 Oct", "04 Oct"],
      values: [9, 12, 8, 14, 11, 16, 13, 18, 15, 0, 0, 0],
    },
    chatbotTelemetry: { window_days: 7, total_requests: 214, error_rate_pct: 1.4, avg_latency_ms: 5200, estimated_cost_usd: 0, top_sources: { ollama: 120, manual: 70, memory: 24 } },
    todayAppointments: [
      { id: "a1", estado: "completada", hora_inicio: "10:00", hora_fin: "10:30", cliente: "Carlos Ruiz", servicio: "Corte Clásico", barbero: "Nava Panther" },
      { id: "a2", estado: "en_proceso", hora_inicio: "12:00", hora_fin: "12:45", cliente: "Mario León", servicio: "Fade", barbero: "Bruno Díaz" },
      { id: "a3", estado: "confirmada", hora_inicio: "16:00", hora_fin: "17:00", cliente: "Ana Torres", servicio: "Combo Corte + Barba", barbero: "Luis Enrique" },
      { id: "a4", estado: "pendiente", hora_inicio: "18:30", hora_fin: "19:00", cliente: "Diego Prado", servicio: "Barba", barbero: "Nava Panther" },
    ],
    recentAppointments: [
      { id: "r1", estado: "completada", hora_inicio: "10:00", fecha: "2026-09-26", cliente: "Carlos Ruiz", barberoInicial: "N", cliente_avatar_url: null },
      { id: "r2", estado: "cancelada", hora_inicio: "11:00", fecha: "2026-09-26", cliente: "Luis Gómez", barberoInicial: "B", cliente_avatar_url: null },
      { id: "r3", estado: "confirmada", hora_inicio: "16:00", fecha: "2026-09-26", cliente: "Ana Torres", barberoInicial: "L", cliente_avatar_url: null },
    ],
    insights: [
      { titulo: "Hora pico", dato: "18:00", detalle: "La mayoría de las reservas de la semana." },
      { titulo: "Servicio estrella", dato: "Corte Clásico", detalle: "48 citas este mes." },
    ],
    sparkHighlights: [],
  },
};

export const RECEPTION_DASHBOARD = {
  role: "recepcionista",
  data: {
    todayLabel: "Sábado 26 de septiembre",
    kpis: { appointments_today: 8, collected_today: 2340, pending_payments: 2, pending_orders: 1, new_clients_today: 3, low_stock_count: 3 },
    nextAppointments: [
      { id: "n1", hora_inicio: "16:00:00", cliente: "Ana Torres", servicio: "Combo Corte + Barba", barbero: "Luis Enrique" },
      { id: "n2", hora_inicio: "18:30:00", cliente: "Diego Prado", servicio: "Barba", barbero: "Nava Panther" },
    ],
    pendingOrders: [{ id: "o-1", folio: "PED-0001", cliente: "Cliente Prueba", creadoEn: "25/09 10:00", itemsCount: 1, total: 250 }],
    flowChart: { labels: ["9", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20"], values: [0, 1, 1, 2, 0, 1, 0, 1, 0, 2, 0, 0] },
    sparkHighlights: [],
  },
};

export const BARBER_DASHBOARD = {
  role: "barbero",
  data: {
    todayLabel: "Sábado 26 de septiembre",
    kpis: { appointments_today: 3, appointments_month: 41, income_month: 14100, tips_month: 1350, rating: 4.8 },
    performanceChart: { labels: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], values: [0, 4, 6, 3, 5, 7, 3] },
    servicesChart: { labels: ["Fade", "Corte Clásico", "Barba"], values: [22, 30, 12] },
    barberToday: [
      { id: "b1", code: "UB-1", estado: "completada", hora_inicio: "10:00:00", hora_fin: "10:30:00", cliente: "Carlos Ruiz", servicio: "Corte Clásico", isNext: false },
      { id: "b2", code: "UB-2", estado: "confirmada", hora_inicio: "16:00:00", hora_fin: "17:00:00", cliente: "Ana Torres", servicio: "Combo Corte + Barba", isNext: true },
    ],
    barberPending: [{ id: "p1", code: "UB-9", fecha: "27/09", hora_inicio: "11:00:00", cliente: "Mario León", servicio: "Fade" }],
    sparkHighlights: [
      { titulo: "Tu hora más pedida", dato: "18:00", color: "gold", visual_label: "Indicador", mensaje: "Los sábados a las 18:00 se llenan primero.", brief: "Los sábados a las 18:00 se llenan primero.", is_truncated: false, progress_value: null },
    ],
  },
};

export const CLIENT_DASHBOARD = {
  role: "cliente",
  data: {
    todayLabel: "Sábado 26 de septiembre",
    kpis: { total_appointments: 12, completed_appointments: 10, completion_rate: 83.3, cancellation_rate: 8.3, favorite_barber: "Nava Panther", membership_status: "activa" },
    nextAppointment: {
      id: "n1", fecha: "2026-09-28", hora_inicio: "16:00:00", estado: "confirmada",
      service: { nombre: "Combo Corte + Barba" }, barber: { user: { name: "Nava Panther" } },
      day: "28", monthShort: "sep", dateLong: "lunes 28 de septiembre", canManage: true,
    },
    visitChart: { labels: ["abr", "may", "jun", "jul", "ago", "sep"], values: [1, 2, 1, 3, 2, 3] },
    loyalty: {
      nivel: "regular", nivelLabel: "Regular", puntos: 120, discountPct: 5, nextNivel: "vip", nextNivelLabel: "V.I.P",
      citasFaltan: 2, progressPct: 60,
      recentTransactions: [{ descripcion: "Cita completada", puntos: 10 }, { descripcion: "Canje en cobro", puntos: -50 }],
      wonRaffle: null,
    },
    member: { number: "UB-000123", since: "2026", qr: null, downloadUrl: null },
    recommendation: { valorDestacado: "Arreglo de Barba", mensaje: "Clientes con tu historial suelen sumar un arreglo de barba cada tres cortes." },
    sparkHighlights: [],
  },
};

export const ENGINEER_DASHBOARD = {
  role: "ingeniero",
  data: {
    ...ADMIN_DASHBOARD.data,
    moduleTelemetry: {
      window_days: 30,
      payments: { verified_month: 128, pending_review: 2, rejected_month: 1, amount_month: 58640 },
      orders: { pending: 1, delivered_month: 14, cancelled_month: 1 },
      campaigns: { scheduled: 1, sent_month: 3, recipients_month: 240, opens_month: 96, clicks_month: 21 },
      raffles: { redeemable: 1, claimed_month: 1, expired_unclaimed: 0 },
      social: { works_month: 9, reactions_month: 64, comments_month: 12, saves_month: 8 },
    },
  },
};

export const SYSTEM_STATUS = {
  database: { status: "up", latency_ms: 42 },
  redis: { status: "up", latency_ms: 3 },
  queue: { pending: 0, failed: 0 },
  scheduled_tasks: [{ status: "success" }],
};
