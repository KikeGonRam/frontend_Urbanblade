import type { DashboardInsight } from "~/components/dashboard/AnalyticsInsights.vue";

/** Series de una gráfica: etiquetas y valores en paralelo. */
export interface ChartSeriesData {
  labels: string[];
  values: number[];
}

export interface BarberStatus {
  name: string;
  is_busy: boolean;
  progress: number;
}

/** KPIs que GET /dashboard entrega a administrador e ingeniero. */
export interface DashboardKpis {
  appointments_today: number;
  appointments_week: number;
  appointments_month: number;
  appointment_growth: number;
  income_today: number;
  income_week: number;
  income_month: number;
  income_growth: number;
  top_barber_name: string | null;
  top_barber_total: number;
  new_clients: number;
  recurring_clients: number;
  total_clients: number;
  active_clients: number;
  retention_rate: number;
  low_stock_count: number;
  barbers_status: BarberStatus[];
}

export interface BarberPerformanceData {
  labels: string[];
  appointments: number[];
  revenue: number[];
}

export interface ChatbotTelemetry {
  window_days?: number;
  total_requests?: number;
  error_rate_pct?: number;
  avg_latency_ms?: number;
  estimated_cost_usd?: number;
  top_sources?: Record<string, number>;
}

export interface SimpleInsightRow {
  titulo: string;
  dato: string;
  detalle: string;
}

export interface TodayAppointment {
  id: string;
  code: string;
  estado: string;
  hora_inicio: string;
  hora_fin: string;
  cliente: string;
  servicio: string;
  barbero: string;
}

export interface RecentAppointment {
  id: string;
  code: string;
  estado: string;
  hora_inicio: string;
  fecha: string;
  cliente: string;
  barberoInicial: string;
  cliente_avatar_url?: string | null;
}

export interface AdminData {
  todayLabel: string;
  kpis: DashboardKpis;
  incomeChart: ChartSeriesData;
  servicesChart: ChartSeriesData;
  barberPerformance: BarberPerformanceData;
  clientTrends: ChartSeriesData;
  chatbotTelemetry: ChatbotTelemetry;
  todayAppointments: TodayAppointment[];
  recentAppointments: RecentAppointment[];
  insights: SimpleInsightRow[];
  sparkHighlights: DashboardInsight[];
}

export interface ModuleTelemetryRaw {
  window_days?: number;
  payments?: {
    verified_month?: number;
    pending_review?: number;
    rejected_month?: number;
    amount_month?: number;
  };
  orders?: {
    pending?: number;
    delivered_month?: number;
    cancelled_month?: number;
  };
  campaigns?: {
    scheduled?: number;
    sent_month?: number;
    recipients_month?: number;
    opens_month?: number;
    clicks_month?: number;
  };
  raffles?: {
    redeemable?: number;
    claimed_month?: number;
    expired_unclaimed?: number;
  };
  social?: {
    works_month?: number;
    reactions_month?: number;
    comments_month?: number;
    saves_month?: number;
  };
}

export interface IngenieroData {
  todayLabel: string;
  kpis: DashboardKpis;
  incomeChart: ChartSeriesData;
  servicesChart: ChartSeriesData;
  barberPerformance: BarberPerformanceData;
  clientTrends: ChartSeriesData;
  chatbotTelemetry: ChatbotTelemetry;
  moduleTelemetry?: ModuleTelemetryRaw;
  insights: SimpleInsightRow[];
  sparkHighlights: DashboardInsight[];
}

export interface SystemStatusSummary {
  database: { status: "up" | "down"; latency_ms: number | null };
  redis: { status: "up" | "down"; latency_ms: number | null };
  queue: { pending: number | null; failed: number | null };
  scheduled_tasks: Array<{ status: "success" | "failed" | "unknown" }>;
}
