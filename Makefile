.PHONY: setup migrate-up migrate-down migrate-create docker-up docker-down docker-restart seed

setup:
	git config core.hooksPath .githooks
	chmod +x .githooks/pre-commit

MIGRATE_PATH=./db/migrations
DATABASE_URL?=postgres://expense_owner:localdev@localhost:5432/expense_saas?sslmode=disable

migrate-up:
	migrate -path $(MIGRATE_PATH) -database "$(DATABASE_URL)" up

migrate-down:
	migrate -path $(MIGRATE_PATH) -database "$(DATABASE_URL)" down 1

migrate-create:
	@if [ -z "$(name)" ]; then echo "Usage: make migrate-create name=<migration_name>"; exit 1; fi
	migrate create -ext sql -dir $(MIGRATE_PATH) -seq $(name)

# 開発用フィクスチャを DB に投入する。
# docker compose up -d 実行後に make seed を叩く（2 ステップ運用）。
# Compose 経由で実行するためホスト Go は不要。
# 内部で `docker compose --profile seed run --rm seed` を実行する。
seed:
	docker compose --profile seed run --rm seed

docker-up:
	docker compose up -d

docker-down:
	docker compose down

docker-restart:
	docker compose down
	docker compose up -d
