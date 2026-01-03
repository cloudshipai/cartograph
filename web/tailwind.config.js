/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Surface scale (Material Design dark)
        surface: {
          0: '#09090b',   // zinc-950 - main background
          1: '#18181b',   // zinc-900 - elevated
          2: '#27272a',   // zinc-800 - cards/modals
          3: '#3f3f46',   // zinc-700 - hover states
          4: '#52525b',   // zinc-600 - active states
        },
        // Borders
        border: {
          DEFAULT: '#27272a',  // zinc-800
          subtle: '#3f3f46',   // zinc-700
        },
        // Text (following Material's opacity guidelines)
        content: {
          primary: '#fafafa',    // zinc-50 - 87% visible
          secondary: '#a1a1aa',  // zinc-400 - 60%
          muted: '#71717a',      // zinc-500 - 38%
        },
        // Accent - desaturated for dark mode
        accent: {
          DEFAULT: '#3b82f6',
          hover: '#60a5fa',
          muted: '#1e3a5f',
        },
        // Status colors (desaturated for dark backgrounds)
        status: {
          success: '#22c55e',
          warning: '#eab308', 
          error: '#ef4444',
          info: '#3b82f6',
        },
        // Layer colors (slightly desaturated)
        layer: {
          api: '#60a5fa',      // blue-400
          service: '#34d399',  // emerald-400
          model: '#fbbf24',    // amber-400
          ui: '#f472b6',       // pink-400
          util: '#a78bfa',     // violet-400
          test: '#9ca3af',     // gray-400
          config: '#22d3ee',   // cyan-400
          other: '#6b7280',    // gray-500
        },
      },
    },
  },
  plugins: [],
}
