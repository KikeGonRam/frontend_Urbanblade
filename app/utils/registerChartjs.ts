import { Chart as ChartJS, registerables } from "chart.js";
import { watch } from "vue";
import { AXIS_TEXT_ALPHA, chartThemeTick, chartTooltip, goldHex, goldTextHex, inkRgba, sombraDelGlobo } from "~/utils/chartTheme";
import { THEME_PREVIEWS } from "~/composables/useTheme";
import { buildChartDetail } from "~/utils/chartDetail";

/** Solo los colores del globo, para repintarlo al cambiar de tema sin tocar sus textos ni sus callbacks. */
function chartTooltipColors() {
  const { backgroundColor, borderColor, titleColor, bodyColor } = chartTooltip();
  return { backgroundColor, borderColor, titleColor, bodyColor };
}

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

/*
 * Las opciones de muchas gráficas son constantes armadas una sola vez, con el color de texto del tema de ese momento.
 * Al cambiar de tema en caliente quedaban con la tinta vieja (texto claro sobre fondo claro en «libreta»). Antes de
 * cada actualización, este plugin cambia cualquier color de ejes, cuadrícula o leyenda hecho con la tinta de algún tema
 * por la tinta del tema activo, conservando su opacidad. Un color propio (rojo, verde, dorado…) no se toca.
 */
const TINTAS_DE_TEMA = new Set(
  [...Object.values(THEME_PREVIEWS).map((p) => p.ink), "#f2f2f2", "#eef0f2", "#eef2ee"].map((hex) =>
    [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16)).join(","),
  ),
);

export function reteñir(color: unknown, tinta: [number, number, number, number]): unknown {
  const c = parseRgba(color);
  if (!c || !TINTAS_DE_TEMA.has(`${c[0]},${c[1]},${c[2]}`)) return color;

  return rgba([tinta[0], tinta[1], tinta[2], c[3]], c[3]);
}

type EscalaConColores = { ticks?: { color?: unknown }; grid?: { color?: unknown } };

/*
 * Sombra suave bajo el globo de información para separarlo de la gráfica en los cuatro temas. Chart.js no tiene una
 * opción de sombra: se activa en el lienzo justo antes de dibujar el globo y se restaura después.
 */
const sombraGlobo = {
  id: "ubTooltipShadow",
  beforeTooltipDraw(chart: ChartJS) {
    const ctx = chart.ctx;
    ctx.save();
    ctx.shadowColor = sombraDelGlobo(import.meta.client ? document.documentElement.dataset.theme : null);
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 6;
  },
  afterTooltipDraw(chart: ChartJS) {
    chart.ctx.restore();
  },
};

const sincronizarTema = {
  id: "ubThemeSync",
  beforeUpdate(chart: ChartJS) {
    const tinta = parseRgba(inkRgba(1));
    const opciones = chart.config.options as { scales?: Record<string, EscalaConColores>; plugins?: { legend?: { labels?: { color?: unknown } } } } | undefined;
    if (!tinta || !opciones) return;
    for (const escala of Object.values(opciones.scales ?? {})) {
      if (escala.ticks) escala.ticks.color = reteñir(escala.ticks.color, tinta);
      if (escala.grid) escala.grid.color = reteñir(escala.grid.color, tinta);
    }
    const leyenda = opciones.plugins?.legend?.labels;
    if (leyenda) leyenda.color = reteñir(leyenda.color, tinta);
    // El globo de información de cada gráfica también trae colores fijados al crearse: se alinean con el tema activo.
    const globo = (opciones.plugins as { tooltip?: Record<string, unknown> } | undefined)?.tooltip;
    if (globo) Object.assign(globo, chartTooltipColors());
  },
};

/*
 * Colores globales que dependen del tema: texto de ejes y leyendas, y el globo de información (fondo del tema en
 * lugar de un negro fijo, que en el tema claro se veía como un parche). Se recalculan al cambiar de tema.
 */
function aplicarColoresDelTema() {
  ChartJS.defaults.color = inkRgba(AXIS_TEXT_ALPHA);
  Object.assign(ChartJS.defaults.plugins.tooltip, {
    backgroundColor: chartTooltip().backgroundColor,
    titleColor: goldTextHex(),
    bodyColor: inkRgba(0.92),
    borderColor: `${goldHex()}4d`,
  });
}

export function ensureChartjsRegistered() {
  if (registered) return;
  ChartJS.register(...registerables, premiumFills, sincronizarTema, sombraGlobo);
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
    // 12 px el título y 13 px el cuerpo (antes 11 px ambos): legibles sin acercarse.
    titleFont: { weight: "800", size: 12 },
    bodyFont: { weight: "600", size: 13 },
    borderWidth: 1,
    padding: { top: 10, bottom: 10, left: 12, right: 12 },
    cornerRadius: 10,
    boxPadding: 4,
    usePointStyle: true,
  });
  aplicarColoresDelTema();
  // Al cambiar de tema se repintan los valores globales; las gráficas montadas los toman en su siguiente dibujo.
  if (import.meta.client) watch(chartThemeTick(), () => {
    aplicarColoresDelTema();
    Object.values(ChartJS.instances).forEach((chart) => chart.update("none"));
  });

  registered = true;
}
