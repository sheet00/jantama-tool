import type { DiscardAnalysis } from '../engine/mahjong'
import { TILES } from '../domain/tiles'

type Props = { handLength: number; analysis: DiscardAnalysis[] }

export function AnalysisResults({ handLength, analysis }: Props) {
  return <section className="panel results-panel">
    <div className="panel-heading compact"><div><span className="step">02</span><div><h2>おすすめの捨て牌</h2></div></div><span className="calculating"><i />{handLength === 14 ? '計算済み' : '待機中'}</span></div>
    {analysis.length ? <div className="result-list">{analysis.map((result, index) => { const tile = TILES[result.discard]; const effectiveNames = result.effectiveTiles.map((effectiveTile) => TILES[effectiveTile].label).join('・'); return <article className={`result-card ${index === 0 ? 'best' : ''}`} key={tile.id}><div className="rank">{String(index + 1).padStart(2, '0')}</div><div className={`result-tile tile tile-small suit-${tile.suit}`}><img className="tile-art" src={`/tiles/${tile.asset}`} alt="" /></div><div className="result-main"><div className="result-title"><strong>{index === 0 ? 'おすすめ' : '候補'}</strong><span>{result.shanten === -1 ? '和了形' : `${result.shanten}シャンテン`}</span></div><div className="result-stats"><span>次に引きたい牌: <b>{effectiveNames || 'なし'}</b></span><span>山に残り: <b>{result.effectiveTileCount}枚</b></span></div></div><div className="result-arrow">→</div></article> })}</div> : <div className="analysis-empty"><span>14枚の手牌を入力してください</span><small>14枚そろうと、おすすめの捨て牌を表示します</small></div>}
    <div className="result-footer"><span>通常手の牌効率で計算</span><button className="text-button">詳しい見方 →</button></div>
  </section>
}
