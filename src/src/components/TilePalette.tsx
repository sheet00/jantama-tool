import { TILES, type Suit, type Tile } from '../domain/tiles'

export type Destination = 'hand' | 'visible'

type Props = {
  handLength: number
  counts: Record<string, number>
  destination: Destination
  onDestinationChange: (destination: Destination) => void
  onAdd: (tile: Tile) => void
}

const suitName: Record<Suit, string> = { m: '萬子', p: '筒子', s: '索子', z: '字牌' }

export function TilePalette({ handLength, counts, destination, onDestinationChange, onAdd }: Props) {
  return <div className={`palette ${destination === 'visible' ? 'palette-visible' : ''}`}>
    <div className="palette-heading"><span>牌パレット</span><button className="palette-mode-toggle" role="switch" aria-checked={destination === 'visible'} onClick={() => onDestinationChange(destination === 'hand' ? 'visible' : 'hand')}>{destination === 'hand' ? '手牌モード' : '捨牌モード'}</button></div>
    {(['m', 'p', 's', 'z'] as Suit[]).map((suit) => <div className="palette-row" key={suit}>
      <span className={`suit-label suit-${suit}`}>{suitName[suit]}</span>
      <div>{TILES.filter((tile) => tile.suit === suit).map((tile) => <button key={tile.id} className={`tile tile-palette suit-${tile.suit}`} onClick={() => onAdd(tile)} disabled={(counts[tile.id] ?? 0) >= 4 || (destination === 'hand' && handLength >= 14)} aria-label={`${tile.label}を${destination === 'hand' ? '手牌' : '捨て牌'}に追加`}>
        <img className="tile-art" src={`/tiles/${tile.asset}`} alt="" /><i>{counts[tile.id] ? counts[tile.id] : ''}</i>
      </button>)}</div>
    </div>)}
  </div>
}
