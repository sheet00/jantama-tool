import { useMemo, useState } from 'react'
import './App.css'
import { AnalysisResults } from './components/AnalysisResults'
import { HandEditor } from './components/HandEditor'
import { INITIAL_HAND, toTileCounts, type Tile } from './domain/tiles'
import { analyzeDiscards, currentShanten } from './engine/mahjong'
import type { Destination } from './components/TilePalette'

type Snapshot = { hand: string[]; visible: string[] }

function App() {
  const [hand, setHand] = useState(INITIAL_HAND)
  const [visible, setVisible] = useState<string[]>([])
  const [destination, setDestination] = useState<Destination>('hand')
  const [history, setHistory] = useState<Snapshot[]>([])
  const counts = useMemo(() => [...hand, ...visible].reduce<Record<string, number>>((all, id) => ({ ...all, [id]: (all[id] ?? 0) + 1 }), {}), [hand, visible])
  const analysis = useMemo(() => analyzeDiscards(toTileCounts(hand), toTileCounts(visible)), [hand, visible])
  const shanten = useMemo(() => currentShanten(toTileCounts(hand)), [hand])

  const saveHistory = () => setHistory((current) => [...current.slice(-9), { hand: [...hand], visible: [...visible] }])

  const addTile = (tile: Tile) => {
    if ((destination === 'hand' && hand.length >= 14) || (counts[tile.id] ?? 0) >= 4) return
    saveHistory()
    if (destination === 'hand') setHand((current) => [...current, tile.id])
    else setVisible((current) => [...current, tile.id])
  }

  const removeTile = (id: string) => {
    saveHistory()
    setHand((current) => {
      const index = current.indexOf(id)
      return index === -1 ? current : [...current.slice(0, index), ...current.slice(index + 1)]
    })
  }

  const removeVisibleTile = (id: string) => {
    saveHistory()
    setVisible((current) => {
      const index = current.indexOf(id)
      return index === -1 ? current : [...current.slice(0, index), ...current.slice(index + 1)]
    })
  }

  const undo = () => {
    const previous = history.at(-1)
    if (!previous) return
    setHistory((current) => current.slice(0, -1))
    setHand(previous.hand)
    setVisible(previous.visible)
  }

  const reset = () => {
    setHand([])
    setVisible([])
    setHistory([])
  }

  return <main className="app-shell">
    <div className="workspace">
      <HandEditor hand={hand} visible={visible} shanten={shanten} counts={counts} destination={destination} historyLength={history.length} onAdd={addTile} onRemove={removeTile} onRemoveVisible={removeVisibleTile} onDestinationChange={setDestination} onUndo={undo} onReset={reset} />
      <aside className="right-column"><AnalysisResults handLength={hand.length} analysis={analysis} /></aside>
    </div>
    <footer><span>通常手（4面子1雀頭）のみで計算</span><span>見えている牌・鳴き・点数状況は考慮していません</span></footer>
  </main>
}

export default App
