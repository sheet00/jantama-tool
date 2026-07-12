import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { AnalysisResults } from './components/AnalysisResults'
import { HandEditor } from './components/HandEditor'
import { INITIAL_HAND, toTileCounts } from './domain/tiles'
import { analyzeDiscards, currentShanten, currentWaits } from './engine/mahjong'
import { MahjongSoulTracker } from './tracker/client'

type Snapshot = { hand: string[]; visibleBySeat: string[][] }

function App() {
  const [hand, setHand] = useState(INITIAL_HAND)
  const [visibleBySeat, setVisibleBySeat] = useState<string[][]>([[], [], [], []])
  const [history, setHistory] = useState<Snapshot[]>([])
  const [browserStatus, setBrowserStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected')
  const [browserError, setBrowserError] = useState('')
  const tracker = useMemo(() => new MahjongSoulTracker(), [])
  const visible = useMemo(() => visibleBySeat.flat(), [visibleBySeat])
  const analysis = useMemo(() => analyzeDiscards(toTileCounts(hand), toTileCounts(visible)), [hand, visible])
  const shanten = useMemo(() => currentShanten(toTileCounts(hand)), [hand])
  const waits = useMemo(() => currentWaits(toTileCounts(hand), toTileCounts(visible)), [hand, visible])

  useEffect(() => () => tracker.disconnect(), [tracker])

  useEffect(() => {
    if (browserStatus !== 'connected') return undefined
    void tracker.persistSnapshot()
    const interval = window.setInterval(() => void tracker.persistSnapshot(), 1000)
    return () => window.clearInterval(interval)
  }, [browserStatus, tracker])

  const connectBrowser = async () => {
    setBrowserStatus('connecting')
    setBrowserError('')
    try {
      tracker.onUpdate((snapshot) => {
        if (snapshot.hand) setHand(snapshot.hand)
        setVisibleBySeat(snapshot.discards)
      })
      await tracker.connect()
      setBrowserStatus('connected')
    } catch (error) {
      setBrowserStatus('error')
      setBrowserError(error instanceof Error ? error.message : 'ブラウザに接続できません')
    }
  }

  const saveHistory = () => setHistory((current) => [...current.slice(-9), { hand: [...hand], visibleBySeat: visibleBySeat.map((row) => [...row]) }])

  const removeTile = (id: string) => {
    const isDiscard = hand.length === 14
    saveHistory()
    setHand((current) => {
      const index = current.indexOf(id)
      return index === -1 ? current : [...current.slice(0, index), ...current.slice(index + 1)]
    })
    if (isDiscard) setVisibleBySeat((current) => [[...current[0], id], ...current.slice(1)])
  }

  const removeVisibleTile = (id: string, seat = 0) => {
    saveHistory()
    setVisibleBySeat((current) => current.map((row, rowIndex) => {
      if (rowIndex !== seat) return row
      const index = row.indexOf(id)
      return index === -1 ? row : [...row.slice(0, index), ...row.slice(index + 1)]
    }))
  }

  const undo = () => {
    const previous = history.at(-1)
    if (!previous) return
    setHistory((current) => current.slice(0, -1))
    setHand(previous.hand)
    setVisibleBySeat(previous.visibleBySeat)
  }

  const reset = () => {
    setHand([])
    setVisibleBySeat([[], [], [], []])
    setHistory([])
  }

  return <main className="app-shell">
    <div className="browser-connection"><div><strong>ブラウザ接続</strong><small>{browserStatus === 'connected' ? '雀魂のWebSocketを監視中' : browserStatus === 'connecting' ? '接続しています…' : browserError || 'Chromeを9222番ポートで起動してください'}</small></div><button className="connect-button" onClick={() => void connectBrowser()} disabled={browserStatus === 'connecting'}>{browserStatus === 'connected' ? '接続済み' : '接続する'}</button></div>
    <div className="workspace">
      <HandEditor hand={hand} visibleBySeat={visibleBySeat} shanten={shanten} waits={waits} historyLength={history.length} onRemove={removeTile} onRemoveVisible={removeVisibleTile} onUndo={undo} onReset={reset} />
      <aside className="right-column"><AnalysisResults handLength={hand.length} analysis={analysis} /></aside>
    </div>
    <footer><span>通常手（4面子1雀頭）のみで計算</span><span>見えている牌・鳴き・点数状況は考慮していません</span></footer>
  </main>
}

export default App
