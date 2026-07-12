import type { Tile } from '../domain/tiles'
import { TILES, tileById } from '../domain/tiles'
import { TilePalette } from './TilePalette'

type Props = {
  hand: string[]
  counts: Record<string, number>
  historyLength: number
  onAdd: (tile: Tile) => void
  onRemove: (id: string) => void
  onUndo: () => void
  onReset: () => void
}

export function HandEditor({ hand, counts, historyLength, onAdd, onRemove, onUndo, onReset }: Props) {
  const drawnTile = hand.length === 14 ? hand[hand.length - 1] : undefined
  const sortedHand = hand.slice(0, drawnTile ? -1 : undefined).sort((a, b) => TILES.findIndex((tile) => tile.id === a) - TILES.findIndex((tile) => tile.id === b))
  const displayHand = drawnTile ? [...sortedHand, drawnTile] : sortedHand

  return <section className="panel input-panel">
    <div className="panel-heading"><div><span className="step">01</span><div><h2>牌を入力</h2><p>手牌を選択してください</p></div></div><div className="heading-actions"><button className="text-button" onClick={onUndo} disabled={!historyLength}>↶ 元に戻す</button><button className="text-button" onClick={onReset}>すべてリセット ↺</button></div></div>
    <div className="destination-tabs"><button className="active">手牌 <b>{hand.length}/14</b></button></div>
    <div className="tile-row hand-row" aria-label="現在の手牌">{displayHand.length ? <>{sortedHand.map((id, index) => <button key={`${id}-${index}`} className={`tile tile-large suit-${tileById(id).suit}`} onClick={() => onRemove(id)} aria-label={`${tileById(id).label}を手牌から削除`}>{tileById(id).label}</button>)}{drawnTile && <><span className="drawn-separator" aria-hidden="true" /><button className={`tile tile-large drawn-tile suit-${tileById(drawnTile).suit}`} onClick={() => onRemove(drawnTile)} aria-label={`${tileById(drawnTile).label}（自摸牌）を手牌から削除`}>{tileById(drawnTile).label}<small>自摸</small></button></>}</> : <span className="empty-state">牌パレットから牌を追加</span>}</div>
    <div className="input-meta"><span className={hand.length === 14 ? 'valid' : ''}>{hand.length === 14 ? '✓ 解析準備完了' : `あと${14 - hand.length}枚で解析できます`}</span><code>{displayHand.map((id) => tileById(id).short).join(' ') || '—'}</code></div>
    <TilePalette handLength={hand.length} counts={counts} onAdd={onAdd} />
  </section>
}
