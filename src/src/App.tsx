import { useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'
import { AnalysisResults } from './components/AnalysisResults'
import { HandEditor } from './components/HandEditor'
import { INITIAL_HAND, toTileCounts } from './domain/tiles'
import { analyzeDiscards, currentShanten, currentWaits } from './engine/mahjong'
import { MahjongSoulTracker } from './tracker/client'

type Snapshot = { hand: string[]; discardsBySeat: string[][]; meldsBySeat: string[][][]; ownSeat: number | null }

function App() {
  const [hand, setHand] = useState(INITIAL_HAND)
  const [discardsBySeat, setDiscardsBySeat] = useState<string[][]>([[], [], [], []])
  const [meldsBySeat, setMeldsBySeat] = useState<string[][][]>([[], [], [], []])
  const [ownSeat, setOwnSeat] = useState<number | null>(null)
  const [history, setHistory] = useState<Snapshot[]>([])
  const [browserStatus, setBrowserStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected')
  const [browserError, setBrowserError] = useState('')
  const tracker = useMemo(() => new MahjongSoulTracker(), [])
  const visibleBySeat = useMemo(() => discardsBySeat.map((row, seat) => [...row, ...meldsBySeat[seat].flat()]), [discardsBySeat, meldsBySeat])
  const visible = useMemo(() => visibleBySeat.flat(), [visibleBySeat])
  const ownMelds = ownSeat === null ? [] : (meldsBySeat[ownSeat] ?? [])
  const fixedMelds = ownMelds.length
  const analysisHandLength = 14 - fixedMelds * 3
  const analysis = useMemo(() => analyzeDiscards(toTileCounts(hand), toTileCounts(visible), fixedMelds), [hand, visible, fixedMelds])
  const shanten = useMemo(() => currentShanten(toTileCounts(hand), fixedMelds), [hand, fixedMelds])
  const waits = useMemo(() => currentWaits(toTileCounts(hand), toTileCounts(visible), fixedMelds), [hand, visible, fixedMelds])

  useEffect(() => () => tracker.disconnect(), [tracker])

  useEffect(() => {
    if (browserStatus !== 'connected') return undefined
    void tracker.persistSnapshot()
    const interval = window.setInterval(() => void tracker.persistSnapshot(), 1000)
    return () => window.clearInterval(interval)
  }, [browserStatus, tracker])

  const connectBrowser = useCallback(async () => {
    setBrowserStatus('connecting')
    setBrowserError('')
    try {
      tracker.onUpdate((snapshot) => {
        if (snapshot.hand) setHand(snapshot.hand)
        setDiscardsBySeat(snapshot.discards)
        setMeldsBySeat(snapshot.melds)
        setOwnSeat(snapshot.ownSeat)
      })
      await tracker.connect()
      setBrowserStatus('connected')
    } catch (error) {
      setBrowserStatus('error')
      setBrowserError(error instanceof Error ? error.message : 'ブラウザに接続できません')
    }
  }, [tracker])

  useEffect(() => {
    if (browserStatus === 'connected') return undefined
    let active = true
    const interval = window.setInterval(() => {
      if (active && browserStatus !== 'connecting') void connectBrowser()
    }, 1000)
    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [browserStatus, connectBrowser])

  const saveHistory = () => setHistory((current) => [...current.slice(-9), { hand: [...hand], discardsBySeat: discardsBySeat.map((row) => [...row]), meldsBySeat: meldsBySeat.map((row) => row.map((meld) => [...meld])), ownSeat }])

  const removeTile = (id: string) => {
    const isDiscard = hand.length === analysisHandLength
    saveHistory()
    setHand((current) => {
      const index = current.indexOf(id)
      return index === -1 ? current : [...current.slice(0, index), ...current.slice(index + 1)]
    })
    if (isDiscard) setDiscardsBySeat((current) => [[...current[0], id], ...current.slice(1)])
  }

  const removeDiscard = (id: string, seat: number) => {
    saveHistory()
    setDiscardsBySeat((current) => current.map((row, rowIndex) => {
      if (rowIndex !== seat) return row
      const index = row.indexOf(id)
      return index === -1 ? row : [...row.slice(0, index), ...row.slice(index + 1)]
    }))
  }

  const removeMeldTile = (seat: number, meldIndex: number, tileIndex: number) => {
    saveHistory()
    setMeldsBySeat((current) => current.map((row, rowIndex) => {
      if (rowIndex !== seat) return row
      return row.flatMap((meld, currentMeldIndex) => {
        if (currentMeldIndex !== meldIndex) return [meld]
        const remaining = meld.filter((_, currentTileIndex) => currentTileIndex !== tileIndex)
        return remaining.length ? [remaining] : []
      })
    }))
  }

  const undo = () => {
    const previous = history.at(-1)
    if (!previous) return
    setHistory((current) => current.slice(0, -1))
    setHand(previous.hand)
    setDiscardsBySeat(previous.discardsBySeat)
    setMeldsBySeat(previous.meldsBySeat)
    setOwnSeat(previous.ownSeat)
  }

  const reset = () => {
    setHand([])
    setDiscardsBySeat([[], [], [], []])
    setMeldsBySeat([[], [], [], []])
    setOwnSeat(null)
    setHistory([])
  }

  return <main className={`app-shell ${browserStatus === 'connected' ? 'connection-ready' : 'connection-unavailable'}`}>
    <div className="browser-connection"><div><strong>ブラウザ接続</strong><small>{browserStatus === 'connected' ? '雀魂のWebSocketを監視中' : browserStatus === 'connecting' ? '接続しています…' : browserError || 'Chromeを9222番ポートで起動してください'}</small></div><button className="connect-button" onClick={() => void connectBrowser()} disabled={browserStatus === 'connecting'}>{browserStatus === 'connected' ? '接続済み' : '接続する'}</button></div>
    <div className="workspace">
      <HandEditor hand={hand} discardsBySeat={discardsBySeat} meldsBySeat={meldsBySeat} analysisHandLength={analysisHandLength} shanten={shanten} waits={waits} historyLength={history.length} onRemove={removeTile} onRemoveDiscard={removeDiscard} onRemoveMeldTile={removeMeldTile} onUndo={undo} onReset={reset} />
      <aside className="right-column"><AnalysisResults handLength={hand.length} expectedHandLength={analysisHandLength} analysis={analysis} /></aside>
    </div>
    <footer><span>捨て牌と鳴きで公開された牌を見えている牌として考慮</span></footer>
  </main>
}

export default App
