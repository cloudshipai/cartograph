/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: '#0f0f1a',
          secondary: '#1a1a2e',
          tertiary: '#252542',
        },
        border: {
          DEFAULT: '#333',
          light: '#444',
        },
        layer: {
          api: '#3b82f6',
          service: '#10b981',
          model: '#f59e0b',
          ui: '#ec4899',
          util: '#8b5cf6',
          test: '#6b7280',
          config: '#06b6d4',
          other: '#4b5563',
        },
      },
    },
  },
  plugins: [],
}
