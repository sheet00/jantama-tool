# React Template (Vite + TS + Docker Compose)

## プロジェクト構成
- `docker-compose.yml`: ルートディレクトリ
- `src/`: プロジェクトの全ソースコードと設定ファイル（`package.json` 等を含む）

## 初期化の手順
1. コンテナをバックグラウンドで起動します。
   ```bash
   docker compose up -d
   ```
2. コンテナにログインします。
   ```bash
   docker compose exec app bash
   ```
3. コンテナ内の `/app` ディレクトリ（ホストの `src/`）で Vite を初期化します（※非対話形式）。
   ```bash
   npm exec --yes create-vite@latest -- . --template react-ts --yes
   npm install
   ```

## 起動方法
1. `docker-compose.yml` の `command` を開発サーバー起動用に変更します。
   ```yaml
   command: sh -c "npm install && npm run dev -- --host"
   ```
2. コンテナを起動します。
   ```bash
   docker compose up
   ```
3. ブラウザで `http://localhost:5173` にアクセスしてください。
