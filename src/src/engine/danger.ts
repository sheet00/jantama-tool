export type DangerLevel = 'safe' | 'caution' | 'danger'

export type DangerAssessment = {
  tile: string
  level: DangerLevel
  /** 0.0（最も安全）〜 1.0（最も危険）の連続スコア。同一 level 内での比較に使う。 */
  dangerScore: number
  reasons: string[]
}

const RISK_LEVEL: Record<DangerLevel, number> = { safe: 0, caution: 1, danger: 2 }

function isSuited(tile: string): boolean {
  return tile.length === 2 && ['m', 'p', 's'].includes(tile[1])
}

function isHonor(tile: string): boolean {
  return tile.length === 2 && tile[1] === 'z'
}

/**
 * 牌の位置（rank 1〜9）から、両面・カンチャン・タンキを含めた
 * 待ち形の最大パターン数を返す（中張牌ほど多い）。
 */
function maxWaitPatterns(rank: number): number {
  // 両面: min(rank-1, 9-rank, 2)パターン（ただし端から2枚は1パターン）
  // カンチャン: rank-1>=1 && rank+1<=9 の組み合わせ（前後2枚）
  // タンキ: 常に1パターン
  // 概算: rank=1→2, rank=2→4, rank=3→5, rank=4..6→6, rank=7→5, rank=8→4, rank=9→2
  const table: Record<number, number> = { 1: 2, 2: 4, 3: 5, 4: 6, 5: 6, 6: 6, 7: 5, 8: 4, 9: 2 }
  return table[rank] ?? 4
}

function honorRisk(tile: string, counts: Map<string, number>): { score: number; dangerScore: number; reasons: string[] } {
  const visible = counts.get(tile) ?? 0
  if (visible >= 4) return { score: 0, dangerScore: 0, reasons: ['4枚見え'] }
  if (visible === 3) return { score: 1, dangerScore: 0.15, reasons: ['3枚見え'] }

  const remaining = 4 - visible
  const role = ['5z', '6z', '7z'].includes(tile) ? '役牌' : '役牌候補'
  // 字牌は待ち形がタンキのみ。残り枚数が多いほど危険。
  const dangerScore = 0.25 + (remaining / 4) * 0.35
  return { score: 2, dangerScore, reasons: [visible === 0 ? `生牌・${role}` : `字牌残り${remaining}枚・${role}`] }
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

function targetRisk(tile: string, targetDiscards: string[], postRiichiSafe: string[], counts: Map<string, number>): { score: number; dangerScore: number; reasons: string[] } {
  if (targetDiscards.includes(tile) || postRiichiSafe.includes(tile)) return { score: 0, dangerScore: 0, reasons: ['現物'] }
  if (isHonor(tile)) return honorRisk(tile, counts)

  const rank = Number(tile[0])
  const suit = tile[1]
  const patterns = maxWaitPatterns(rank)
  // 基礎スコア: 待ち形パターン数を 0.3〜1.0 にマッピング（最大6パターン）
  const baseScore = 0.3 + (patterns / 6) * 0.7

  const reasons: string[] = []
  let score = 2
  let multiplier = 1.0

  const isSuji = sujiTiles(tile).some((suji) => targetDiscards.includes(suji))
  if (isSuji) {
    score = 1
    multiplier *= 0.55
    reasons.push('筋')
  }

  const wallTiles = [rank - 1, rank + 1].filter((value) => value >= 1 && value <= 9).map((value) => tileAt(suit, value))
  const wall = wallTiles.filter((wallTile) => counts.get(wallTile) === 4)
  const oneChance = wallTiles.filter((wallTile) => counts.get(wallTile) === 3)
  if (wall.length) {
    score = Math.min(score, 1)
    multiplier *= wall.length >= 2 ? 0.3 : 0.5
    reasons.push(`壁（${wall.join('・')}）`)
  } else if (oneChance.length) {
    multiplier *= oneChance.length >= 2 ? 0.65 : 0.8
    reasons.push(`ワンチャンス（${oneChance.join('・')}）`)
  }

  if (!reasons.length) reasons.push('無筋')
  const dangerScore = Math.min(1, baseScore * multiplier)
  return { score, dangerScore, reasons }
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
    const maxDangerScore = Math.max(...risks.map((risk) => risk.dangerScore))
    const level: DangerLevel = maxScore === 0 ? 'safe' : maxScore === 1 ? 'caution' : 'danger'
    const reasons = [...new Set(risks.flatMap((risk) => risk.reasons))]
    return { tile, level, dangerScore: maxDangerScore, reasons }
  }).sort((left, right) => {
    const levelDifference = RISK_LEVEL[left.level] - RISK_LEVEL[right.level]
    // 同じ level 内では dangerScore の低い順（最も危険を一番下に）
    return levelDifference || left.dangerScore - right.dangerScore
  })
}
