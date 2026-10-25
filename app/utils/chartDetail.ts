import type { Chart } from "chart.js";
import { goldHex } from "~/utils/chartTheme";

/*
 * Detalle de un punto o barra de cualquier gráfica del kit, para la ventana que se abre al hacer clic.
 * Reutiliza los textos del tooltip de cada gráfica (callbacks.title y callbacks.label), así que el dinero,
 * los porcentajes y las unidades salen con el mismo formato sin tener que configurar nada por gráfica.
 */
export interface ChartDetailRow {
  label: string;
  color: string;
}

export interface ChartDetailFact {
  label: string;
  value: string;
  tone?: "up" | "down" | "neutral";
}

export interface ChartDetail {
  chartTitle: string;
  title: string;
  rows: ChartDetailRow[];
  facts: ChartDetailFact[];
}

type LooseCallbacks = {
  title?: (items: unknown[]) => string | string[];
  label?: (ctx: unknown) => string | string[];
};

function colorAt(value: unknown, index: number): string {
  const pick = Array.isArray(value) ? value[index] : value;

  return typeof pick === "string" ? pick : goldHex();
}

const text = (v: string | string[] | undefined) => (Array.isArray(v) ? v.join(" · ") : (v ?? ""));

export function buildChartDetail(chart: Chart, index: number): ChartDetail | null {
  const labels = (chart.data.labels ?? []) as unknown[];
  const label = String(labels[index] ?? "");
  const cbs = (chart.options.plugins?.tooltip?.callbacks ?? {}) as LooseCallbacks;
  const type = (chart.config as { type?: string }).type;
  const horizontal = chart.options.indexAxis === "y";

  const rows: ChartDetailRow[] = [];
  chart.data.datasets.forEach((dataset, datasetIndex) => {
    if (!chart.isDatasetVisible(datasetIndex)) return;
    const raw = (dataset.data as unknown[])[index];
    if (raw === undefined || raw === null) return;
    const value = Number(raw);
    const ctx = {
      chart,
      dataset,
      datasetIndex,
      dataIndex: index,
      label,
      raw,
      formattedValue: String(raw),
      parsed: { x: value, y: value },
    };
    const line = text(cbs.label?.(ctx)) || `${dataset.label ?? label}: ${value.toLocaleString("es-MX")}`;
    const swatch = colorAt(dataset.backgroundColor, index);
    rows.push({ label: line, color: swatch.startsWith("rgba") || swatch.startsWith("#") ? swatch : goldHex() });
  });
  if (!rows.length) return null;

  const title = text(cbs.title?.([{ label, dataIndex: index, datasetIndex: 0, chart }])) || label;

  // Datos para contextualizar el punto: participación, posición y variación contra el anterior.
  const facts: ChartDetailFact[] = [];
  const first = ((chart.data.datasets[0]?.data ?? []) as unknown[]).map(Number);
  const value = first[index];
  if (Number.isFinite(value) && first.every((n) => Number.isFinite(n) && n >= 0)) {
    const total = first.reduce((sum, n) => sum + n, 0);
    if (total > 0 && (type === "doughnut" || type === "pie" || horizontal || (type === "bar" && first.length <= 8))) {
      facts.push({ label: "Participación", value: `${Math.round((value! / total) * 100)}% del total` });
    }
    const rank = [...first].sort((a, b) => b - a).indexOf(value!) + 1;
    if (first.length > 2 && (horizontal || type === "doughnut" || type === "pie")) {
      facts.push({ label: "Posición", value: `${rank}.º de ${first.length}` });
    }
    if (!horizontal && type !== "doughnut" && type !== "pie" && index > 0 && first[index - 1]! > 0) {
      const delta = Math.round(((value! - first[index - 1]!) / first[index - 1]!) * 100);
      facts.push({
        label: "Contra el punto anterior",
        value: `${delta > 0 ? "+" : ""}${delta}%`,
        tone: delta > 0 ? "up" : delta < 0 ? "down" : "neutral",
      });
    }
    if (first.length > 2 && value === Math.max(...first)) facts.push({ label: "Dato destacado", value: "Es el valor más alto", tone: "up" });
    else if (first.length > 2 && value === Math.min(...first)) facts.push({ label: "Dato destacado", value: "Es el valor más bajo", tone: "down" });
  }

  const chartTitle = chart.canvas.closest("section, article")?.querySelector("h3")?.textContent?.trim() ?? "Detalle de la gráfica";

  return { chartTitle, title, rows, facts };
}
