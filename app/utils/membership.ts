export interface IncludedService {
  service_id: string
  nombre: string | null
  precio: number
  usos: number
}

export interface MembershipUse {
  service_id: string
  nombre: string | null
  restantes: number
  totales: number
  vence_en: string | null
}

/** Texto de un servicio incluido: «2 × Corte Clásico al mes». */
export function includedLabel(item: Pick<IncludedService, 'nombre' | 'usos'>): string {
  return `${item.usos} × ${item.nombre ?? 'Servicio'} al mes`
}

/** Valor de lista de lo incluido en un mes. */
export function includedValue(items: Pick<IncludedService, 'precio' | 'usos'>[]): number {
  return Math.round(items.reduce((total, item) => total + item.precio * item.usos, 0) * 100) / 100
}

/** Lo que ahorra quien usa todo lo incluido; nunca negativo. */
export function includedSavings(listValue: number, monthlyPrice: number): number {
  return Math.max(0, Math.round((listValue - monthlyPrice) * 100) / 100)
}
