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
