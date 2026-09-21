import { createServerFn } from '@tanstack/react-start'
import fs from 'node:fs/promises'
import path from 'node:path'

const snapshotPath = path.resolve(process.cwd(), 'src/tracker/game.json')
const logsDir = path.resolve(process.cwd(), 'src/tracker/logs')

export const saveSnapshotFn = createServerFn({ method: 'POST' })
  .validator((data: unknown) => data)
  .handler(async ({ data }) => {
    const temporary = `${snapshotPath}.tmp`
    await fs.mkdir(path.dirname(snapshotPath), { recursive: true })
    await fs.writeFile(temporary, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
    await fs.rename(temporary, snapshotPath)
    return { ok: true }
  })

export const getSnapshotFn = createServerFn({ method: 'GET' })
  .handler(async () => {
    try {
      const content = await fs.readFile(snapshotPath, 'utf8')
      return JSON.parse(content) as unknown
    } catch {
      return null
    }
  })

export const deleteSnapshotFn = createServerFn({ method: 'POST' })
  .handler(async () => {
    try {
      await fs.unlink(snapshotPath)
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
    return { ok: true }
  })

export const appendLogFn = createServerFn({ method: 'POST' })
  .validator((data: { logFile: string; line: string }) => data)
  .handler(async ({ data }) => {
    const { logFile, line } = data
    if (!logFile || !line || !/^[\w\-.]+(\.log)$/.test(logFile)) {
      throw new Error('Invalid log file name')
    }
    const logPath = path.resolve(logsDir, logFile)
    if (!logPath.startsWith(logsDir + path.sep)) {
      throw new Error('Invalid log path')
    }
    await fs.mkdir(logsDir, { recursive: true })
    await fs.appendFile(logPath, line + '\n', 'utf8')
    return { ok: true }
  })
