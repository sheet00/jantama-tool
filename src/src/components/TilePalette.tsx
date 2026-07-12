import { TILES, type Suit, type Tile } from '../domain/tiles'

export type Destination = 'hand' | 'visible'

type Props = {
  handLength: number
  counts: Record<string, number>
  destination: Destination
  onAdd: (tile: Tile) => void
}

const suitName: Record<Suit, string> = { m: '萬子', p: '筒子', s: '索子', z: '字牌' }

export function TilePalette({ handLength, counts, destination, onAdd }: Props) {
  return <div className="palette">
    <div className="subheading"><span>牌パレット</span><small>{destination === 'hand' && handLength >= 14 ? '手牌は14枚です' : `${destination === 'hand' ? '手牌' : '捨て牌'}に追加`}</small></div>
    {(['m', 'p', 's', 'z'] as Suit[]).map((suit) => <div className="palette-row" key={suit}>
      <span className={`suit-label suit-${suit}`}>{suitName[suit]}</span>
      <div>{TILES.filter((tile) => tile.suit === suit).map((tile) => <button key={tile.id} className={`tile tile-palette suit-${tile.suit}`} onClick={() => onAdd(tile)} disabled={(counts[tile.id] ?? 0) >= 4 || (destination === 'hand' && handLength >= 14)} aria-label={`${tile.label}を${destination === 'hand' ? '手牌' : '捨て牌'}に追加`}>
        {tile.label}<i>{counts[tile.id] ? counts[tile.id] : ''}</i>
      </button>)}</div>
    </div>)}
  </div>
}
