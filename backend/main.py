"""
Webスクレイピング支援ツール - バックエンドAPI
FastAPI アプリケーション
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.html_parser import router as html_parser_router
from api.url_generator import router as url_generator_router
from api.robots_checker import router as robots_checker_router
from api.scraper import router as scraper_router

app = FastAPI(
    title="Webスクレイピング支援ツール API",
    description="HTMLソース解析、URL生成、スクレイピング実行を行うAPI",
    version="1.0.0"
)

# CORS設定（開発環境用）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ルーター登録
app.include_router(html_parser_router, prefix="/api", tags=["HTML解析"])
app.include_router(url_generator_router, prefix="/api", tags=["URL生成"])
app.include_router(robots_checker_router, prefix="/api", tags=["robots.txt"])
app.include_router(scraper_router, prefix="/api", tags=["スクレイピング"])


@app.get("/")
async def root():
    """ヘルスチェック用エンドポイント"""
    return {"status": "ok", "message": "Webスクレイピング支援ツール API"}


@app.get("/api/config")
async def get_config():
    """デフォルト設定値を返却"""
    return {
        "sleep_interval": 5,
        "robots_check": True,
        "html_sanitize": True,
        "max_urls": 100,
        "log_level": "INFO"
    }
