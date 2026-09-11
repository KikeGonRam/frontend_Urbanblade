import type { Config } from 'tailwindcss'
import defaultTheme from 'tailwindcss/defaultTheme'
import forms from '@tailwindcss/forms'

/*
 * Portado 1:1 desde barber/tailwind.config.js — mismos nombres de token,
 * mismas variables CSS (definidas en assets/css/main.css). Ver ese archivo
 * para la explicación completa de por qué "ink"/"gold" usan rgb(var(..) /
 * <alpha-value>) y el resto son hex planos.
 */
export default <Config>{
  darkMode: 'class',

  content: [
    './app/**/*.vue',
    './app/**/*.ts',
    './components/**/*.vue',
    './layouts/**/*.vue',
    './pages/**/*.vue',
  ],

  /*
   * BrandMascot arma sus modificadores por interpolación
   * (`brand-mascot--${size}` / `brand-mascot--${state}`) y el escáner de
   * Tailwind solo ve clases literales: sin esto poda esas reglas de
   * @layer components y la mascota queda SIN TAMAÑO, estirándose al ancho
   * de su contenedor. Detectado el 2026-09-11 en la pantalla de cita
   * confirmada, donde la imagen medía 1151 px de alto y empujaba el código
   * de la cita fuera de pantalla; afectaba igual a todos los estados
   * vacíos/de error que usan BrandStatePanel.
   */
  safelist: [
    { pattern: /^brand-mascot--(sm|md|lg|idle|welcome|waiting|success|empty|forbidden|lost|error)$/ },
  ],

  theme: {
    extend: {
      fontFamily: {
        sans: ['Figtree', ...defaultTheme.fontFamily.sans],
        analytics: ['"Plus Jakarta Sans"', 'Figtree', ...defaultTheme.fontFamily.sans],
      },
      colors: {
        main: 'var(--bg-main)',
        card: 'var(--bg-card)',
        accent: 'var(--bg-accent)',
        panel: 'var(--panel)',
        line: 'var(--line)',
        muted: 'var(--muted)',
        ink: 'rgb(var(--ink-rgb) / <alpha-value>)',

        gold: 'rgb(var(--gold-rgb) / <alpha-value>)',
        'gold-dim': 'rgb(var(--gold-dim-rgb) / <alpha-value>)',
      },
    },
  },

  plugins: [forms],
}
