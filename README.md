# 経費精算SaaS

ポートフォリオ兼デモ用の経費精算SaaSプロダクト。
技術スタック: Go / React (TypeScript, Vite) / PostgreSQL / MinIO / Docker Compose

## 前提条件

- Docker / Docker Compose v2
- Go 1.24 以上（`make seed` を実行する場合）
- `./scripts/generate-keys.sh` に必要な OpenSSL

## ローカル開発環境のセットアップ

### 1. JWT 鍵ペアの生成（初回のみ）

```bash
./scripts/generate-keys.sh
```

`keys/private.pem` と `keys/public.pem` が生成される。
生成した鍵ファイルはリポジトリにコミットしない。

### 2. 環境変数ファイルの準備（初回のみ）

```bash
cp .env.example .env
```

`.env` はデフォルト値のままで動作する（変更不要）。
`.env` はリポジトリにコミットしない。

### 3. 全サービス起動

```bash
docker compose up -d
```

以下のサービスが起動する:

| サービス | 役割 |
|---------|------|
| `db` | PostgreSQL 16 |
| `migrate` | マイグレーション（DB スキーマ自動適用後に終了） |
| `minio` | S3 互換オブジェクトストレージ |
| `minio-init` | MinIO 初期バケット作成後に終了 |
| `api` | Go バックエンド |
| `frontend` | React / Vite 開発サーバー |

マイグレーション（`000001` 〜 `000011`）は `migrate` コンテナが自動適用するため、手動実行は不要。

### 4. 開発用フィクスチャ投入

```bash
make seed
```

以下のデータが投入される（`test_strategy.md §4.2/4.3/4.4` 参照）:

- テナント A（Test Company A）/ テナント B（Test Company B）
- テナント A ユーザー（4 ロール）
- 経費レポート 6 件（各ステータス）
- グローバルカテゴリ 6 種
- 経費項目 1 件

冪等性を担保しているため複数回実行しても問題ない。

## アクセス先

| URL | 説明 |
|-----|------|
| http://localhost:5173 | フロントエンド |
| http://localhost:8080 | API サーバー |
| http://localhost:8080/health | ヘルスチェック |
| http://localhost:9001 | MinIO コンソール（minioadmin / minioadmin） |

## テストアカウント

`make seed` 実行後に以下のアカウントでログイン可能（パスワード共通: `TestPass1!`）:

| メールアドレス | ロール | テナント |
|-------------|--------|---------|
| test-admin@example.com | admin | Test Company A |
| test-approver@example.com | approver | Test Company A |
| test-member@example.com | member | Test Company A |
| test-accounting@example.com | accounting | Test Company A |
| test-member-b@example.com | member | Test Company B |

詳細は `dev-journal/deliverables/docs/60_test/test_strategy.md §4.2` を参照。

## 停止・リセット

```bash
# コンテナ停止（データ保持）
docker compose down

# コンテナ停止 + ボリューム削除（DB・MinIO データを完全リセット）
docker compose down -v
```

完全リセット後は `docker compose up -d` と `make seed` を再実行する。

## よくある問題

### port が使用中（Address already in use）

デフォルトポートが競合している場合は `.env` で変更する:

```bash
# .env
POSTGRES_PORT=5434
API_PORT=8081
FRONTEND_PORT=5174
```

### JWT 鍵エラー（keys/private.pem が見つからない）

初回セットアップ手順 1 を実施していない。`./scripts/generate-keys.sh` を実行する。

### DB ヘルスチェック失敗（api が起動しない）

`docker compose logs db` でエラーを確認する。
`docker compose logs migrate` でマイグレーションのエラーを確認する。

### MinIO 接続エラー

`docker compose logs minio` でエラーを確認する。
`docker compose logs minio-init` でバケット作成ログを確認する。

### `make seed` でエラー

`docker compose up -d` が完了してから実行する（特に migrate コンテナの完了を待つ）。

```bash
# migrate コンテナの完了を確認する
docker compose ps migrate
# STATUS が "Exited (0)" になっていれば完了
```
