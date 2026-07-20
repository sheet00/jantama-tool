# じゃんたま解析アプリ

雀魂の対局をChrome DevTools Protocol（CDP）経由で読み取り、手牌と捨て牌をアプリへ自動反映するReact + TypeScriptアプリです。

## 起動

Chromeをリモートデバッグポート9222で起動した状態で、次を実行します。

```bash
docker compose up -d
```

ブラウザで <http://localhost:40638> を開き、「ブラウザ接続」を押します。

`scripts/start.py` はWindows向けのChrome起動スクリプトです。ChromeのCDPエンドポイントは `9222` を使用します。

## 現在の実装

- アプリ内の「ブラウザ接続」ボタンから雀魂のタブへ接続
- Viteの `/cdp` プロキシ経由でCDPのCORS制約を回避
- `Network.webSocketFrameReceived` で雀魂のWebSocketを監視
- MajsoulのWebSocketプロトコルのXOR暗号化・`ActionPrototype` 構造を復号
- `ActionNewRound` から初期手牌を取得
- `ActionDealTile` から自分のツモを取得
- `ActionDiscardTile` から全4座席の捨て牌を取得
- `ActionChiPengGang` / `ActionAnGangAddGang` からチー、ポン、明槓、暗槓、加槓を取得
- 鳴かれた牌を元の河から除き、鳴きで公開された牌を鳴いた座席の見えている牌へ移動
- 捨て牌と鳴き牌を分けて保持し、鳴き牌は河の右側に寄せて表示
- 捨て牌と鳴きで公開された牌は解析時に合算
- 捨て牌・見えている牌の欄はデフォルトで閉じた状態
- 取得した状態を1秒ごとにJSON保存
- JSONは `src/src/tracker/game.json` に保存し、Git管理対象外
- JSONは一時ファイルからのリネームで原子的に更新
- 牌パレットによる手動入力UIは削除済み

## データ保存

ブラウザ接続中、Viteの保存APIへ1秒ごとにスナップショットを送信します。保存される内容は次のとおりです。

```json
{
  "hand": ["2m", "3m"],
  "discards": [[], [], [], []],
  "melds": [[], [], [], []],
  "ownSeat": 0,
  "lastEvent": {
    "action": "ActionDiscardTile",
    "seat": 0,
    "tile": "3m"
  },
  "timestamp": 0
}
```

保存ファイル:

```text
src/src/tracker/game.json
```

CDP接続前に到着したWebSocketフレームは再生できません。対局途中から接続した場合、現在の局の初期手牌が復元できず、次の `ActionNewRound` から完全な追跡が始まる場合があります。

## 構成

```text
src/
  src/
    App.tsx
    components/
      HandEditor.tsx
    tracker/
      client.ts       # CDP接続とWebSocket監視
      protocol.ts     # Majsoulの簡易protobuf/XOR復号
      game.json       # 実行時生成、Git管理外
    domain/
    engine/
  vite.config.ts      # CDPプロキシとJSON保存API
docker-compose.yml
scripts/start.py      # Windows向けChrome起動
```

## シーケンス図

### ブラウザ接続フロー

```mermaid
sequenceDiagram
    actor User as ユーザー
    participant App as App.tsx
    participant Tracker as MahjongSoulTracker
    participant Vite as Vite Dev Server<br/>(プロキシ)
    participant Chrome as Chrome CDP<br/>(:9222)

    User->>App: 「ブラウザ接続」ボタン押下
    App->>Tracker: connect()
    Tracker->>Vite: GET /cdp/json/list
    Vite->>Chrome: GET /json/list
    Chrome-->>Vite: ページ一覧 (JSON)
    Vite-->>Tracker: ページ一覧 (JSON)
    Tracker->>Tracker: mahjongsoul.com のタブを検索
    Tracker->>Vite: WebSocket /cdp/<debuggerPath>
    Vite->>Chrome: WebSocket 接続
    Chrome-->>Tracker: 接続確立
    Tracker->>Chrome: Network.enable
    App->>Tracker: restoreSnapshot()
    Tracker->>Vite: GET /tracker/snapshot
    Vite-->>Tracker: 保存済みスナップショット (JSON)
    Tracker-->>App: onUpdate コールバック
    App-->>User: 手牌・捨て牌を復元表示
```

### ゲームイベント処理フロー

```mermaid
sequenceDiagram
    participant MajSoul as 雀魂サーバー
    participant Chrome as Chrome
    participant Tracker as MahjongSoulTracker<br/>(client.ts)
    participant Proto as protocol.ts<br/>(Base64/XOR/protobuf)
    participant App as App.tsx<br/>(React State)
    participant Engine as mahjong.ts<br/>(解析エンジン)
    participant UI as AnalysisResults<br/>/ HandEditor

    MajSoul->>Chrome: WebSocket フレーム (暗号化)
    Chrome->>Tracker: Network.webSocketFrameReceived
    Tracker->>Proto: decodeBase64(payload)
    Proto-->>Tracker: Uint8Array
    Tracker->>Proto: fields() → xorAction()
    Proto-->>Tracker: ActionPrototype { name, data }

    alt ActionNewRound
        Tracker->>Tracker: hand を初期手牌で初期化<br/>discards / melds をリセット
    else ActionDealTile (自席)
        Tracker->>Tracker: hand に自摸牌を追加
    else ActionDiscardTile
        Tracker->>Tracker: discards[seat] に追加<br/>自席なら hand から削除<br/>リーチ情報を更新
    else ActionChiPengGang
        Tracker->>Tracker: 元の河から鳴かれた牌を削除<br/>melds[seat] に追加<br/>自席なら hand から手牌を削除
    else ActionAnGangAddGang
        Tracker->>Tracker: melds[seat] に槓牌を追加
    end

    Tracker->>App: onUpdate(snapshot)
    App->>App: setHand / setDiscardsBySeat<br/>setMeldsBySeat など state 更新

    App->>Engine: analyzeDiscards(hand, visible, fixedMelds)
    Engine->>Engine: 各捨て牌候補のシャンテン数を計算<br/>有効牌と残り枚数を集計
    Engine-->>App: DiscardCandidate[]

    App->>Engine: currentShanten / currentWaits
    Engine-->>App: shanten / waits

    App->>UI: props として渡す
    UI-->>UI: 捨て牌ランキング・シャンテン数を描画

    App->>Tracker: persistSnapshot() (1秒ごと)
    Tracker->>App: POST /tracker/snapshot (JSON保存)
```

## 検証

```bash
cd src
npm run lint
npm run build
```

Docker環境では、アプリコンテナをホストネットワークで起動し、ホストの `127.0.0.1:9222` に接続します。

## 参考

- [Akagi](https://github.com/shinkuan/Akagi) — 雀魂・天鳳向けのリアルタイム麻雀AIアシスタント。MajsoulのWebSocketプロトコル（`ActionPrototype` 構造・XOR暗号化）の解読に使用した。
