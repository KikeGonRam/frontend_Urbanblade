/*
 * Portado de barber/resources/js/chart-theme.js, con un cambio deliberado:
 * el original hardcodea rgba(255,255,255,.3) para ejes/leyendas, asumiendo
 * que siempre se ve sobre fondo oscuro — ahí es cierto porque ese repo
 * nunca corrió esas gráficas bajo el tema claro "libreta". Aquí SÍ importa
 * (los 4 temas son reales y alternables), así que los colores de ejes se
 * leen de --ink-rgb/--gold en tiempo de registro del plugin en vez de ir
 * fijos. No es reactivo a un cambio de tema en caliente sobre una gráfica
 * ya montada (ver app/plugins/chart.client.ts) — límite aceptado por ahora.
 */
function cssVar(name: string, fallback: string): string {
  if (!import.meta.client) return fallback
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()

  return value || fallback
}

export function inkRgba(alpha: number): string {
  return `rgba(${cssVar('--ink-rgb', '242 242 242').replace(/\s+/g, ',')}, ${alpha})`
}

export function goldHex(): string {
  return cssVar('--gold', '#d4af37')
}

// Paleta categórica (validada: banda de luminosidad oscura, ΔE CVD >= 8 frente
// al fondo de tarjeta #111) para gráficas con varias series del mismo tipo.
export const UB_CATEGORICAL = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300']

export function chartScale() {
  return {
    ticks: { color: inkRgba(0.4), font: { size: 10 } },
    grid: { color: inkRgba(0.08) },
    border: { display: false },
  }
}

export function fmtMoney(v: number | null | undefined): string {
  return '$' + Number(v ?? 0).toLocaleString('es-MX', { maximumFractionDigits: 0 })
}

export function fmtInt(v: number | null | undefined): string {
  return Number(v ?? 0).toLocaleString('es-MX', { maximumFractionDigits: 0 })
}

// ── Kit de dashboards (26-sep-2026, skill urbanblade-ui-kit) ──────────────────
// Las gráficas protagonistas van en el oro del tema activo (cobre en "acero",
// latón en "salón"), no en colores sueltos: la identidad es el oro.

export function goldRgba(alpha: number): string {
  return `rgba(${cssVar('--gold-rgb', '212 175 55').replace(/\s+/g, ',')}, ${alpha})`
}

/** n tonos del oro, del más fuerte al más tenue (barras de categorías). */
export function goldSeries(n: number): string[] {
  return Array.from({ length: n }, (_, i) => goldRgba(n <= 1 ? 0.9 : 0.9 - (i * 0.6) / (n - 1)))
}

/** Tooltip común: fondo de tarjeta del tema, texto en tinta, sin el cuadrito de color. */
export function chartTooltip() {
  return {
    backgroundColor: cssVar('--bg-card', '#161616'),
    borderColor: cssVar('--line', '#2c2c2c'),
    borderWidth: 1,
    titleColor: inkRgba(0.9),
    bodyColor: inkRgba(0.75),
    padding: 10,
    cornerRadius: 10,
    displayColors: false,
  }
}

/** Eje sin líneas (el de categorías): la cuadrícula solo en el eje de valores. */
export function chartAxisClean() {
  return {
    ticks: { color: inkRgba(0.5), font: { size: 11 } },
    grid: { display: false },
    border: { display: false },
  }
}

/** Color de un token semántico del tema (success, warning, danger, info, gold, ink) para Chart.js. */
export function tokenRgba(token: 'success' | 'warning' | 'danger' | 'info' | 'gold' | 'ink', alpha = 1): string {
  const fallback = { success: '52 211 153', warning: '245 180 70', danger: '248 113 113', info: '96 165 250', gold: '212 175 55', ink: '242 242 242' }[token]

  return `rgba(${cssVar(`--${token}-rgb`, fallback).replace(/\s+/g, ',')}, ${alpha})`
}

/** Color de cada estado de cita, igual que sus insignias (appointmentStatus). */
export function appointmentStatusColor(estado: string): string {
  const map: Record<string, Parameters<typeof tokenRgba>[0]> = {
    pendiente: 'warning', confirmada: 'info', en_proceso: 'gold', completada: 'success', cancelada: 'danger', no_asistio: 'ink',
  }

  return tokenRgba(map[estado] ?? 'ink', estado === 'no_asistio' ? 0.35 : 0.9)
}

/**
 * Color i de la paleta de series: el 0 es el oro del tema (la marca) y del 1 al 5 salen de --chart-N-rgb,
 * que cada tema define (más profundos en libreta). Evita que toda gráfica sea del mismo color.
 */
export function chartColor(i: number, alpha = 0.9): string {
  const idx = ((i % 6) + 6) % 6
  if (idx === 0) return goldRgba(alpha)
  const fallback = ['', '56 189 248', '45 212 191', '167 139 250', '251 113 133', '251 146 60'][idx]!

  return `rgba(${cssVar(`--chart-${idx}-rgb`, fallback).replace(/\s+/g, ',')}, ${alpha})`
}

/** n colores distintos de la paleta, para barras de categorías. */
export function chartSeries(n: number, alpha = 0.9): string[] {
  return Array.from({ length: n }, (_, i) => chartColor(i, alpha))
}
