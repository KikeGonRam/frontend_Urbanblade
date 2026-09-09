import { Chart as ChartJS, registerables } from "chart.js";
import { goldHex, inkRgba } from "~/utils/chartTheme";

let registered = false;

export function ensureChartjsRegistered() {
  if (registered) return;
  ChartJS.register(...registerables);

  ChartJS.defaults.font.family = "'Figtree', sans-serif";
  ChartJS.defaults.color = inkRgba(0.4);
  ChartJS.defaults.font.weight = "bold";

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
