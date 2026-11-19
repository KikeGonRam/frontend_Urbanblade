/** Tipos de la portada pública (datos de /services, /barbers y /barbershop). */

export interface LandingService {
  id: string
  nombre: string
  categoria: string | null
  precio: number
  duracion_min: number
  descripcion: string | null
  /** URL pública de la foto del servicio (CatalogController::services). */
  imagen: string | null
}

export interface LandingBarber {
  id: string
  slug: string | null
  user: { id: string, name: string } | null
  especialidades: string
  foto: string | null
  avg_rating?: number | null
  total_reviews?: number
}

/** Ficha del negocio (GET /barbershop, pública y sin token). */
export interface LandingBarbershop {
  nombre: string | null
  direccion: string | null
  telefono: string | null
  horario_apertura: string | null
  horario_cierre: string | null
  redes_sociales: Record<string, string | null> | null
}

export interface LandingPublicStats {
  barbers: number
  services: number
  reviews: number
  rating: string
}

export interface LandingStat {
  value: string | number
  suffix: string
  label: string
}

export interface LandingContactRow {
  label: string
  lines: string[]
  mutedLastLine?: boolean
}

export interface LandingSocial {
  network: string
  url: string
}
