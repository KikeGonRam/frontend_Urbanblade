export type PaymentMethod = "efectivo" | "transferencia" | "tarjeta";

export const METODO_LABEL: Record<string, string> = {
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
  transferencia: "Transferencia",
  otro: "Otro",
};

export interface PaymentRow {
  id: string;
  // Payment::$monto/$propina usan el cast decimal:2 de Laravel, que
  // siempre serializa como string ("225.00") para no perder precisión —
  // nunca sumar/restar directo sin Number(), "225.00" + "0.00" concatena.
  monto: string;
  metodo_pago: string;
  propina: string;
  receipt_url: string | null;
  created_at: string | null;
  appointment: {
    id: string | null;
    fecha: string | null;
    hora_inicio: string | null;
    service: string | null;
    client: string | null;
    barber: string | null;
  };
  creator: { id: string | null; name: string | null };
  // Solo en el historial de anulados (GET /payments?anulados=1, administrador): el cobro se
  // conserva con su motivo, quién lo anuló y cuándo (anulación lógica, hallazgo 13).
  anulacion?: { motivo: string | null; fecha: string | null; por: string | null } | null;
}

export interface PaymentStats {
  total_hoy: number;
  total_mes: number;
  count: number;
  metodos: Record<string, number>;
}

export interface PaymentsResponse {
  data: PaymentRow[];
  meta: {
    current_page: number;
    last_page: number;
    total: number;
    stats: PaymentStats;
    pending_count: number;
    // Cuántos cobros anulados hay; null para quien no es administrador.
    anulados_count?: number | null;
  };
}

export interface ChargeableAppointment {
  id: string;
  code: string | null;
  fecha: string;
  hora_inicio: string;
  client_name: string | null;
  barber_name: string | null;
  service_name: string | null;
  precio: number;
  nivel: string;
  nivel_label: string;
  nivel_pct: number;
  puntos_disponibles: number;
  premio_rifa: string | null;
  paquete_disponible: { id: string; usos_restantes: number; origen?: 'paquete' | 'membresia' } | null;
}

export interface PaymentBarber {
  id: string;
  name: string;
}

// Se venden junto con el cobro (POST /payments { productos }) como pedido de
// la cita; con tarjeta no aplican porque el intento de Stripe solo cubre el
// servicio.
export interface ProductoSugerido {
  id: string;
  nombre: string;
  precio_venta: number;
  imagen?: string | null;
  stock_actual: number;
}

export interface ChargeForm {
  appointmentId: string;
  propina: number;
  puntosCanjear: number;
  usarPremioRifa: boolean;
  // Igual que usarPremioRifa: cubre el 100% del servicio, así que no se
  // combina con puntos ni con gift card (backend ya lo valida, ver
  // PaymentService::create()).
  usarPaquete: boolean;
  // A diferencia del paquete/premio de rifa (cubren el 100%, incompatibles
  // con tarjeta porque dejarían $0 a cobrar), la gift card es parcial por
  // diseño -- stripeIntent() en barber sí la combina con tarjeta para el
  // remanente (ver PaymentController::stripeIntent()).
  codigoGiftCard: string;
  metodo: PaymentMethod;
  stripePaymentId: string;
}
