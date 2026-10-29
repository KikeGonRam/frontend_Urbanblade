<script setup lang="ts" generic="T extends Record<string, any>">
/*
 * Tabla común de la plataforma (auditoría UI/UX A-06): encabezado fijo, orden por columna, esqueleto de carga,
 * estado vacío con mascota y, en pantallas angostas, cada fila como tarjeta con sus etiquetas. Cada pantalla
 * solo declara columnas y, si hace falta, el contenido de cada celda con la ranura `cell-<clave>`; las acciones
 * van en la ranura `actions` (acción principal visible y el resto en UiRowMenu).
 */
export interface DataTableColumn {
  key: string
  label: string
  align?: 'left' | 'right' | 'center'
  /** Permite ordenar por esta columna (en el cliente, con el valor `row[key]`). */
  sortable?: boolean
  /** Oculta la columna por debajo de este ancho (md, lg). */
  hideBelow?: 'md' | 'lg'
}

const props = withDefaults(defineProps<{
  columns: DataTableColumn[]
  rows: T[]
  rowKey?: string
  loading?: boolean
  skeletonRows?: number
  ariaLabel: string
  emptyTitle?: string
  emptyDescription?: string
  /** Etiqueta de la columna de acciones (vacía si no hay ranura `actions`). */
  actionsLabel?: string
}>(), {
  rowKey: 'id',
  loading: false,
  skeletonRows: 8,
  emptyTitle: 'Sin resultados',
  emptyDescription: 'Cambia los filtros para ver otros registros.',
  actionsLabel: 'Acciones',
})

const slots = useSlots()
const sort = defineModel<{ key: string, dir: 'asc' | 'desc' } | null>('sort', { default: null })

const ordenadas = computed(() => {
  const s = sort.value
  if (!s) return props.rows
  const factor = s.dir === 'asc' ? 1 : -1

  return [...props.rows].sort((a, b) => {
    const x = a[s.key]
    const y = b[s.key]
    if (x == null && y == null) return 0
    if (x == null) return 1
    if (y == null) return -1

    return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'es', { numeric: true })) * factor
  })
})

function alternarOrden(col: DataTableColumn) {
  if (!col.sortable) return
  const actual = sort.value
  if (!actual || actual.key !== col.key) sort.value = { key: col.key, dir: 'asc' }
  else if (actual.dir === 'asc') sort.value = { key: col.key, dir: 'desc' }
  else sort.value = null
}

function ariaSort(col: DataTableColumn): 'ascending' | 'descending' | 'none' | undefined {
  if (!col.sortable) return undefined
  if (sort.value?.key !== col.key) return 'none'

  return sort.value.dir === 'asc' ? 'ascending' : 'descending'
}

const ALINEACION = { left: 'text-left', right: 'text-right', center: 'text-center' } as const
const OCULTAR = { md: 'hidden md:table-cell', lg: 'hidden lg:table-cell' } as const
const tieneAcciones = computed(() => !!slots.actions)

function claveDe(row: T, index: number): string | number {
  return (row[props.rowKey] as string | number | undefined) ?? index
}
</script>

<template>
  <div class="ui-card overflow-hidden">
    <UiSkeleton v-if="loading" variant="rows" :rows="skeletonRows" :label="`Cargando ${ariaLabel.toLowerCase()}…`" />

    <div v-else-if="!rows.length" class="px-4 py-8">
      <slot name="empty">
        <BrandStatePanel mascot="nava" state="empty" :title="emptyTitle" :description="emptyDescription" />
      </slot>
    </div>

    <div v-else class="max-h-[70vh] overflow-auto" data-mobile-cards>
      <table :aria-label="ariaLabel" class="block w-full text-left text-sm md:table" data-mobile-cards>
        <thead class="hidden md:table-header-group">
          <tr class="border-b border-line text-xs uppercase tracking-wider text-muted">
            <th
              v-for="col in columns"
              :key="col.key"
              scope="col"
              class="sticky top-0 z-10 bg-card px-4 py-3"
              :class="[ALINEACION[col.align ?? 'left'], col.hideBelow ? OCULTAR[col.hideBelow] : '']"
              :aria-sort="ariaSort(col)"
            >
              <button
                v-if="col.sortable"
                type="button"
                class="inline-flex items-center gap-1 uppercase tracking-wider hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold"
                @click="alternarOrden(col)"
              >
                {{ col.label }}
                <span aria-hidden="true">{{ sort?.key === col.key ? (sort.dir === 'asc' ? '▲' : '▼') : '↕' }}</span>
              </button>
              <template v-else>{{ col.label }}</template>
            </th>
            <th v-if="tieneAcciones" scope="col" class="sticky top-0 z-10 bg-card px-4 py-3 text-right">{{ actionsLabel }}</th>
          </tr>
        </thead>
        <tbody class="block md:table-row-group">
          <tr
            v-for="(row, index) in ordenadas"
            :key="claveDe(row, index)"
            class="block border-b border-line/60 py-2 last:border-0 md:table-row md:py-0"
          >
            <td
              v-for="col in columns"
              :key="col.key"
              :data-label="col.label"
              class="flex items-center justify-between gap-3 px-4 py-1.5 before:text-xs before:uppercase before:tracking-wider before:text-muted before:content-[attr(data-label)] md:table-cell md:py-3 md:before:content-none"
              :class="[ALINEACION[col.align ?? 'left'], col.hideBelow ? OCULTAR[col.hideBelow] : '']"
            >
              <slot :name="`cell-${col.key}`" :row="row" :value="row[col.key]">
                {{ row[col.key] ?? '—' }}
              </slot>
            </td>
            <td v-if="tieneAcciones" data-label="Acciones" class="block px-4 py-1.5 text-right md:table-cell md:py-3">
              <slot name="actions" :row="row" />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
