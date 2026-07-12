import { useState } from 'react'
import { TILES, tileById } from '../domain/tiles'
import { ShantenGauge } from './ShantenGauge'

type Props = {
  hand: string[]
  discardsBySeat: string[][]
  meldsBySeat: string[][][]
  analysisHandLength: number
  shanten: number
  waits: number[]
  historyLength: number
  onRemove: (id: string) => void
  onRemoveDiscard: (id: string, seat: number) => void
  onRemoveMeldTile: (seat: number, meldIndex: number, tileIndex: number) => void
  onUndo: () => void
  onReset: () => void
}

export function HandEditor({ hand, discardsBySeat, meldsBySeat, analysisHandLength, shanten, waits, historyLength, onRemove, onRemoveDiscard, onRemoveMeldTile, onUndo, onReset }: Props) {
  const [discardsOpen, setDiscardsOpen] = useState(false)
  const drawnTile = hand.length === analysisHandLength ? hand[hand.length - 1] : undefined
  const handStatus = hand.length === analysisHandLength ? '✓ 解析準備完了' : hand.length < analysisHandLength ? `あと${analysisHandLength - hand.length}枚で解析できます` : '手牌枚数を確認してください'
  const handStatusClass = hand.length === analysisHandLength ? 'valid' : ''
  const sortedHand = hand.slice(0, drawnTile ? -1 : undefined).sort((a, b) => TILES.findIndex((tile) => tile.id === a) - TILES.findIndex((tile) => tile.id === b))
  const displayHand = drawnTile ? [...sortedHand, drawnTile] : sortedHand

  return <section className="panel input-panel">
    <div className="panel-heading"><div><span className="step">01</span><div><h2>牌を入力</h2></div></div><div className="heading-actions"><button className="text-button" onClick={onUndo} disabled={!historyLength}>↶ 元に戻す</button><button className="text-button" onClick={onReset}>すべてリセット ↺</button></div></div>
    <ShantenGauge shanten={shanten} handLength={hand.length} waits={waits} />
    <div className="visible-editor"><button className="discard-toggle" aria-expanded={discardsOpen} onClick={() => setDiscardsOpen((open) => !open)}><span><strong>捨て牌・見えている牌</strong><small>座席ごとに表示・解析時は合算</small></span><b>{discardsOpen ? '閉じる −' : '開く ＋'}</b></button>{discardsOpen && discardsBySeat.map((row, seat) => { const melds = meldsBySeat[seat] ?? []; return <div className="discard-seat" key={seat}><span>座席{seat + 1}</span><div className="tile-row visible-row">{row.map((id, index) => <button key={`discard-${id}-${index}`} className={`tile tile-small suit-${tileById(id).suit}`} onClick={() => onRemoveDiscard(id, seat)} aria-label={`座席${seat + 1}の${tileById(id).label}を削除`}><img className="tile-art" src={`/tiles/${tileById(id).asset}`} alt="" /></button>)}{melds.length ? <div className="meld-area" aria-label={`座席${seat + 1}の鳴き牌`}>{melds.map((meld, meldIndex) => <div className="meld-group" key={`meld-${meldIndex}`}>{meld.map((id, tileIndex) => <button key={`meld-${meldIndex}-${id}-${tileIndex}`} className={`tile tile-small suit-${tileById(id).suit}`} onClick={() => onRemoveMeldTile(seat, meldIndex, tileIndex)} aria-label={`座席${seat + 1}の鳴き牌${tileById(id).label}を削除`}><img className="tile-art" src={`/tiles/${tileById(id).asset}`} alt="" /></button>)}</div>)}</div> : null}{row.length || melds.length ? null : <span className="empty-state">—</span>}</div></div> })}</div>
    <div className="tile-row hand-row" aria-label="現在の手牌">{displayHand.length ? <>{sortedHand.map((id, index) => <button key={`${id}-${index}`} className={`tile tile-large suit-${tileById(id).suit}`} onClick={() => onRemove(id)} aria-label={`${tileById(id).label}を手牌から削除`}><img className="tile-art" src={`/tiles/${tileById(id).asset}`} alt="" /></button>)}{drawnTile && <><span className="drawn-separator" aria-hidden="true" /><button className={`tile tile-large drawn-tile suit-${tileById(drawnTile).suit}`} onClick={() => onRemove(drawnTile)} aria-label={`${tileById(drawnTile).label}（自摸牌）を手牌から削除`}><img className="tile-art" src={`/tiles/${tileById(drawnTile).asset}`} alt="" /></button></>}</> : <span className="empty-state">牌パレットから牌を追加</span>}</div>
    <div className="input-meta"><span className={handStatusClass}>{handStatus}</span><code>{displayHand.map((id) => tileById(id).short).join(' ') || '—'}</code></div>
  </section>
}
