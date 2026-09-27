import { Chart as ChartJS, registerables } from "chart.js";
import { goldHex, inkRgba } from "~/utils/chartTheme";

let registered = false;

export function ensureChartjsRegistered() {
  if (registered) return;
  ChartJS.register(...registerables);

  ChartJS.defaults.font.family = "'Figtree', sans-serif";
  ChartJS.defaults.color = inkRgba(0.4);
  ChartJS.defaults.font.weight = "bold";

  // Animación corta y con frenado suave; nada si el sistema pide reducir movimiento.
  const reduceMotion = import.meta.client && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  // Barras y puntos entran uno tras otro (escalonado), para que se vea el crecimiento.
  ChartJS.defaults.animation = reduceMotion
    ? false
    : {
        duration: 900,
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
