import { useMemo, useState } from 'react'
import './App.css'

type Destination = 'hand' | 'visible'
type Suit = 'm' | 'p' | 's' | 'z'

type Tile = {
  id: string
  label: string
  short: string
  suit: Suit
  value: number
}

const tiles: Tile[] = [
  ...Array.from({ length: 9 }, (_, index) => ({ id: `${index + 1}m`, label: `${index + 1}萬`, short: `${index + 1}m`, suit: 'm' as Suit, value: index + 1 })),
  ...Array.from({ length: 9 }, (_, index) => ({ id: `${index + 1}p`, label: `${index + 1}筒`, short: `${index + 1}p`, suit: 'p' as Suit, value: index + 1 })),
  ...Array.from({ length: 9 }, (_, index) => ({ id: `${index + 1}s`, label: `${index + 1}索`, short: `${index + 1}s`, suit: 's' as Suit, value: index + 1 })),
  ...['東', '南', '西', '北', '白', '發', '中'].map((label, index) => ({ id: `${index + 1}z`, label, short: `${index + 1}z`, suit: 'z' as Suit, value: index + 1 })),
]

const initialHand = ['2m', '3m', '4m', '6m', '7m', '2p', '3p', '5p', '7p', '2s', '3s', '4s', '6s']
const initialVisible: string[] = []

const sampleResults = [
  { tile: '6s', label: '6索', shanten: 1, effective: '3種 9枚', tenpai: '68.4%', win: '12.8%', wait: '74%' },
  { tile: '7p', label: '7筒', shanten: 1, effective: '4種 12枚', tenpai: '65.1%', win: '11.9%', wait: '69%' },
  { tile: '2s', label: '2索', shanten: 1, effective: '4種 13枚', tenpai: '63.7%', win: '11.4%', wait: '67%' },
  { tile: '4s', label: '4索', shanten: 1, effective: '3種 10枚', tenpai: '61.8%', win: '10.7%', wait: '63%' },
]

function App() {
  const [destination, setDestination] = useState<Destination>('hand')
  const [hand, setHand] = useState(initialHand)
  const [visible, setVisible] = useState(initialVisible)
  const [futureDraws, setFutureDraws] = useState(8)
  const [simulations, setSimulations] = useState('5,000')
  const [ranking, setRanking] = useState('win')
  const [history, setHistory] = useState<string[][]>([])

  const counts = useMemo(() => [...hand, ...visible].reduce<Record<string, number>>((all, id) => ({ ...all, [id]: (all[id] ?? 0) + 1 }), {}), [hand, visible])
  const getTile = (id: string) => tiles.find((tile) => tile.id === id) ?? tiles[0]
  const sortedHand = [...hand].sort((a, b) => tiles.findIndex((tile) => tile.id === a) - tiles.findIndex((tile) => tile.id === b))

  const pushHistory = () => setHistory((current) => [...current.slice(-9), [...hand, '|', ...visible]])

  const addTile = (tile: Tile) => {
    if ((counts[tile.id] ?? 0) >= 4) return
    if (destination === 'hand' && hand.length >= 14) return
    pushHistory()
    if (destination === 'hand' && hand.length < 14) setHand((current) => [...current, tile.id])
    if (destination === 'visible') setVisible((current) => [...current, tile.id])
  }

  const removeTile = (id: string, from: Destination) => {
    pushHistory()
    const setter = from === 'hand' ? setHand : setVisible
    setter((current) => {
      const index = current.indexOf(id)
      return index === -1 ? current : [...current.slice(0, index), ...current.slice(index + 1)]
    })
  }

  const undo = () => {
    const previous = history.at(-1)
    if (!previous) return
    setHistory((current) => current.slice(0, -1))
    const divider = previous.indexOf('|')
    setHand(previous.slice(0, divider))
    setVisible(previous.slice(divider + 1))
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">牌</span><div><strong>麻雀解析室</strong><small>RIICHI ANALYZER</small></div></div>
        <div className="topbar-actions"><span className="status-dot" /> <span>自動保存済み</span><button className="icon-button" aria-label="設定">⚙</button></div>
      </header>

      <section className="hero-copy">
        <div><p className="eyebrow">DISCARD ANALYSIS / 01</p><h1>いま、何を切る？</h1><p className="lead">手牌と見えている牌から、最も和了に近づく一打を解析します。</p></div>
        <div className="assumption"><span>◌</span><div><strong>一様分布モデル</strong><small>見えていない牌は均等に自摸すると仮定</small></div></div>
      </section>

      <div className="workspace">
        <section className="panel input-panel">
          <div className="panel-heading"><div><span className="step">01</span><div><h2>牌を入力</h2><p>手牌を選択してください</p></div></div><div className="heading-actions"><button className="text-button" onClick={undo} disabled={!history.length}>↶ 元に戻す</button><button className="text-button" onClick={() => { setHand([]); setVisible([]); setHistory([]) }}>すべてリセット ↺</button></div></div>
          <div className="destination-tabs"><button className="active" onClick={() => setDestination('hand')}>手牌 <b>{hand.length}/14</b></button></div>
          <div className="tile-row hand-row" aria-label="現在の手牌">{sortedHand.length ? sortedHand.map((id) => <button key={id} className="tile tile-large" onClick={() => removeTile(id, 'hand')} aria-label={`${getTile(id).label}を手牌から削除`}>{getTile(id).label}</button>) : <span className="empty-state">牌パレットから牌を追加</span>}</div>
          <div className="input-meta"><span className={hand.length === 14 ? 'valid' : ''}>{hand.length === 14 ? '✓ 解析準備完了' : `あと${14 - hand.length}枚で解析できます`}</span><code>{sortedHand.map((id) => getTile(id).short).join(' ') || '—'}</code></div>
          <div className="palette"><div className="subheading"><span>牌パレット</span><small>{hand.length >= 14 ? '手牌は14枚です' : 'クリックして追加 / クリックで削除'}</small></div>{(['m', 'p', 's', 'z'] as Suit[]).map((suit) => <div className="palette-row" key={suit}><span className={`suit-label suit-${suit}`}>{suit === 'm' ? '萬子' : suit === 'p' ? '筒子' : suit === 's' ? '索子' : '字牌'}</span><div>{tiles.filter((tile) => tile.suit === suit).map((tile) => <button key={tile.id} className={`tile tile-palette suit-${tile.suit}`} onClick={() => addTile(tile)} disabled={(counts[tile.id] ?? 0) >= 4 || (destination === 'hand' && hand.length >= 14)} aria-label={`${tile.label}を${destination === 'hand' ? '手牌' : '見えている牌'}に追加`}>{tile.label}<i>{counts[tile.id] ? counts[tile.id] : ''}</i></button>)}</div></div>)}</div>
        </section>

        <aside className="right-column">
          <section className="panel settings-panel"><div className="panel-heading compact"><div><span className="step">02</span><div><h2>解析条件</h2><p>シミュレーションの設定</p></div></div><span className="live-pill">LIVE</span></div><label>今後の自摸回数 <output>{futureDraws} 回</output><input type="range" min="1" max="18" value={futureDraws} onChange={(event) => setFutureDraws(Number(event.target.value))} /></label><div className="control-grid"><label>シミュレーション<select value={simulations} onChange={(event) => setSimulations(event.target.value)}><option>5,000</option><option>10,000</option><option>50,000</option></select></label><label>ランキング指標<select value={ranking} onChange={(event) => setRanking(event.target.value)}><option value="win">和了確率</option><option value="tenpai">テンパイ確率</option><option value="effective">有効牌の枚数</option></select></label></div><button className="advanced">詳細設定 <span>⌄</span></button></section>

          <section className="panel results-panel"><div className="panel-heading compact"><div><span className="step">03</span><div><h2>解析結果</h2><p>{simulations}回のシミュレーション · {futureDraws}自摸</p></div></div><span className="calculating"><i />計算済み</span></div><div className="result-list">{sampleResults.map((result, index) => <article className={`result-card ${index === 0 ? 'best' : ''}`} key={result.tile}><div className="rank">{String(index + 1).padStart(2, '0')}</div><div className="result-tile tile tile-small">{result.label}</div><div className="result-main"><div className="result-title"><strong>{index === 0 ? '最有力' : '候補'}</strong><span>{result.shanten}シャンテン</span></div><div className="result-stats"><span><b>{result.win}</b> 和了</span><span><b>{result.tenpai}</b> テンパイ</span><span>{result.effective}</span></div></div><div className="result-arrow">→</div></article>)}</div><div className="result-footer"><span>結果は推定値です</span><button className="text-button">詳しい指標を見る →</button></div></section>
        </aside>
      </div>
      <footer><span>麻雀解析室 <b>v0.1</b></span><span>相手の手牌・鳴き・点数状況は考慮していません</span></footer>
    </main>
  )
}

export default App
