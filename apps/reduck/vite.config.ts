import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
  },
  server: {
    port: 3001,
    proxy: {
      // In dev mode, proxy /api/* to Vercel dev server (port 3002)
      '/api': {
        target: 'http://localhost:3002',
        changeOrigin: true,
      },
    },
  },
})
