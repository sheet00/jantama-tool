import { bytes, decodeBase64, fields, text, xorAction } from './protocol'

export type TrackerSnapshot = {
  hand: string[] | null
  discards: string[][]
  ownSeat: number | null
  lastEvent: { action: string; seat: number | null; tile: string | null } | null
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

export class MahjongSoulTracker {
  private socket: WebSocket | null = null
  private requestId = 0
  private hand: string[] | null = null
  private ownSeat: number | null = null
  private discards = [[], [], [], []] as string[][]
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
    } else {
      return
    }
    this.lastEvent = { action: name, seat, tile }
    this.listener?.({ hand: this.hand, discards: this.discards.map((row) => [...row]), ownSeat: this.ownSeat, lastEvent: this.lastEvent })
  }
}
