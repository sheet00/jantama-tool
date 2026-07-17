import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { AnalysisResults } from './components/AnalysisResults'
import { DangerResults } from './components/DangerResults'
import { HandEditor } from './components/HandEditor'
import { INITIAL_HAND, toTileCounts } from './domain/tiles'
import { analyzeDiscards, currentShanten, currentWaits } from './engine/mahjong'
import { analyzeDanger } from './engine/danger'
import { MahjongSoulTracker } from './tracker/client'

type Snapshot = { hand: string[]; discardsBySeat: string[][]; discardCountBySeat: number[]; meldsBySeat: string[][][]; riichiBySeat: boolean[]; postRiichiSafeBySeat: string[][]; ownSeat: number | null }

const SAMPLE_DATA: Snapshot = {
  hand: ['1m', '2m', '3m', '4m', '5m', '6m', '7m', '2p', '3p', '4p', '6s', '7s', '5z', '6z'],
  discardsBySeat: [
    ['9m', '1p', '9p', '1s', '9s', '4z'],
    ['5m', '6m', '1m', '9p', '4p', '8s', '2z', '3z', '7z'],
    ['3p', '7p', '1s', '9s', '4z', '5z'],
    ['5m', '6m', '1m', '2p', '8p', '4s', '6z', '7z'],
  ],
  discardCountBySeat: [6, 9, 6, 8],
  meldsBySeat: [[], [], [], []],
  riichiBySeat: [false, true, false, true],
  postRiichiSafeBySeat: [[], ['9s'], [], ['9s']],
  ownSeat: 0,
}

function App() {
  const [hand, setHand] = useState(INITIAL_HAND)
  const [discardsBySeat, setDiscardsBySeat] = useState<string[][]>([[], [], [], []])
  const [discardCountBySeat, setDiscardCountBySeat] = useState<number[]>([0, 0, 0, 0])
  const [meldsBySeat, setMeldsBySeat] = useState<string[][][]>([[], [], [], []])
  const [riichiBySeat, setRiichiBySeat] = useState<boolean[]>([false, false, false, false])
  const [postRiichiSafeBySeat, setPostRiichiSafeBySeat] = useState<string[][]>([[], [], [], []])
  const [ownSeat, setOwnSeat] = useState<number | null>(null)
  const [history, setHistory] = useState<Snapshot[]>([])
  const [browserStatus, setBrowserStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected')
  const [browserError, setBrowserError] = useState('')
  const [sampleMode, setSampleMode] = useState(false)
  const connectionAttempt = useRef(0)
  const sampleModeRef = useRef(false)
  const sampleReturnSnapshot = useRef<Snapshot | null>(null)
  const tracker = useMemo(() => new MahjongSoulTracker(), [])
  const visibleBySeat = useMemo(() => discardsBySeat.map((row, seat) => [...row, ...meldsBySeat[seat].flat()]), [discardsBySeat, meldsBySeat])
  const visible = useMemo(() => visibleBySeat.flat(), [visibleBySeat])
  const ownMelds = ownSeat === null ? [] : (meldsBySeat[ownSeat] ?? [])
  const fixedMelds = ownMelds.length
  const analysisHandLength = 14 - fixedMelds * 3
  const analysis = useMemo(() => analyzeDiscards(toTileCounts(hand), toTileCounts(visible), fixedMelds), [hand, visible, fixedMelds])
  const shanten = useMemo(() => currentShanten(toTileCounts(hand), fixedMelds), [hand, fixedMelds])
  const waits = useMemo(() => currentWaits(toTileCounts(hand), toTileCounts(visible), fixedMelds), [hand, visible, fixedMelds])
  const dangerAssessments = useMemo(() => analyzeDanger(hand, discardsBySeat, discardCountBySeat, meldsBySeat, riichiBySeat, postRiichiSafeBySeat, ownSeat), [hand, discardsBySeat, discardCountBySeat, meldsBySeat, riichiBySeat, postRiichiSafeBySeat, ownSeat])

  useEffect(() => () => tracker.disconnect(), [tracker])

  useEffect(() => {
    if (browserStatus !== 'connected') return undefined
    void tracker.persistSnapshot()
    const interval = window.setInterval(() => void tracker.persistSnapshot(), 1000)
    return () => window.clearInterval(interval)
  }, [browserStatus, tracker])

  const connectBrowser = useCallback(async () => {
    const attempt = ++connectionAttempt.current
    sampleModeRef.current = false
    setSampleMode(false)
    setBrowserStatus('connecting')
    setBrowserError('')
    try {
      tracker.onUpdate((snapshot) => {
        if (sampleModeRef.current) return
        if (snapshot.hand) setHand(snapshot.hand)
        setDiscardsBySeat(snapshot.discards)
        setDiscardCountBySeat(snapshot.discardCountBySeat)
        setMeldsBySeat(snapshot.melds)
        setRiichiBySeat(snapshot.riichiBySeat)
        setPostRiichiSafeBySeat(snapshot.postRiichiSafeBySeat)
        setOwnSeat(snapshot.ownSeat)
      })
      await tracker.restoreSnapshot()
      await tracker.connect()
      if (attempt !== connectionAttempt.current || sampleModeRef.current) return
      setBrowserStatus('connected')
    } catch (error) {
      if (attempt !== connectionAttempt.current || sampleModeRef.current) return
      setBrowserStatus('error')
      setBrowserError(error instanceof Error ? error.message : 'ブラウザに接続できません')
    }
  }, [tracker])

  const toggleSample = useCallback(() => {
    if (sampleModeRef.current) {
      sampleModeRef.current = false
      setSampleMode(false)
      setBrowserStatus('disconnected')
      const snapshot = sampleReturnSnapshot.current
      if (snapshot) {
        setHand(snapshot.hand)
        setDiscardsBySeat(snapshot.discardsBySeat)
        setDiscardCountBySeat(snapshot.discardCountBySeat)
        setMeldsBySeat(snapshot.meldsBySeat)
        setRiichiBySeat(snapshot.riichiBySeat)
        setPostRiichiSafeBySeat(snapshot.postRiichiSafeBySeat)
        setOwnSeat(snapshot.ownSeat)
      }
      sampleReturnSnapshot.current = null
      return
    }

    sampleReturnSnapshot.current = {
      hand: [...hand],
      discardsBySeat: discardsBySeat.map((row) => [...row]),
      discardCountBySeat: [...discardCountBySeat],
      meldsBySeat: meldsBySeat.map((row) => row.map((meld) => [...meld])),
      riichiBySeat: [...riichiBySeat],
      postRiichiSafeBySeat: postRiichiSafeBySeat.map((row) => [...row]),
      ownSeat,
    }
    connectionAttempt.current += 1
    sampleModeRef.current = true
    tracker.disconnect()
    setSampleMode(true)
    setBrowserStatus('disconnected')
    setBrowserError('')
    setHand([...SAMPLE_DATA.hand])
    setDiscardsBySeat(SAMPLE_DATA.discardsBySeat.map((row) => [...row]))
    setDiscardCountBySeat([...SAMPLE_DATA.discardCountBySeat])
    setMeldsBySeat(SAMPLE_DATA.meldsBySeat.map((row) => row.map((meld) => [...meld])))
    setRiichiBySeat([...SAMPLE_DATA.riichiBySeat])
    setPostRiichiSafeBySeat(SAMPLE_DATA.postRiichiSafeBySeat.map((row) => [...row]))
    setOwnSeat(SAMPLE_DATA.ownSeat)
    setHistory([])
  }, [discardCountBySeat, discardsBySeat, hand, meldsBySeat, ownSeat, postRiichiSafeBySeat, riichiBySeat, tracker])

  useEffect(() => {
    if (browserStatus === 'connected' || sampleMode) return undefined
    let active = true
    const interval = window.setInterval(() => {
      if (active && browserStatus !== 'connecting') void connectBrowser()
    }, 1000)
    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [browserStatus, connectBrowser, sampleMode])

  const saveHistory = () => setHistory((current) => [...current.slice(-9), { hand: [...hand], discardsBySeat: discardsBySeat.map((row) => [...row]), discardCountBySeat: [...discardCountBySeat], meldsBySeat: meldsBySeat.map((row) => row.map((meld) => [...meld])), riichiBySeat: [...riichiBySeat], postRiichiSafeBySeat: postRiichiSafeBySeat.map((row) => [...row]), ownSeat }])

  const removeTile = (id: string) => {
    const isDiscard = hand.length === analysisHandLength
    saveHistory()
    setHand((current) => {
      const index = current.indexOf(id)
      return index === -1 ? current : [...current.slice(0, index), ...current.slice(index + 1)]
    })
    if (isDiscard) {
      setDiscardsBySeat((current) => [[...current[0], id], ...current.slice(1)])
      setDiscardCountBySeat((current) => current.map((count, seat) => seat === 0 ? count + 1 : count))
    }
  }

  const removeDiscard = (id: string, seat: number) => {
    saveHistory()
    if (discardsBySeat[seat]?.includes(id)) setDiscardCountBySeat((current) => current.map((count, rowIndex) => rowIndex === seat ? Math.max(0, count - 1) : count))
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
    setDiscardCountBySeat(previous.discardCountBySeat)
    setMeldsBySeat(previous.meldsBySeat)
    setRiichiBySeat(previous.riichiBySeat)
    setPostRiichiSafeBySeat(previous.postRiichiSafeBySeat)
    setOwnSeat(previous.ownSeat)
  }

  const reset = () => {
    setHand([])
    setDiscardsBySeat([[], [], [], []])
    setDiscardCountBySeat([0, 0, 0, 0])
    setMeldsBySeat([[], [], [], []])
    setRiichiBySeat([false, false, false, false])
    setPostRiichiSafeBySeat([[], [], [], []])
    setOwnSeat(null)
    setHistory([])
  }

  return <main className={`app-shell ${sampleMode ? 'sample-mode' : browserStatus === 'connected' ? 'connection-ready' : 'connection-unavailable'}`}>
    <div className="browser-connection"><div><strong>{sampleMode ? 'サンプル表示' : 'ブラウザ接続'}</strong><small>{sampleMode ? 'UI確認用のサンプルデータを表示中' : browserStatus === 'connected' ? '雀魂のWebSocketを監視中' : browserStatus === 'connecting' ? '接続しています…' : browserError || 'Chromeを9222番ポートで起動してください'}</small></div><div className="browser-actions"><button className={`sample-button ${sampleMode ? 'active' : ''}`} onClick={toggleSample}>{sampleMode ? 'サンプルを閉じる' : 'サンプル'}</button><button className="connect-button" onClick={() => void connectBrowser()} disabled={browserStatus === 'connecting'}>{browserStatus === 'connected' && !sampleMode ? '接続済み' : '接続する'}</button></div></div>
    <div className="workspace">
      <HandEditor hand={hand} discardsBySeat={discardsBySeat} meldsBySeat={meldsBySeat} riichiBySeat={riichiBySeat} analysisHandLength={analysisHandLength} shanten={shanten} waits={waits} historyLength={history.length} onRemove={removeTile} onRemoveDiscard={removeDiscard} onRemoveMeldTile={removeMeldTile} onUndo={undo} onReset={reset} />
      <aside className="right-column"><DangerResults assessments={dangerAssessments} /><AnalysisResults handLength={hand.length} expectedHandLength={analysisHandLength} analysis={analysis} /></aside>
    </div>
    <footer><span>捨て牌と鳴きで公開された牌を見えている牌として考慮</span></footer>
  </main>
}

export default App
