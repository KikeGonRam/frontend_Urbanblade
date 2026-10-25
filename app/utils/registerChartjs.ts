import { Chart as ChartJS, registerables } from "chart.js";
import { goldHex, inkRgba } from "~/utils/chartTheme";
import { buildChartDetail } from "~/utils/chartDetail";

let registered = false;

/* "rgba(r, g, b, a)" -> [r, g, b, a]; null si el color no es rgba (así solo se tocan los colores del kit). */
function parseRgba(color: unknown): [number, number, number, number] | null {
  if (typeof color !== "string") return null;
  const m = color.match(/^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)$/);

  return m ? [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])] : null;
}

const rgba = (c: [number, number, number, number], alpha: number) => `rgba(${c[0]},${c[1]},${c[2]},${Math.max(0, Math.min(1, alpha)).toFixed(3)})`;

/*
 * Pulido de todas las gráficas del kit sin tocar cada una: las barras se pintan con un degradado
 * (color vivo arriba que se funde hacia la base) y las áreas de las líneas se desvanecen hacia abajo.
 * Solo afecta a colores rgba() sólidos; un color que ya sea degradado o hex se respeta.
 */
const premiumFills = {
  id: "ubPremiumFills",
  beforeDatasetsDraw(chart: ChartJS) {
    const area = chart.chartArea;
    if (!area) return;
    const horizontal = chart.options.indexAxis === "y";

    chart.data.datasets.forEach((dataset, i) => {
      const meta = chart.getDatasetMeta(i);
      if (meta.type === "bar") {
        meta.data.forEach((element) => {
          const opts = (element as unknown as { options: { backgroundColor: unknown } }).options;
          const base = parseRgba(opts.backgroundColor);
          if (!base) return;
          const { x, y, base: edge } = (element as unknown as { getProps: (keys: string[], final?: boolean) => { x: number; y: number; base: number } })
            .getProps(["x", "y", "base"], true);
          const gradient = horizontal
            ? chart.ctx.createLinearGradient(edge, 0, x, 0)
            : chart.ctx.createLinearGradient(0, y, 0, edge);
          const strong = Math.min(1, base[3] * 1.3 + 0.08);
          if (horizontal) {
            gradient.addColorStop(0, rgba(base, strong * 0.35));
            gradient.addColorStop(1, rgba(base, strong));
          } else {
            gradient.addColorStop(0, rgba(base, strong));
            gradient.addColorStop(1, rgba(base, strong * 0.3));
          }
          opts.backgroundColor = gradient as unknown;
        });
      } else if (meta.type === "line" && (dataset as { fill?: unknown }).fill) {
        const datasetOpts = (meta.dataset as unknown as { options: { backgroundColor: unknown } } | undefined)?.options;
        const base = parseRgba(datasetOpts?.backgroundColor);
        if (!datasetOpts || !base) return;
        const gradient = chart.ctx.createLinearGradient(0, area.top, 0, area.bottom);
        gradient.addColorStop(0, rgba(base, 0.38));
        gradient.addColorStop(1, rgba(base, 0));
        datasetOpts.backgroundColor = gradient as unknown;
      }
    });
  },
};

export function ensureChartjsRegistered() {
  if (registered) return;
  ChartJS.register(...registerables, premiumFills);
  // Chart.js no sabe interpolar un degradado entre dos estados de color y se rompe a media animación:
  // la transición de color se apaga (el crecimiento y el movimiento de barras y puntos siguen animados).
  Object.assign(ChartJS.defaults.animations, { colors: false });

  // Clic en una barra, punto o porción: abre la ventana de detalle (ChartDetailModal, montada en el layout).
  // El cursor cambia a mano al pasar por encima para que se note que se puede seleccionar.
  ChartJS.defaults.onHover = (_event, elements, chart) => {
    chart.canvas.style.cursor = elements.length ? "pointer" : "default";
  };
  ChartJS.defaults.onClick = (_event, elements, chart) => {
    const index = elements[0]?.index;
    if (index === undefined) return;
    const detail = buildChartDetail(chart, index);
    if (detail) window.dispatchEvent(new CustomEvent("ub:chart-detail", { detail }));
  };

  ChartJS.defaults.font.family = "'Figtree', sans-serif";
  ChartJS.defaults.color = inkRgba(0.4);
  ChartJS.defaults.font.weight = "bold";

  // Animación corta y con frenado suave; nada si el sistema pide reducir movimiento.
  const reduceMotion = import.meta.client && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  // Barras y puntos entran uno tras otro (escalonado), para que se vea el crecimiento.
  ChartJS.defaults.animation = reduceMotion
    ? false
    : {
        duration: 1100,
        easing: "easeOutQuart",
        delay: (ctx: { type?: string; mode?: string; dataIndex?: number }) =>
          ctx.type === "data" && ctx.mode === "default" ? (ctx.dataIndex ?? 0) * 60 : 0,
      };

  Object.assign(ChartJS.defaults.plugins.tooltip, {
    backgroundColor: "rgba(10,10,10,0.96)",
    titleColor: goldHex(),
    titleFont: { weight: "900", size: 11 },
    bodyColor: "#ffffff",
    bodyFont: { weight: "bold", size: 11 },
    borderColor: `${goldHex()}4d`,
    borderWidth: 1,
    padding: 10,
    cornerRadius: 8,
    boxPadding: 4,
    usePointStyle: true,
  });

  registered = true;
}
