export type DangerLevel = 'safe' | 'caution' | 'danger'

export type DangerAssessment = {
  tile: string
  level: DangerLevel
  reasons: string[]
}

const RISK_LEVEL: Record<DangerLevel, number> = { safe: 0, caution: 1, danger: 2 }

function isSuited(tile: string): boolean {
  return tile.length === 2 && ['m', 'p', 's'].includes(tile[1])
}

function isHonor(tile: string): boolean {
  return tile.length === 2 && tile[1] === 'z'
}

function honorRisk(tile: string, counts: Map<string, number>): { score: number; reasons: string[] } {
  const visible = counts.get(tile) ?? 0
  if (visible >= 4) return { score: 0, reasons: ['4枚見え'] }
  if (visible === 3) return { score: 1, reasons: ['3枚見え'] }

  const remaining = 4 - visible
  const role = ['5z', '6z', '7z'].includes(tile) ? '役牌' : '役牌候補'
  return { score: 2, reasons: [visible === 0 ? `生牌・${role}` : `字牌残り${remaining}枚・${role}`] }
}

function tileAt(suit: string, rank: number): string {
  return `${rank}${suit}`
}

function sujiTiles(tile: string): string[] {
  if (!isSuited(tile)) return []
  const rank = Number(tile[0])
  const suit = tile[1]
  const partners: Record<number, number[]> = {
    1: [4], 2: [5], 3: [6], 4: [1, 7], 5: [2, 8], 6: [3, 9], 7: [4], 8: [5], 9: [6],
  }
  return (partners[rank] ?? []).map((partner) => tileAt(suit, partner))
}

function publicCounts(hand: string[], discardsBySeat: string[][], meldsBySeat: string[][][]): Map<string, number> {
  const counts = new Map<string, number>()
  const add = (tile: string) => counts.set(tile, (counts.get(tile) ?? 0) + 1)
  hand.forEach(add)
  discardsBySeat.flat().forEach(add)
  meldsBySeat.flat(2).forEach(add)
  return counts
}

function targetRisk(tile: string, targetDiscards: string[], postRiichiSafe: string[], counts: Map<string, number>): { score: number; reasons: string[] } {
  if (targetDiscards.includes(tile) || postRiichiSafe.includes(tile)) return { score: 0, reasons: ['現物'] }
  if (isHonor(tile)) return honorRisk(tile, counts)

  const reasons: string[] = []
  let score = 2
  if (sujiTiles(tile).some((suji) => targetDiscards.includes(suji))) {
    score = 1
    reasons.push('筋')
  }

  if (isSuited(tile)) {
    const rank = Number(tile[0])
    const suit = tile[1]
    const wallTiles = [rank - 1, rank + 1].filter((value) => value >= 1 && value <= 9).map((value) => tileAt(suit, value))
    const wall = wallTiles.filter((wallTile) => counts.get(wallTile) === 4)
    const oneChance = wallTiles.filter((wallTile) => counts.get(wallTile) === 3)
    if (wall.length) {
      score = Math.min(score, 1)
      reasons.push(`壁（${wall.join('・')}）`)
    } else if (oneChance.length) {
      reasons.push(`ワンチャンス（${oneChance.join('・')}）`)
    }
  }

  if (!reasons.length) reasons.push(isSuited(tile) ? '無筋' : '未通過')
  return { score, reasons }
}

export function analyzeDanger(
  hand: string[],
  discardsBySeat: string[][],
  remainingWallTiles: number,
  meldsBySeat: string[][][],
  riichiBySeat: boolean[],
  postRiichiSafeBySeat: string[][],
  ownSeat: number | null,
): DangerAssessment[] {
  const targets = riichiBySeat
    .map((riichi, seat) => {
      const presumedTenpai =
        remainingWallTiles <= 40 && (meldsBySeat[seat]?.length ?? 0) >= 2
      return (riichi || presumedTenpai) && seat !== ownSeat ? seat : null
    })
    .filter((seat): seat is number => seat !== null)
  if (!targets.length) return []

  const counts = publicCounts(hand, discardsBySeat, meldsBySeat)
  return [...new Set(hand)].map((tile) => {
    const risks = targets.map((seat) => targetRisk(tile, discardsBySeat[seat] ?? [], postRiichiSafeBySeat[seat] ?? [], counts))
    const maxScore = Math.max(...risks.map((risk) => risk.score))
    const level: DangerLevel = maxScore === 0 ? 'safe' : maxScore === 1 ? 'caution' : 'danger'
    const reasons = [...new Set(risks.flatMap((risk) => risk.reasons))]
    return { tile, level, reasons }
  }).sort((left, right) => {
    const levelDifference = RISK_LEVEL[left.level] - RISK_LEVEL[right.level]
    return levelDifference || left.tile.localeCompare(right.tile)
  })
}
