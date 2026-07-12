import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/cdp': {
        target: 'http://127.0.0.1:9222',
        changeOrigin: true,
        ws: true,
        rewrite: (path) => path.replace(/^\/cdp/, ''),
      },
    },
  },
})
