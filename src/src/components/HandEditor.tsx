import type { Tile } from '../domain/tiles'
import { tileById } from '../domain/tiles'
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
  const sortedHand = [...hand].sort((a, b) => tileById(a).value - tileById(b).value || tileById(a).id.localeCompare(tileById(b).id))

  return <section className="panel input-panel">
    <div className="panel-heading"><div><span className="step">01</span><div><h2>牌を入力</h2><p>手牌を選択してください</p></div></div><div className="heading-actions"><button className="text-button" onClick={onUndo} disabled={!historyLength}>↶ 元に戻す</button><button className="text-button" onClick={onReset}>すべてリセット ↺</button></div></div>
    <div className="destination-tabs"><button className="active">手牌 <b>{hand.length}/14</b></button></div>
    <div className="tile-row hand-row" aria-label="現在の手牌">{sortedHand.length ? sortedHand.map((id, index) => <button key={`${id}-${index}`} className="tile tile-large" onClick={() => onRemove(id)} aria-label={`${tileById(id).label}を手牌から削除`}>{tileById(id).label}</button>) : <span className="empty-state">牌パレットから牌を追加</span>}</div>
    <div className="input-meta"><span className={hand.length === 14 ? 'valid' : ''}>{hand.length === 14 ? '✓ 解析準備完了' : `あと${14 - hand.length}枚で解析できます`}</span><code>{sortedHand.map((id) => tileById(id).short).join(' ') || '—'}</code></div>
    <TilePalette handLength={hand.length} counts={counts} onAdd={onAdd} />
  </section>
}
