import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    tanstackStart(),
    viteReact(),
  ],
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
