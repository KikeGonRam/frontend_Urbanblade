import type { ComputedRef, Ref } from 'vue'
import type { ProductRow, ServiceRow } from '~/types/booking'

// Propina sugerida: se calcula sobre el precio YA con descuento (mismo criterio que
// loyaltyCharge.ts usa en recepcion: descuento primero, propina despues).
export const BOOKING_TIP_PRESETS = [0, 0.10, 0.15, 0.20] as const

export interface BookingPricing {
  selectedProductIds: Ref<Set<string>>
  toggleProduct: (id: string) => void
  selectedProducts: ComputedRef<ProductRow[]>
  membershipDiscountPct: ComputedRef<number>
  discountedServicePrice: ComputedRef<number>
  tipPreset: Ref<number>
  customTip: Ref<string>
  usingCustomTip: ComputedRef<boolean>
  tipAmount: ComputedRef<number>
  pickTipPreset: (pct: number) => void
  grandTotal: ComputedRef<number>
  /** Monto que se cobra al "pagar ahora": servicio con descuento + propina (los productos se pagan en el salón). */
  payAmountToCharge: ComputedRef<number>
}

/**
 * Totales que se muestran al cliente. Son solo una referencia honesta: el servidor (PaymentService /
 * LoyaltyService) es la autoridad al cobrar.
 */
export function useBookingPricing(
  selectedService: ComputedRef<ServiceRow | null>,
  suggestedProducts: ComputedRef<ProductRow[]>,
): BookingPricing {
  const { user } = useAuth()

  const selectedProductIds = ref<Set<string>>(new Set())
  function toggleProduct(id: string) {
    const next = new Set(selectedProductIds.value)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    selectedProductIds.value = next
  }
  const selectedProducts = computed(() =>
    suggestedProducts.value.filter(p => selectedProductIds.value.has(p.id)),
  )
  const productsTotal = computed(() => selectedProducts.value.reduce((sum, p) => sum + p.precio_venta, 0))

  // Descuento de membresia/lealtad: el mismo % que ya calcula PaymentService al cobrar (ver
  // LoyaltyService::bestDiscountPct) -- se muestra aqui solo como referencia honesta de cuanto va a
  // pagar realmente, sea que pague ahora o despues.
  const membershipDiscountPct = computed(() => user.value?.client?.descuento_activo_pct ?? 0)
  const discountedServicePrice = computed(() => {
    const base = selectedService.value?.precio ?? 0
    return membershipDiscountPct.value > 0
      ? Math.round(base * (1 - membershipDiscountPct.value / 100) * 100) / 100
      : base
  })

  const tipPreset = ref<number>(0)
  const customTip = ref<string>('')
  const usingCustomTip = computed(() => customTip.value !== '')
  const tipAmount = computed(() => {
    if (usingCustomTip.value) {
      const parsed = Number(customTip.value)
      return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
    }
    return Math.round(discountedServicePrice.value * tipPreset.value)
  })
  function pickTipPreset(pct: number) {
    tipPreset.value = pct
    customTip.value = ''
  }

  const grandTotal = computed(() => discountedServicePrice.value + productsTotal.value + tipAmount.value)
  const payAmountToCharge = computed(() => discountedServicePrice.value + tipAmount.value)

  return {
    selectedProductIds,
    toggleProduct,
    selectedProducts,
    membershipDiscountPct,
    discountedServicePrice,
    tipPreset,
    customTip,
    usingCustomTip,
    tipAmount,
    pickTipPreset,
    grandTotal,
    payAmountToCharge,
  }
}
