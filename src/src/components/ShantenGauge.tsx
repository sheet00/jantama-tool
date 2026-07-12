import { TILES } from '../domain/tiles'

type Props = { shanten: number; handLength: number; waits: number[] }

export function ShantenGauge({ shanten, handLength, waits }: Props) {
  const isTenpai = shanten <= 0
  const displayShanten = isTenpai ? 'テンパイ' : `${shanten}シャンテン`
  const progress = isTenpai ? 100 : Math.max(0, Math.min(100, ((6 - shanten) / 6) * 100))

  return <div className="shanten-gauge" aria-label={`現在${displayShanten}`}>
    <div className="gauge-heading"><span>現在の手牌</span><strong>{handLength ? displayShanten : '—'}</strong></div>
    <div className="gauge-track"><span style={{ width: `${handLength ? progress : 0}%` }} /></div>
    {isTenpai && waits.length > 0 && <div className="wait-display"><span>待ち</span><div>{waits.map((tile) => <img key={tile} src={`/tiles/${TILES[tile].asset}`} alt={TILES[tile].label} title={TILES[tile].label} />)}</div></div>}
  </div>
}
