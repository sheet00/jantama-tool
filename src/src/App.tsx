import { useMemo, useState } from 'react'
import './App.css'
import { AnalysisResults } from './components/AnalysisResults'
import { AnalysisRules } from './components/AnalysisRules'
import { HandEditor } from './components/HandEditor'
import { INITIAL_HAND, toTileCounts, type Tile } from './domain/tiles'
import { analyzeDiscards } from './engine/mahjong'

function App() {
  const [hand, setHand] = useState(INITIAL_HAND)
  const [history, setHistory] = useState<string[][]>([])
  const counts = useMemo(() => hand.reduce<Record<string, number>>((all, id) => ({ ...all, [id]: (all[id] ?? 0) + 1 }), {}), [hand])
  const analysis = useMemo(() => analyzeDiscards(toTileCounts(hand)), [hand])

  const saveHistory = () => setHistory((current) => [...current.slice(-9), [...hand]])

  const addTile = (tile: Tile) => {
    if (hand.length >= 14 || (counts[tile.id] ?? 0) >= 4) return
    saveHistory()
    setHand((current) => [...current, tile.id])
  }

  const removeTile = (id: string) => {
    saveHistory()
    setHand((current) => {
      const index = current.indexOf(id)
      return index === -1 ? current : [...current.slice(0, index), ...current.slice(index + 1)]
    })
  }

  const undo = () => {
    const previous = history.at(-1)
    if (!previous) return
    setHistory((current) => current.slice(0, -1))
    setHand(previous)
  }

  const reset = () => {
    setHand([])
    setHistory([])
  }

  return <main className="app-shell">
    <section className="hero-copy">
      <div><h1>いま、何を切る？</h1><p className="lead">手牌から、シャンテン数と有効牌を見て最適な一打を探します。</p></div>
      <div className="assumption"><span>◌</span><div><strong>一様分布モデル</strong><small>見えていない牌は均等に自摸すると仮定</small></div></div>
    </section>
    <div className="workspace">
      <HandEditor hand={hand} counts={counts} historyLength={history.length} onAdd={addTile} onRemove={removeTile} onUndo={undo} onReset={reset} />
      <aside className="right-column"><AnalysisRules /><AnalysisResults handLength={hand.length} analysis={analysis} /></aside>
    </div>
    <footer><span>通常手（4面子1雀頭）のみで計算</span><span>見えている牌・鳴き・点数状況は考慮していません</span></footer>
  </main>
}

export default App
