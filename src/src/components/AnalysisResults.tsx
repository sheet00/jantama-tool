import type { DiscardAnalysis } from '../engine/mahjong'
import { TILES } from '../domain/tiles'

type Props = { handLength: number; expectedHandLength: number; analysis: DiscardAnalysis[] }

function sameRank(left: DiscardAnalysis, right: DiscardAnalysis): boolean {
  return left.shanten === right.shanten &&
    left.effectiveTileCount === right.effectiveTileCount
}

function rankFor(analysis: DiscardAnalysis[], index: number): number {
  const firstIndex = analysis.findIndex((candidate) => sameRank(candidate, analysis[index]))
  return firstIndex + 1
}

function tieGroupFor(analysis: DiscardAnalysis[], index: number): number | null {
  const firstIndex = analysis.findIndex((candidate) => sameRank(candidate, analysis[index]))
  const tied = firstIndex + 1 < analysis.length && sameRank(analysis[firstIndex], analysis[firstIndex + 1])
  return tied ? firstIndex % 3 : null
}

export function AnalysisResults({ handLength, expectedHandLength, analysis }: Props) {
  return <section className="panel results-panel">
    <div className="panel-heading compact"><div><span className="step">02</span><div><h2>おすすめの捨て牌</h2></div></div><span className="calculating"><i />{handLength === expectedHandLength ? '計算済み' : '待機中'}</span></div>
    {analysis.length ? <div className="result-list">{analysis.map((result, index) => { const tile = TILES[result.discard]; const tieGroup = tieGroupFor(analysis, index); const tieClass = tieGroup === null ? '' : `tie-group-${tieGroup}`; return <article className={`result-card ${index === 0 ? 'best' : ''} ${tieClass}`} key={tile.id}><div className="rank">{String(rankFor(analysis, index)).padStart(2, '0')}</div><div className={`result-tile tile tile-small suit-${tile.suit}`}><img className="tile-art" src={`/tiles/${tile.asset}`} alt="" /></div><div className="result-main"><div className="result-title"><span>{result.shanten === -1 ? '和了形' : `${result.shanten}シャンテン`}</span></div><div className="result-stats"><span>受け入れ有効牌</span><b>{result.effectiveTileCount}枚</b></div></div></article> })}</div> : <div className="analysis-empty" />}
  </section>
}
