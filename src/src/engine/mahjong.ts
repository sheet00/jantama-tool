export type Counts = number[];

export type DiscardAnalysis = {
  discard: number;
  shanten: number;
  effectiveTiles: number[];
  effectiveTileCount: number;
};

const isSuit = (tile: number) => tile < 27;

/** 通常手（4面子1雀頭）のシャンテン数を返す。鳴き面子は完成面子として扱う。 */
export function standardShanten(input: Counts, fixedMelds = 0): number {
  const counts = [...input];
  let best = 8;
  const memo = new Map<string, number>();

  const visit = (
    index: number,
    melds: number,
    taatsu: number,
    pair: number,
  ) => {
    while (index < 34 && counts[index] === 0) index += 1;
    const usableTaatsu = Math.min(taatsu, 4 - melds);
    if (index === 34) {
      best = Math.min(best, 8 - melds * 2 - usableTaatsu - pair);
      return;
    }

    const key = `${index}|${melds}|${usableTaatsu}|${pair}|${counts.join("")}`;
    const previous = memo.get(key);
    if (previous !== undefined && previous <= best) return;
    memo.set(key, best);

    counts[index] -= 1;
    visit(index, melds, usableTaatsu, pair);
    counts[index] += 1;

    if (counts[index] >= 3) {
      counts[index] -= 3;
      visit(index, melds + 1, usableTaatsu, pair);
      counts[index] += 3;
    }

    if (
      isSuit(index) &&
      index % 9 <= 6 &&
      counts[index + 1] > 0 &&
      counts[index + 2] > 0
    ) {
      counts[index] -= 1;
      counts[index + 1] -= 1;
      counts[index + 2] -= 1;
      visit(index, melds + 1, usableTaatsu, pair);
      counts[index] += 1;
      counts[index + 1] += 1;
      counts[index + 2] += 1;
    }

    if (pair === 0 && counts[index] >= 2) {
      counts[index] -= 2;
      visit(index, melds, usableTaatsu, 1);
      counts[index] += 2;
    }

    if (counts[index] >= 2) {
      counts[index] -= 2;
      visit(index, melds, usableTaatsu + 1, pair);
      counts[index] += 2;
    }

    if (isSuit(index) && index % 9 <= 7 && counts[index + 1] > 0) {
      counts[index] -= 1;
      counts[index + 1] -= 1;
      visit(index, melds, usableTaatsu + 1, pair);
      counts[index] += 1;
      counts[index + 1] += 1;
    }

    if (isSuit(index) && index % 9 <= 6 && counts[index + 2] > 0) {
      counts[index] -= 1;
      counts[index + 2] -= 1;
      visit(index, melds, usableTaatsu + 1, pair);
      counts[index] += 1;
      counts[index + 2] += 1;
    }
  };

  visit(0, fixedMelds, 0, 0);
  return best;
}

export function analyzeDiscards(
  hand: Counts,
  visible: Counts = Array(34).fill(0),
  fixedMelds = 0,
): DiscardAnalysis[] {
  const expectedHandSize = 14 - fixedMelds * 3;
  if (hand.reduce((total, count) => total + count, 0) !== expectedHandSize)
    return [];
  const results: DiscardAnalysis[] = [];

  for (let discard = 0; discard < 34; discard += 1) {
    if (hand[discard] === 0) continue;
    const afterDiscard = [...hand];
    afterDiscard[discard] -= 1;
    const visibleAfterDiscard = [...visible];
    visibleAfterDiscard[discard] += 1;
    const shanten = standardShanten(afterDiscard, fixedMelds);
    const effectiveTiles: number[] = [];

    for (let draw = 0; draw < 34; draw += 1) {
      if (4 - afterDiscard[draw] - visibleAfterDiscard[draw] <= 0) continue;
      const afterDraw = [...afterDiscard];
      afterDraw[draw] += 1;
      if (standardShanten(afterDraw, fixedMelds) < shanten)
        effectiveTiles.push(draw);
    }

    const effectiveTileCount = effectiveTiles.reduce(
      (total, tile) => total + 4 - afterDiscard[tile] - visibleAfterDiscard[tile],
      0,
    );
    results.push({ discard, shanten, effectiveTiles, effectiveTileCount });
  }

  return results.sort(
    (a, b) =>
      a.shanten - b.shanten ||
      b.effectiveTileCount - a.effectiveTileCount ||
      b.effectiveTiles.length - a.effectiveTiles.length ||
      a.discard - b.discard,
  );
}

export function currentShanten(hand: Counts, fixedMelds = 0): number {
  const total = hand.reduce((sum, count) => sum + count, 0);
  const expectedHandSizeAfterDiscard = 13 - fixedMelds * 3;
  if (total !== expectedHandSizeAfterDiscard + 1)
    return standardShanten(hand, fixedMelds);

  let best = 8;
  for (let discard = 0; discard < 34; discard += 1) {
    if (hand[discard] === 0) continue;
    const afterDiscard = [...hand];
    afterDiscard[discard] -= 1;
    best = Math.min(best, standardShanten(afterDiscard, fixedMelds));
  }
  return best;
}

export function currentWaits(
  hand: Counts,
  visible: Counts = Array(34).fill(0),
  fixedMelds = 0,
): number[] {
  const total = hand.reduce((sum, count) => sum + count, 0);
  const expectedHandSizeAfterDiscard = 13 - fixedMelds * 3;
  if (total === expectedHandSizeAfterDiscard + 1) {
    const best = analyzeDiscards(hand, visible, fixedMelds)[0];
    return best?.shanten === 0 ? best.effectiveTiles : [];
  }
  if (
    total !== expectedHandSizeAfterDiscard ||
    standardShanten(hand, fixedMelds) !== 0
  )
    return [];

  return Array.from({ length: 34 }, (_, tile) => tile).filter((tile) => {
    if (4 - hand[tile] - visible[tile] <= 0) return false;
    const next = [...hand];
    next[tile] += 1;
    return standardShanten(next, fixedMelds) < 0;
  });
}
