export type Counts = number[]

export type DiscardAnalysis = {
  discard: number
  shanten: number
  effectiveTiles: number[]
  effectiveTileCount: number
}

const isSuit = (tile: number) => tile < 27

/** 通常手（4面子1雀頭）だけのシャンテン数を返す。 */
export function standardShanten(input: Counts): number {
  const counts = [...input]
  let best = 8
  const memo = new Map<string, number>()

  const visit = (index: number, melds: number, taatsu: number, pair: number) => {
    while (index < 34 && counts[index] === 0) index += 1
    const usableTaatsu = Math.min(taatsu, 4 - melds)
    if (index === 34) {
      best = Math.min(best, 8 - melds * 2 - usableTaatsu - pair)
      return
    }

    const key = `${index}|${melds}|${usableTaatsu}|${pair}|${counts.join('')}`
    const previous = memo.get(key)
    if (previous !== undefined && previous <= best) return
    memo.set(key, best)

    counts[index] -= 1
    visit(index, melds, usableTaatsu, pair)
    counts[index] += 1

    if (counts[index] >= 3) {
      counts[index] -= 3
      visit(index, melds + 1, usableTaatsu, pair)
      counts[index] += 3
    }

    if (isSuit(index) && index % 9 <= 6 && counts[index + 1] > 0 && counts[index + 2] > 0) {
      counts[index] -= 1; counts[index + 1] -= 1; counts[index + 2] -= 1
      visit(index, melds + 1, usableTaatsu, pair)
      counts[index] += 1; counts[index + 1] += 1; counts[index + 2] += 1
    }

    if (pair === 0 && counts[index] >= 2) {
      counts[index] -= 2
      visit(index, melds, usableTaatsu, 1)
      counts[index] += 2
    }

    if (counts[index] >= 2) {
      counts[index] -= 2
      visit(index, melds, usableTaatsu + 1, pair)
      counts[index] += 2
    }

    if (isSuit(index) && index % 9 <= 7 && counts[index + 1] > 0) {
      counts[index] -= 1; counts[index + 1] -= 1
      visit(index, melds, usableTaatsu + 1, pair)
      counts[index] += 1; counts[index + 1] += 1
    }

    if (isSuit(index) && index % 9 <= 6 && counts[index + 2] > 0) {
      counts[index] -= 1; counts[index + 2] -= 1
      visit(index, melds, usableTaatsu + 1, pair)
      counts[index] += 1; counts[index + 2] += 1
    }
  }

  visit(0, 0, 0, 0)
  return best
}

export function analyzeDiscards(hand: Counts, visible: Counts = Array(34).fill(0)): DiscardAnalysis[] {
  if (hand.reduce((total, count) => total + count, 0) !== 14) return []
  const results: DiscardAnalysis[] = []

  for (let discard = 0; discard < 34; discard += 1) {
    if (hand[discard] === 0) continue
    const afterDiscard = [...hand]
    afterDiscard[discard] -= 1
    const shanten = standardShanten(afterDiscard)
    const effectiveTiles: number[] = []

    for (let draw = 0; draw < 34; draw += 1) {
      if (4 - afterDiscard[draw] - visible[draw] <= 0) continue
      const afterDraw = [...afterDiscard]
      afterDraw[draw] += 1
      if (standardShanten(afterDraw) < shanten) effectiveTiles.push(draw)
    }

    const effectiveTileCount = effectiveTiles.reduce((total, tile) => total + 4 - afterDiscard[tile] - visible[tile], 0)
    results.push({ discard, shanten, effectiveTiles, effectiveTileCount })
  }

  return results.sort((a, b) => a.shanten - b.shanten || b.effectiveTileCount - a.effectiveTileCount || b.effectiveTiles.length - a.effectiveTiles.length || a.discard - b.discard)
}

export function currentShanten(hand: Counts): number {
  const total = hand.reduce((sum, count) => sum + count, 0)
  if (total !== 14) return standardShanten(hand)

  let best = 8
  for (let discard = 0; discard < 34; discard += 1) {
    if (hand[discard] === 0) continue
    const afterDiscard = [...hand]
    afterDiscard[discard] -= 1
    best = Math.min(best, standardShanten(afterDiscard))
  }
  return best
}
