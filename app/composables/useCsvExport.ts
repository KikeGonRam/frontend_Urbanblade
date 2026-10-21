/*
 * Exportación a CSV de cualquier listado paginado de la API (usuarios, servicios, productos,
 * movimientos, logs, clientes). Recorre todas las páginas con los MISMOS filtros que la pantalla
 * tiene activos, así que el archivo coincide con lo que se ve y no solo con la página actual.
 *
 * - UTF-8 con BOM para que Excel respete acentos y la ñ.
 * - Las celdas que empiezan con = + - @ se neutralizan (CSV injection al abrirlo en Excel).
 * - Tope de páginas para no colgar el navegador con tablas enormes; se avisa si se truncó.
 */
export interface CsvColumn<T> {
  header: string
  value: (row: T) => string | number | boolean | null | undefined
}

interface PagedResponse<T> {
  data?: T[]
  meta?: { last_page?: number }
  last_page?: number
}

const PAGE_SIZE = 50

export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  let text = typeof value === 'boolean' ? (value ? 'Sí' : 'No') : String(value)
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`

  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function buildCsv<T>(columns: CsvColumn<T>[], rows: T[]): string {
  const head = columns.map((c) => csvCell(c.header)).join(',')
  const body = rows.map((row) => columns.map((c) => csvCell(c.value(row))).join(','))

  return [head, ...body].join('\r\n')
}

export function useCsvExport() {
  const { apiFetch } = useApi()
  const exporting = ref(false)
  const error = ref('')
  const truncated = ref(false)

  async function exportCsv<T>(opts: {
    endpoint: string
    query?: Record<string, unknown>
    columns: CsvColumn<T>[]
    filename: string
    maxPages?: number
  }) {
    exporting.value = true
    error.value = ''
    truncated.value = false
    const maxPages = opts.maxPages ?? 40

    try {
      const rows: T[] = []
      let page = 1
      let last = 1
      do {
        const res = await apiFetch<PagedResponse<T>>(opts.endpoint, { query: { ...opts.query, page, per_page: PAGE_SIZE } })
        rows.push(...(res.data ?? []))
        last = res.meta?.last_page ?? res.last_page ?? 1
        page++
      } while (page <= last && page <= maxPages)
      truncated.value = last > maxPages

      const blob = new Blob(['﻿', buildCsv(opts.columns, rows)], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${opts.filename}-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)

      return rows.length
    } catch {
      error.value = 'No se pudo generar el archivo. Inténtalo de nuevo.'

      return 0
    } finally {
      exporting.value = false
    }
  }

  return { exporting, error, truncated, exportCsv }
}
