/** Tipos compartidos del asistente de reserva (`BookingWizard` y sus pasos). */
import type { ChoiceOption } from '~/types/choice'

export interface ServiceRow {
  id: string
  nombre: string
  categoria: string | null
  precio: number
  duracion_min: number
  descripcion: string | null
  imagen: string | null
}

export interface BarberRow {
  id: string
  slug: string | null
  user: { id: string, name: string } | null
  especialidades: string | null
  foto: string | null
  avg_rating: number | null
  total_reviews: number
  citas_conmigo: number | null
  es_favorito: boolean
}

export interface ProductRow {
  id: string
  nombre: string
  categoria: string | null
  descripcion: string | null
  precio_venta: number
  stock_actual: number
  imagen: string | null
}

export interface Slot { time: string, label: string }

export interface Barbershop {
  nombre: string | null
  direccion: string | null
  telefono: string | null
  horario_apertura: string | null
  horario_cierre: string | null
  politica_cancelacion: number | null
}

export interface DayOption {
  iso: string
  weekday: string
  day: number
  month: string
  isToday: boolean
}

export interface SlotGroup {
  key: string
  label: string
  max: number
  slots: Slot[]
}

export type PayChoice = 'despues' | 'ahora_tarjeta' | 'ahora_transferencia'
export type PayOption = ChoiceOption<PayChoice>
