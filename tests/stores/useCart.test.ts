import { beforeEach, describe, expect, it } from 'vitest'
import { clearNuxtState } from '#app'
import { useCart } from '~/composables/useCart'
import type { CartProduct } from '~/composables/useCart'

/*
 * T086: el carrito es el «store» del cliente web: estado compartido con useState y respaldo en localStorage.
 * Se prueba su lógica sin pantalla: límites de existencias, cantidades, totales y la persistencia.
 */
const KEY = 'ub_cart'

const pomada: CartProduct = { id: 'p1', nombre: 'Pomada mate', precio_venta: 120, imagen: null, stock_actual: 5 }
const cera: CartProduct = { id: 'p2', nombre: 'Cera ligera', precio_venta: 80, imagen: '/images/cera.webp', stock_actual: 10 }
const sinControl: CartProduct = { id: 'p3', nombre: 'Peine', precio_venta: 40, imagen: null, stock_actual: 0 }

beforeEach(() => {
  localStorage.clear()
  clearNuxtState(['cart_items', 'cart_hydrated'])
})

describe('carrito de compras', () => {
  it('empieza vacío', () => {
    const cart = useCart()

    expect(cart.items.value).toEqual([])
    expect(cart.count.value).toBe(0)
    expect(cart.total.value).toBe(0)
  })

  it('agrega un producto y suma cantidad y total', () => {
    const cart = useCart()

    cart.add(pomada, 2)

    expect(cart.items.value).toHaveLength(1)
    expect(cart.items.value[0]).toMatchObject({ product_id: 'p1', nombre: 'Pomada mate', precio: 120, cantidad: 2 })
    expect(cart.count.value).toBe(2)
    expect(cart.total.value).toBe(240)
  })

  it('al agregar el mismo producto otra vez acumula la cantidad', () => {
    const cart = useCart()

    cart.add(pomada)
    cart.add(pomada, 2)

    expect(cart.items.value[0]!.cantidad).toBe(3)
  })

  it('no deja pasar de las existencias', () => {
    const cart = useCart()

    cart.add(pomada, 3)
    cart.add(pomada, 10)

    expect(cart.items.value[0]!.cantidad).toBe(5)
  })

  it('sin control de existencias (stock 0) agrega lo que se pida', () => {
    const cart = useCart()

    cart.add(sinControl, 3)

    expect(cart.items.value[0]!.cantidad).toBe(3)
  })

  it('suma varios productos distintos', () => {
    const cart = useCart()

    cart.add(pomada, 2)
    cart.add(cera, 1)

    expect(cart.count.value).toBe(3)
    expect(cart.total.value).toBe(320)
  })

  it('cambia la cantidad de un producto y la borra si llega a cero', () => {
    const cart = useCart()
    cart.add(pomada, 2)

    cart.updateQty('p1', 4)
    expect(cart.items.value[0]!.cantidad).toBe(4)

    cart.updateQty('p1', 0)
    expect(cart.items.value).toEqual([])
  })

  it('cambiar la cantidad de un producto que no está no hace nada', () => {
    const cart = useCart()
    cart.add(pomada)

    cart.updateQty('no-existe', 3)

    expect(cart.items.value).toHaveLength(1)
    expect(cart.count.value).toBe(1)
  })

  it('quita un producto sin tocar los demás', () => {
    const cart = useCart()
    cart.add(pomada)
    cart.add(cera)

    cart.remove('p1')

    expect(cart.items.value.map(i => i.product_id)).toEqual(['p2'])
  })

  it('vacía todo el carrito', () => {
    const cart = useCart()
    cart.add(pomada)
    cart.add(cera)

    cart.clear()

    expect(cart.items.value).toEqual([])
    expect(cart.total.value).toBe(0)
  })
})

describe('persistencia del carrito', () => {
  it('guarda el carrito en localStorage con cada cambio', () => {
    const cart = useCart()

    cart.add(pomada, 2)

    const guardado = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    expect(guardado.p1).toMatchObject({ product_id: 'p1', cantidad: 2, precio: 120 })
  })

  it('recupera el carrito guardado al abrir la página de nuevo', () => {
    localStorage.setItem(KEY, JSON.stringify({
      p2: { product_id: 'p2', nombre: 'Cera ligera', precio: 80, imagen: null, cantidad: 3, stockActual: 10 },
    }))

    const cart = useCart()

    expect(cart.items.value).toHaveLength(1)
    expect(cart.count.value).toBe(3)
    expect(cart.total.value).toBe(240)
  })

  it('si lo guardado está dañado, empieza con el carrito vacío sin fallar', () => {
    localStorage.setItem(KEY, '{esto no es json')

    const cart = useCart()

    expect(cart.items.value).toEqual([])
  })
})
