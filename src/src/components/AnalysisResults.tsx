import type { DiscardAnalysis } from '../engine/mahjong'
import { TILES } from '../domain/tiles'

type Props = { handLength: number; analysis: DiscardAnalysis[] }

export function AnalysisResults({ handLength, analysis }: Props) {
  return <section className="panel results-panel">
    <div className="panel-heading compact"><div><span className="step">03</span><div><h2>解析結果</h2><p>{handLength === 14 ? '通常手の牌効率でランキング' : '14枚そろうと自動で解析します'}</p></div></div><span className="calculating"><i />{handLength === 14 ? '計算済み' : '待機中'}</span></div>
    {analysis.length ? <div className="result-list">{analysis.map((result, index) => { const tile = TILES[result.discard]; return <article className={`result-card ${index === 0 ? 'best' : ''}`} key={tile.id}><div className="rank">{String(index + 1).padStart(2, '0')}</div><div className={`result-tile tile tile-small suit-${tile.suit}`}>{tile.label}</div><div className="result-main"><div className="result-title"><strong>{index === 0 ? '最有力' : '候補'}</strong><span>{result.shanten === -1 ? '和了形' : `${result.shanten}シャンテン`}</span></div><div className="result-stats"><span><b>{result.effectiveTileCount}枚</b> 有効牌</span><span>{result.effectiveTiles.length}種類</span></div></div><div className="result-arrow">→</div></article> })}</div> : <div className="analysis-empty"><span>14枚の手牌を入力してください</span><small>通常手（4面子1雀頭）のシャンテン数と受け入れを計算します</small></div>}
    <div className="result-footer"><span>通常手のみで計算</span><button className="text-button">指標の詳細 →</button></div>
  </section>
}
