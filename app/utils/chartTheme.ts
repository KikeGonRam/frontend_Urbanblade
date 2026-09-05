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
