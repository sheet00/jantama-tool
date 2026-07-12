import { TILES, type Suit, type Tile } from '../domain/tiles'

type Props = {
  handLength: number
  counts: Record<string, number>
  onAdd: (tile: Tile) => void
}

const suitName: Record<Suit, string> = { m: '萬子', p: '筒子', s: '索子', z: '字牌' }

export function TilePalette({ handLength, counts, onAdd }: Props) {
  return <div className="palette">
    <div className="subheading"><span>牌パレット</span><small>{handLength >= 14 ? '手牌は14枚です' : 'クリックして追加'}</small></div>
    {(['m', 'p', 's', 'z'] as Suit[]).map((suit) => <div className="palette-row" key={suit}>
      <span className={`suit-label suit-${suit}`}>{suitName[suit]}</span>
      <div>{TILES.filter((tile) => tile.suit === suit).map((tile) => <button key={tile.id} className={`tile tile-palette suit-${tile.suit}`} onClick={() => onAdd(tile)} disabled={(counts[tile.id] ?? 0) >= 4 || handLength >= 14} aria-label={`${tile.label}を手牌に追加`}>
        {tile.label}<i>{counts[tile.id] ? counts[tile.id] : ''}</i>
      </button>)}</div>
    </div>)}
  </div>
}
