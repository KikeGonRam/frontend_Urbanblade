import { Chart as ChartJS, registerables } from 'chart.js'
import { inkRgba, goldHex } from '~/utils/chartTheme'

/*
 * Registro único de Chart.js + defaults visuales, equivalente a
 * barber/resources/js/chart-theme.js. Plugin .client.ts porque Chart.js
 * necesita el DOM (canvas) — nunca se ejecuta en SSR de todas formas, ya
 * que las rutas /dashboard/** están marcadas ssr:false en nuxt.config.ts.
 */
export default defineNuxtPlugin(() => {
  ChartJS.register(...registerables)

  ChartJS.defaults.font.family = "'Figtree', sans-serif"
  ChartJS.defaults.color = inkRgba(0.4)
  ChartJS.defaults.font.weight = 'bold'

  Object.assign(ChartJS.defaults.plugins.tooltip, {
    backgroundColor: 'rgba(10,10,10,0.96)',
    titleColor: goldHex(),
    titleFont: { weight: '900', size: 11 },
    bodyColor: '#ffffff',
    bodyFont: { weight: 'bold', size: 11 },
    borderColor: `${goldHex()}4d`,
    borderWidth: 1,
    padding: 10,
    cornerRadius: 8,
    boxPadding: 4,
    usePointStyle: true,
  })
})
