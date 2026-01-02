import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../dist/web',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3333',
      '/ws': {
        target: 'ws://localhost:3333',
        ws: true,
      },
    },
  },
})
