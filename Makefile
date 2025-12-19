.PHONY: install install-backend install-frontend dev dev-backend dev-frontend build clean help

# デフォルトターゲット
help:
	@echo "🕸️  Webスクレイピング支援ツール"
	@echo ""
	@echo "使用方法:"
	@echo "  make install    - 依存パッケージをインストール"
	@echo "  make dev        - バックエンドとフロントエンドを同時起動"
	@echo "  make dev-backend  - バックエンドのみ起動"
	@echo "  make dev-frontend - フロントエンドのみ起動"
	@echo "  make build      - プロダクションビルド"
	@echo "  make clean      - ビルド成果物を削除"

# 全ての依存パッケージをインストール
install: install-backend install-frontend
	@echo "✅ インストール完了"

# バックエンドの依存パッケージをインストール
install-backend:
	@echo "📦 バックエンドの依存パッケージをインストール中..."
	cd backend && pip install -r requirements.txt

# フロントエンドの依存パッケージをインストール
install-frontend:
	@echo "📦 フロントエンドの依存パッケージをインストール中..."
	cd frontend && npm install

# バックエンドとフロントエンドを同時起動
dev:
	@echo "🚀 開発サーバーを起動中..."
	@echo "   バックエンド: http://localhost:8000"
	@echo "   フロントエンド: http://localhost:5173"
	@echo "   API ドキュメント: http://localhost:8000/docs"
	@echo ""
	@echo "   停止するには Ctrl+C を押してください"
	@echo ""
	@trap 'kill 0' INT; \
	(cd backend && uvicorn main:app --reload --port 8000) & \
	(cd frontend && npm run dev) & \
	wait

# バックエンドのみ起動
dev-backend:
	@echo "🐍 バックエンドを起動中 (http://localhost:8000)..."
	cd backend && uvicorn main:app --reload --port 8000

# フロントエンドのみ起動
dev-frontend:
	@echo "⚛️  フロントエンドを起動中 (http://localhost:5173)..."
	cd frontend && npm run dev

# プロダクションビルド
build:
	@echo "🔨 プロダクションビルド中..."
	cd frontend && npm run build
	@echo "✅ ビルド完了: frontend/dist/"

# クリーンアップ
clean:
	@echo "🧹 クリーンアップ中..."
	rm -rf frontend/dist
	rm -rf frontend/node_modules/.cache
	find backend -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	@echo "✅ クリーンアップ完了"
