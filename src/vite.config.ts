import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs/promises'
import path from 'node:path'

function trackerPersistence() {
  return {
    name: 'tracker-persistence',
    configureServer(server: { middlewares: { use: (path: string, handler: (request: import('node:http').IncomingMessage, response: import('node:http').ServerResponse, next: () => void) => void) => void } }) {
      server.middlewares.use('/tracker/log', async (request, response) => {
        if (request.method !== 'POST') {
          response.statusCode = 405
          response.end()
          return
        }
        const chunks: Buffer[] = []
        for await (const chunk of request) chunks.push(Buffer.from(chunk))
        const payload = Buffer.concat(chunks).toString('utf8')
        const body = JSON.parse(payload) as { logFile?: unknown; line?: unknown }
        const logFile = typeof body.logFile === 'string' ? body.logFile : null
        const line = typeof body.line === 'string' ? body.line : null
        if (!logFile || !line || !/^[\w\-.]+(\.log)$/.test(logFile)) {
          response.statusCode = 400
          response.end()
          return
        }
        const logsDir = path.resolve(process.cwd(), 'src/tracker/logs')
        const logPath = path.resolve(logsDir, logFile)
        if (!logPath.startsWith(logsDir + path.sep)) {
          response.statusCode = 400
          response.end()
          return
        }
        await fs.mkdir(logsDir, { recursive: true })
        await fs.appendFile(logPath, line + '\n', 'utf8')
        response.statusCode = 204
        response.end()
      })
      server.middlewares.use('/tracker/snapshot', async (request, response, next) => {
        const output = path.resolve(process.cwd(), 'src/tracker/game.json')
        if (request.method === 'GET') {
          try {
            const snapshot = await fs.readFile(output, 'utf8')
            response.statusCode = 200
            response.setHeader('Content-Type', 'application/json')
            response.end(snapshot)
          } catch {
            response.statusCode = 404
            response.end()
          }
          return
        }
        if (request.method === 'DELETE') {
          try {
            await fs.unlink(output)
          } catch (error: unknown) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
          }
          response.statusCode = 204
          response.end()
          return
        }
        if (request.method !== 'POST') {
          next()
          return
        }
        const chunks: Buffer[] = []
        for await (const chunk of request) chunks.push(Buffer.from(chunk))
        const payload = Buffer.concat(chunks).toString('utf8')
        const snapshot = JSON.parse(payload) as unknown
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
