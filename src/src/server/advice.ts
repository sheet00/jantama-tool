import { createServerFn } from '@tanstack/react-start'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const execFileAsync = promisify(execFile)
const currentDir = path.dirname(fileURLToPath(import.meta.url))
const promptTemplatePath = path.resolve(currentDir, 'prompts/advice.md')

export type AdvicePayload = {
  hand: string[]
  discardsBySeat: string[][]
  meldsBySeat: string[][][]
  riichiBySeat: boolean[]
  remainingWallTiles: number
  ownSeat: number | null
  shanten: number
  waits: string[]
  recommendedDiscards: string[]
  dangerAssessments: Array<{ tile: string; level: string; dangerScore: number; reasons: string[] }>
}

async function formatAdvicePrompt(data: AdvicePayload): Promise<string> {
  const template = await fs.readFile(promptTemplatePath, 'utf8')

  const {
    hand = [],
    discardsBySeat = [[], [], [], []],
    meldsBySeat = [[], [], [], []],
    riichiBySeat = [false, false, false, false],
    remainingWallTiles = 70,
    ownSeat = null,
    shanten = null,
    waits = [],
    recommendedDiscards = [],
    dangerAssessments = [],
  } = data

  const seatNames = ['座席0(東)', '座席1(南)', '座席2(西)', '座席3(北)']
  const ownSeatStr = ownSeat !== null ? `${seatNames[ownSeat] ?? ownSeat}` : '不明'

  const discardsText = discardsBySeat.map((d, i) => `  ${seatNames[i]}: ${d.join(' ') || '(なし)'}`).join('\n')
  const meldsText = meldsBySeat.map((m, i) => {
    const meldStrs = m.map((meld) => `[${meld.join(' ')}]`).join(' ')
    return `  ${seatNames[i]}: ${meldStrs || '(なし)'}`
  }).join('\n')

  const riichiText = riichiBySeat.map((r, i) => r ? seatNames[i] : null).filter(Boolean).join(', ') || 'なし'

  const dangerText = (dangerAssessments || [])
    .slice(0, 8)
    .map((a) => `  ${a.tile}: ${a.level} (危険度: ${Number(a.dangerScore).toFixed(2)}, 理由: ${a.reasons?.join(', ') || 'なし'})`)
    .join('\n')

  return template
    .replace('{{ownSeat}}', ownSeatStr)
    .replace('{{hand}}', hand.join(' '))
    .replace('{{remainingWallTiles}}', String(remainingWallTiles))
    .replace('{{riichi}}', riichiText)
    .replace('{{discards}}', discardsText)
    .replace('{{melds}}', meldsText)
    .replace('{{shanten}}', shanten !== null ? String(shanten) : '不明')
    .replace('{{waits}}', waits.length ? waits.join(' ') : 'なし')
    .replace('{{recommendedDiscards}}', recommendedDiscards.length ? recommendedDiscards.join(' ') : 'なし')
    .replace('{{danger}}', dangerText || '  (評価データなし)')
}

export const getMahjongAdvice = createServerFn({ method: 'POST' })
  .validator((data: AdvicePayload) => data)
  .handler(async ({ data }) => {
    const prompt = await formatAdvicePrompt(data)
    try {
      const { stdout } = await execFileAsync('agy', [
        '-p',
        prompt,
        '--model',
        'Gemini 3.8 Flash (Low)',
        '--disable-slash-commands',
      ], {
        timeout: 30000,
        maxBuffer: 1024 * 1024,
      })

      return { ok: true as const, advice: stdout.trim() }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to execute agy command'
      return { ok: false as const, error: message }
    }
  })
