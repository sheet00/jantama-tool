export type Suit = 'm' | 'p' | 's' | 'z'

export type Tile = {
  id: string
  label: string
  short: string
  asset: string
  suit: Suit
  value: number
}

export const TILES: Tile[] = [
  ...Array.from({ length: 9 }, (_, index) => ({ id: `${index + 1}m`, label: `${index + 1}萬`, short: `${index + 1}m`, asset: `Man${index + 1}.svg`, suit: 'm' as Suit, value: index + 1 })),
  ...Array.from({ length: 9 }, (_, index) => ({ id: `${index + 1}p`, label: `${index + 1}筒`, short: `${index + 1}p`, asset: `Pin${index + 1}.svg`, suit: 'p' as Suit, value: index + 1 })),
  ...Array.from({ length: 9 }, (_, index) => ({ id: `${index + 1}s`, label: `${index + 1}索`, short: `${index + 1}s`, asset: `Sou${index + 1}.svg`, suit: 's' as Suit, value: index + 1 })),
  ...['東', '南', '西', '北', '白', '發', '中'].map((label, index) => ({ id: `${index + 1}z`, label, short: `${index + 1}z`, asset: ['Ton.svg', 'Nan.svg', 'Shaa.svg', 'Pei.svg', 'Haku.svg', 'Hatsu.svg', 'Chun.svg'][index], suit: 'z' as Suit, value: index + 1 })),
]

export const INITIAL_HAND = ['2m', '3m', '4m', '6m', '7m', '2p', '3p', '5p', '7p', '2s', '3s', '4s', '6s']

export const tileById = (id: string) => TILES.find((tile) => tile.id === id) ?? TILES[0]

export const toTileCounts = (hand: string[]) => TILES.map((tile) => hand.filter((id) => id === tile.id).length)
