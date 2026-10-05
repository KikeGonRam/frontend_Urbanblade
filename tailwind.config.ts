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
   * Ya no hay safelist: Tailwind 4 no la admite en la config y tampoco
   * la necesita. Existía porque Tailwind 3 podaba de @layer components las
   * reglas brand-mascot--${size}/${state} que BrandMascot arma por
   * interpolación (la mascota quedaba sin tamaño, 2026-09-11); en la v4
   * @layer components es una capa CSS nativa y sale completa.
   */

  theme: {
    extend: {
      // Tailwind 4 subió backdrop-blur-sm de 4px a 8px; se mantiene el de v3.
      backdropBlur: {
        sm: '4px',
      },
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
        // Estados (kit de UI): cambian por tema, más oscuros en "libreta".
        success: 'rgb(var(--success-rgb) / <alpha-value>)',
        warning: 'rgb(var(--warning-rgb) / <alpha-value>)',
        danger: 'rgb(var(--danger-rgb) / <alpha-value>)',
        info: 'rgb(var(--info-rgb) / <alpha-value>)',
      },
    },
  },

  plugins: [forms],
}
