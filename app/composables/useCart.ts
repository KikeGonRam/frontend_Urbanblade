export interface CartItem {
  product_id: string
  nombre: string
  precio: number
  imagen: string | null
  cantidad: number
  stockActual: number
}

export interface CartProduct {
  id: string
  nombre: string
  precio_venta: number
  imagen: string | null
  stock_actual: number
}

const STORAGE_KEY = 'ub_cart'

/*
 * Carrito de compras del cliente. A diferencia de CartService (web, vive en
 * sesión de Laravel), un cliente Bearer-token no tiene sesión de servidor
 * — el carrito vive por completo en este navegador (localStorage), igual
 * de "solo un borrador": el precio final SIEMPRE lo recalcula
 * OrderService::place() en barber al hacer checkout (POST /orders), nunca
 * se confía en lo que haya aquí para cobrar de verdad. useState() comparte
 * el mismo carrito entre StoreIndex/CartIndex/el badge del sidebar sin
 * pasar props, igual que useShellState().
 */
export function useCart() {
  const items = useState<Record<string, CartItem>>('cart_items', () => ({}))
  const hydrated = useState('cart_hydrated', () => false)

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items.value))
    } catch {
      // localStorage puede fallar (modo privado, storage bloqueado) — el
      // carrito sigue funcionando en memoria para esta sesión de pestaña.
    }
  }

  function hydrate() {
    if (hydrated.value) return
    hydrated.value = true
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) items.value = JSON.parse(raw)
    } catch {
      // ver comentario en persist().
    }
  }

  hydrate()

  function add(product: CartProduct, qty = 1) {
    const current = items.value[product.id]?.cantidad ?? 0
    const max = product.stock_actual > 0 ? product.stock_actual : current + qty
    const nueva = Math.max(1, Math.min(current + qty, max))

    items.value = {
      ...items.value,
      [product.id]: {
        product_id: product.id,
        nombre: product.nombre,
        precio: product.precio_venta,
        imagen: product.imagen,
        cantidad: nueva,
        stockActual: product.stock_actual,
      },
    }
    persist()
  }

  function withoutProduct(productId: string) {
    return Object.fromEntries(Object.entries(items.value).filter(([id]) => id !== productId))
  }

  function updateQty(productId: string, qty: number) {
    if (qty <= 0) {
      items.value = withoutProduct(productId)
    } else if (items.value[productId]) {
      items.value = { ...items.value, [productId]: { ...items.value[productId], cantidad: qty } }
    }
    persist()
  }

  function remove(productId: string) {
    items.value = withoutProduct(productId)
    persist()
  }

  function clear() {
    items.value = {}
    persist()
  }

  const list = computed(() => Object.values(items.value))
  const count = computed(() => list.value.reduce((sum, i) => sum + i.cantidad, 0))
  const total = computed(() => list.value.reduce((sum, i) => sum + i.precio * i.cantidad, 0))

  return { items: list, count, total, add, updateQty, remove, clear }
}
