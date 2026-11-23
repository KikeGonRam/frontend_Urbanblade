<script setup lang="ts">
/*
 * Alerta «Productos con stock bajo» con la acción «Marcar como pedido»,
 * compartida por /inventory/products y /inventory/movements (antes cada página
 * tenía su copia). Consume GET /inventory/low-stock y
 * POST /inventory/products/{id}/mark-ordered, sin cambios de API.
 *
 * Cada página decide cómo mostrar el resultado: escucha `mark-start`, `marked`
 * y `mark-error`. Para recargar la lista desde fuera (tras guardar un producto
 * o un movimiento) se expone `refresh()`.
 */
export interface LowStockItem {
  id: string
  nombre: string
  stock_actual: number
  stock_minimo: number
  categoria?: string
  pending_restock: boolean
  ordered_at?: string | null
}

const emit = defineEmits<{
  'mark-start': [item: LowStockItem]
  marked: [item: LowStockItem]
  'mark-error': [message: string]
}>()

const { apiFetch } = useApi()

const { data, refresh } = useLazyAsyncData(
  'inventory-low-stock',
  () => apiFetch<{ data: LowStockItem[] }>('/inventory/low-stock'),
)
const items = computed(() => data.value?.data ?? [])

const marking = ref<string | null>(null)

async function markOrdered(item: LowStockItem) {
  marking.value = item.id
  emit('mark-start', item)
  try {
    await apiFetch(`/inventory/products/${item.id}/mark-ordered`, { method: 'POST' })
    await refresh()
    emit('marked', item)
  } catch (err: unknown) {
    emit(
      'mark-error',
      (err as { data?: { message?: string } })?.data?.message ?? 'No se pudo marcar el producto como pedido.',
    )
  } finally {
    marking.value = null
  }
}

defineExpose({ refresh })
</script>

<template>
  <section
    v-if="items.length"
    class="mb-5 overflow-hidden rounded-2xl border border-warning/25 bg-warning/5"
  >
    <div class="flex items-center gap-3 border-b border-warning/15 px-5 py-3">
      <span class="text-sm font-black text-warning">Productos con stock bajo pendientes de atención</span>
    </div>
    <ul class="divide-y divide-warning/10">
      <li
        v-for="item in items"
        :key="item.id"
        class="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <p class="text-sm font-bold text-ink">{{ item.nombre }}</p>
          <p class="text-xs text-muted">
            {{ item.stock_actual }} en existencia / mín {{ item.stock_minimo }}
          </p>
        </div>
        <span
          v-if="item.pending_restock"
          class="w-fit rounded-full border border-success/25 bg-success/10 px-3 py-1 text-xs font-black uppercase tracking-widest text-success"
        >
          Pedido en curso
        </span>
        <button
          v-else
          type="button"
          :disabled="marking === item.id"
          class="w-fit rounded-lg border border-warning/30 px-3 py-1 text-xs font-bold text-warning hover:bg-warning/10 disabled:opacity-50"
          @click="markOrdered(item)"
        >
          {{ marking === item.id ? 'Marcando…' : 'Marcar como pedido' }}
        </button>
      </li>
    </ul>
  </section>
</template>
