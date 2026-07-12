import { bytes, decodeBase64, fields, text, xorAction } from './protocol'

export type TrackerSnapshot = {
  hand: string[] | null
  discards: string[][]
  melds: string[][][]
  ownSeat: number | null
  lastEvent: { action: string; seat: number | null; tile: string | null } | null
  timestamp: number
}

export type TrackerListener = (snapshot: TrackerSnapshot) => void

const TILE_MAP: Record<string, string> = {
  '0m': '5m', '1m': '1m', '2m': '2m', '3m': '3m', '4m': '4m', '5m': '5m', '6m': '6m', '7m': '7m', '8m': '8m', '9m': '9m',
  '0p': '5p', '1p': '1p', '2p': '2p', '3p': '3p', '4p': '4p', '5p': '5p', '6p': '6p', '7p': '7p', '8p': '8p', '9p': '9p',
  '0s': '5s', '1s': '1s', '2s': '2s', '3s': '3s', '4s': '4s', '5s': '5s', '6s': '6s', '7s': '7s', '8s': '8s', '9s': '9s',
  '1z': '1z', '2z': '2z', '3z': '3z', '4z': '4z', '5z': '5z', '6z': '6z', '7z': '7z',
}

const SORT_ORDER = ['1m', '2m', '3m', '4m', '5m', '6m', '7m', '8m', '9m', '1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p', '1s', '2s', '3s', '4s', '5s', '6s', '7s', '8s', '9s', '1z', '2z', '3z', '4z', '5z', '6z', '7z']

function appTile(tile: string | null): string | null {
  return tile ? TILE_MAP[tile] ?? null : null
}

function stringFields(data: ReturnType<typeof fields>, number: number): string[] {
  return data.filter((field) => field.number === number && field.wireType === 2).map((field) => text(field.value)).filter((value): value is string => value !== null)
}

function numberFields(data: ReturnType<typeof fields>, number: number): number[] {
  return data.filter((field) => field.number === number).flatMap((field) => {
    if (field.wireType === 0 && typeof field.value === 'number') return [field.value]
    if (field.wireType === 2 && typeof field.value !== 'number') return packedVarints(field.value)
    return []
  })
}

function packedVarints(bytes: Uint8Array): number[] {
  const result: number[] = []
  let value = 0
  let shift = 0
  for (const byte of bytes) {
    value |= (byte & 0x7f) << shift
    if ((byte & 0x80) === 0) {
      result.push(value >>> 0)
      value = 0
      shift = 0
    } else {
      shift += 7
    }
  }
  if (shift !== 0) throw new Error('Truncated packed varint field')
  return result
}

function removeTiles(hand: string[], tiles: string[]): string[] {
  const remaining = [...hand]
  for (const tile of tiles) {
    const index = remaining.indexOf(tile)
    if (index >= 0) remaining.splice(index, 1)
  }
  return remaining.sort((left, right) => SORT_ORDER.indexOf(left) - SORT_ORDER.indexOf(right))
}

export class MahjongSoulTracker {
  private socket: WebSocket | null = null
  private requestId = 0
  private hand: string[] | null = null
  private ownSeat: number | null = null
  private discards = [[], [], [], []] as string[][]
  private melds = [[], [], [], []] as string[][][]
  private lastEvent: TrackerSnapshot['lastEvent'] = null
  private listener: TrackerListener | null = null

  onUpdate(listener: TrackerListener): void {
    this.listener = listener
  }

  async connect(): Promise<void> {
    this.disconnect()
    const response = await fetch('/cdp/json/list')
    if (!response.ok) throw new Error(`Chrome CDP returned HTTP ${response.status}`)
    const pages = await response.json() as Array<{ type: string; url: string; webSocketDebuggerUrl?: string }>
    const page = pages.find((candidate) => candidate.type === 'page' && candidate.url.includes('mahjongsoul.com') && candidate.webSocketDebuggerUrl)
    if (!page?.webSocketDebuggerUrl) throw new Error('雀魂のタブが見つかりません')
    const debuggerUrl = new URL(page.webSocketDebuggerUrl as string)
    const socketUrl = `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/cdp${debuggerUrl.pathname}`
    await new Promise<void>((resolve, reject) => {
      const socket = new WebSocket(socketUrl)
      this.socket = socket
      socket.onopen = () => {
        this.send('Network.enable', {})
        resolve()
      }
      socket.onerror = () => reject(new Error('Chrome CDP WebSocketに接続できません'))
      socket.onclose = () => {
        if (this.socket === socket) this.socket = null
      }
      socket.onmessage = (event) => this.handleMessage(event.data)
    })
  }

  disconnect(): void {
    this.socket?.close()
    this.socket = null
  }

  isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN
  }

  snapshot(): TrackerSnapshot {
    return {
      hand: this.hand ? [...this.hand] : null,
      discards: this.discards.map((row) => [...row]),
      melds: this.melds.map((row) => row.map((meld) => [...meld])),
      ownSeat: this.ownSeat,
      lastEvent: this.lastEvent,
      timestamp: Date.now(),
    }
  }

  async persistSnapshot(): Promise<void> {
    if (!this.isConnected()) return
    await fetch('/tracker/snapshot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(this.snapshot()),
    })
  }

  private send(method: string, params: unknown): void {
    this.socket?.send(JSON.stringify({ id: ++this.requestId, method, params }))
  }

  private handleMessage(raw: unknown): void {
    if (typeof raw !== 'string') return
    const message = JSON.parse(raw) as { method?: string; params?: { response?: { opcode?: number; payloadData?: string } } }
    if (message.method !== 'Network.webSocketFrameReceived' || message.params?.response?.opcode !== 2) return
    const payload = message.params.response.payloadData
    if (!payload) return
    try {
      const action = this.decodeAction(decodeBase64(payload))
      if (action) this.applyAction(action.name, action.data)
    } catch {
      // Ignore unrelated or protocol-version-specific frames.
    }
  }

  private decodeAction(frame: Uint8Array): { name: string; data: Uint8Array } | null {
    const offset = frame[0] === 1 ? 1 : frame[0] === 2 || frame[0] === 3 ? 3 : 0
    if (!offset) return null
    const wrapper = fields(frame.slice(offset))
    const method = wrapper.find((field) => field.number === 1)?.value
    if (method === undefined || text(method) !== '.lq.ActionPrototype') return null
    const payload = bytes(wrapper.find((field) => field.number === 2)?.value ?? 0)
    if (!payload) return null
    const prototype = fields(payload)
    const name = text(prototype.find((field) => field.number === 2)?.value ?? 0)
    const encrypted = bytes(prototype.find((field) => field.number === 3)?.value ?? 0)
    return name && encrypted ? { name, data: xorAction(encrypted) } : null
  }

  private applyAction(name: string, data: Uint8Array): void {
    const action = fields(data)
    const seatValue = action.find((field) => field.number === 1)?.value
    const seat = typeof seatValue === 'number' ? seatValue : null
    const tile = appTile(text(action.find((field) => field.number === 2)?.value ?? 0))
    if (name === 'ActionNewRound') {
      const initial = stringFields(action, 4).map(appTile).filter((value): value is string => value !== null)
      this.hand = initial.sort((left, right) => SORT_ORDER.indexOf(left) - SORT_ORDER.indexOf(right))
      this.discards = [[], [], [], []]
      this.melds = [[], [], [], []]
      const dealer = action.find((field) => field.number === 2)?.value
      if (initial.length === 14 && typeof dealer === 'number') this.ownSeat = dealer
    } else if (name === 'ActionDealTile' && tile && seat !== null) {
      if (this.ownSeat === null) this.ownSeat = seat
      if (seat === this.ownSeat) this.hand = [...(this.hand ?? []), tile].sort((left, right) => SORT_ORDER.indexOf(left) - SORT_ORDER.indexOf(right))
    } else if (name === 'ActionDiscardTile' && tile && seat !== null && seat < this.discards.length) {
      this.discards[seat] = [...this.discards[seat], tile]
      if (seat === this.ownSeat && this.hand) {
        const index = this.hand.indexOf(tile)
        if (index >= 0) this.hand = [...this.hand.slice(0, index), ...this.hand.slice(index + 1)]
      }
    } else if (name === 'ActionChiPengGang' && seat !== null) {
      const meldType = action.find((field) => field.number === 2)?.value
      const tiles = stringFields(action, 3).map(appTile).filter((value): value is string => value !== null)
      const froms = numberFields(action, 4)
      if (typeof meldType !== 'number' || tiles.length !== froms.length || tiles.length === 0 || seat >= this.discards.length) return

      const calledIndex = froms.findIndex((from) => from !== seat)
      if (calledIndex < 0 || calledIndex >= tiles.length) return
      const calledTile = tiles[calledIndex]
      const sourceSeat = froms[calledIndex]
      if (sourceSeat < 0 || sourceSeat >= this.discards.length) return

      this.discards[sourceSeat] = removeOne(this.discards[sourceSeat], calledTile)
      this.melds[seat] = [...this.melds[seat], tiles]
      if (seat === this.ownSeat && this.hand) {
        this.hand = removeTiles(this.hand, tiles.filter((_, index) => froms[index] === seat))
      }
      this.lastEvent = { action: name, seat, tile: calledTile }
      this.listener?.(this.snapshot())
      return
    } else if (name === 'ActionAnGangAddGang' && seat !== null && seat < this.discards.length) {
      const meldType = action.find((field) => field.number === 2)?.value
      const meldTile = appTile(text(action.find((field) => field.number === 3)?.value ?? 0))
      if (typeof meldType !== 'number' || !meldTile) return

      const meldTiles = meldType === 3 ? [meldTile, meldTile, meldTile, meldTile] : meldType === 2 ? [meldTile] : []
      if (meldTiles.length === 0) return
      if (meldType === 2) {
        const ponIndex = this.melds[seat].findIndex((meld) => meld.length === 3 && meld.every((value) => value === meldTile))
        if (ponIndex >= 0) {
          this.melds[seat] = this.melds[seat].map((meld, index) => index === ponIndex ? [...meld, meldTile] : meld)
        } else {
          this.melds[seat] = [...this.melds[seat], meldTiles]
        }
      } else {
        this.melds[seat] = [...this.melds[seat], meldTiles]
      }
      if (seat === this.ownSeat && this.hand) this.hand = removeTiles(this.hand, meldTiles)
      this.lastEvent = { action: name, seat, tile: meldTile }
      this.listener?.(this.snapshot())
      return
    } else {
      return
    }
    this.lastEvent = { action: name, seat, tile }
    this.listener?.(this.snapshot())
  }
}

function removeOne(tiles: string[], target: string): string[] {
  const index = tiles.indexOf(target)
  return index < 0 ? tiles : [...tiles.slice(0, index), ...tiles.slice(index + 1)]
}
