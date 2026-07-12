import { bytes, decodeBase64, fields, text, xorAction } from './protocol'

const AUTH_GAME = '.lq.FastTest.authGame'
const SYNC_GAME = '.lq.FastTest.syncGame'
const ENTER_GAME = '.lq.FastTest.enterGame'

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

type FrameInfo = { kind: number; id: number | null; wrapper: ReturnType<typeof fields> }

function decodeFrame(frame: Uint8Array): FrameInfo | null {
  const kind = frame[0]
  const offset = kind === 1 ? 1 : kind === 2 || kind === 3 ? 3 : 0
  if (!offset || frame.length < offset) return null
  const id = kind === 1 ? null : frame[1] | (frame[2] << 8)
  return { kind, id, wrapper: fields(frame.slice(offset)) }
}

function fieldText(data: ReturnType<typeof fields>, number: number): string | null {
  return text(data.find((field) => field.number === number)?.value ?? 0)
}

function fieldBytes(data: ReturnType<typeof fields>, number: number): Uint8Array | null {
  return bytes(data.find((field) => field.number === number)?.value ?? 0)
}

export class MahjongSoulTracker {
  private socket: WebSocket | null = null
  private requestId = 0
  private pendingRequests = new Map<number, string>()
  private pendingAuthAccounts = new Map<number, number>()
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
    this.pendingRequests.clear()
    this.pendingAuthAccounts.clear()
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
    const message = JSON.parse(raw) as { method?: string; params?: { response?: { opcode?: number; payloadData?: string }; request?: { opcode?: number; payloadData?: string } } }
    const sent = message.method === 'Network.webSocketFrameSent'
    const received = message.method === 'Network.webSocketFrameReceived'
    if (!sent && !received) return
    const frameData = message.params?.response ?? message.params?.request
    if (frameData?.opcode !== 2) return
    const payload = frameData.payloadData
    if (!payload) return
    try {
      const frame = decodeBase64(payload)
      if (sent) this.handleSentFrame(frame)
      if (received) this.handleReceivedFrame(frame)
    } catch {
      // Ignore unrelated or protocol-version-specific frames.
    }
  }

  private handleSentFrame(frame: Uint8Array): void {
    const decoded = decodeFrame(frame)
    if (!decoded || decoded.kind !== 2 || decoded.id === null) return
    const method = fieldText(decoded.wrapper, 1)
    if (!method || ![AUTH_GAME, SYNC_GAME, ENTER_GAME].includes(method)) return
    this.pendingRequests.set(decoded.id, method)
    if (method === AUTH_GAME) {
      const request = fieldBytes(decoded.wrapper, 2)
      const accountId = request ? numberFields(fields(request), 1)[0] : undefined
      if (accountId !== undefined) this.pendingAuthAccounts.set(decoded.id, accountId)
    }
  }

  private handleReceivedFrame(frame: Uint8Array): void {
    const decoded = decodeFrame(frame)
    if (!decoded) return
    if (decoded.kind === 1) {
      const method = fieldText(decoded.wrapper, 1)
      if (method !== '.lq.ActionPrototype') return
      const payload = fieldBytes(decoded.wrapper, 2)
      if (!payload) return
      const prototype = fields(payload)
      const name = fieldText(prototype, 2)
      const encrypted = fieldBytes(prototype, 3)
      if (name && encrypted) this.applyAction(name, xorAction(encrypted))
      return
    }
    if (decoded.kind !== 3 || decoded.id === null) return
    const method = this.pendingRequests.get(decoded.id)
    this.pendingRequests.delete(decoded.id)
    const data = fieldBytes(decoded.wrapper, 2)
    if (!method || !data) return
    if (method === AUTH_GAME) {
      const accountId = this.pendingAuthAccounts.get(decoded.id)
      this.pendingAuthAccounts.delete(decoded.id)
      if (accountId !== undefined) this.applyAuthResponse(data, accountId)
    } else if (method === SYNC_GAME || method === ENTER_GAME) {
      this.applyGameRestore(data)
    }
  }

  private applyAuthResponse(data: Uint8Array, accountId: number): void {
    const seatList = numberFields(fields(data), 3)
    const seat = seatList.indexOf(accountId)
    if (seat < 0) return
    this.ownSeat = seat
    this.listener?.(this.snapshot())
  }

  private applyGameRestore(data: Uint8Array): void {
    const restore = fieldBytes(fields(data), 4)
    if (!restore) return
    for (const actionField of fields(restore).filter((field) => field.number === 2 && field.wireType === 2)) {
      const action = fields(actionField.value as Uint8Array)
      const name = fieldText(action, 2)
      const actionData = fieldBytes(action, 3)
      if (name && actionData) this.applyAction(name, actionData)
    }
  }

  private applyAction(name: string, data: Uint8Array): void {
    const action = fields(data)
    const seatValue = action.find((field) => field.number === 1)?.value
    const seat = typeof seatValue === 'number' ? seatValue : 0
    const tile = appTile(text(action.find((field) => field.number === 2)?.value ?? 0))
    if (name === 'ActionNewRound') {
      const initial = stringFields(action, 4).map(appTile).filter((value): value is string => value !== null)
      this.hand = initial.sort((left, right) => SORT_ORDER.indexOf(left) - SORT_ORDER.indexOf(right))
      this.discards = [[], [], [], []]
      this.melds = [[], [], [], []]
      const dealer = action.find((field) => field.number === 2)?.value
      if (this.ownSeat === null && initial.length === 14 && typeof dealer === 'number' && dealer < this.discards.length) this.ownSeat = dealer
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
