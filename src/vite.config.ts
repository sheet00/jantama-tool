import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs/promises'
import path from 'node:path'

function trackerPersistence() {
  return {
    name: 'tracker-persistence',
    configureServer(server: { middlewares: { use: (path: string, handler: (request: import('node:http').IncomingMessage, response: import('node:http').ServerResponse, next: () => void) => void) => void } }) {
      server.middlewares.use('/tracker/snapshot', async (request, response, next) => {
        if (request.method !== 'POST') {
          next()
          return
        }
        const chunks: Buffer[] = []
        for await (const chunk of request) chunks.push(Buffer.from(chunk))
        const payload = Buffer.concat(chunks).toString('utf8')
        const snapshot = JSON.parse(payload) as unknown
        const output = path.resolve(process.cwd(), 'src/tracker/game.json')
        const temporary = `${output}.tmp`
        await fs.mkdir(path.dirname(output), { recursive: true })
        await fs.writeFile(temporary, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8')
        await fs.rename(temporary, output)
        response.statusCode = 204
        response.end()
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), trackerPersistence()],
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
