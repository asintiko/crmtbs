import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}', './electron/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          DEFAULT: '#2563eb',
          muted: '#1d4ed8',
          subtle: '#dbeafe',
        },
        surface: {
          light: '#f8fafc',
          dark: '#0f172a',
        },
      },
      boxShadow: {
        card: '0 10px 40px rgba(0,0,0,0.08)',
        inset: 'inset 0 1px 0 rgba(255,255,255,0.04)',
      },
    },
  },
  plugins: [],
}

export default config
