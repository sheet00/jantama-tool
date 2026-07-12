type Props = { shanten: number; handLength: number }

export function ShantenGauge({ shanten, handLength }: Props) {
  const isTenpai = shanten <= 0
  const displayShanten = isTenpai ? 'テンパイ' : `${shanten}シャンテン`
  const progress = isTenpai ? 100 : Math.max(0, Math.min(100, ((6 - shanten) / 6) * 100))

  return <div className="shanten-gauge" aria-label={`現在${displayShanten}`}>
    <div className="gauge-heading"><span>現在の手牌</span><strong>{handLength ? displayShanten : '—'}</strong></div>
    <div className="gauge-track"><span style={{ width: `${handLength ? progress : 0}%` }} /></div>
    <div className="gauge-scale"><span>遠い</span><span>テンパイ</span></div>
  </div>
}
