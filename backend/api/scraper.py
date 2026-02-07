"""
スクレイピング実行API
URLリストに対してスクレイピングを実行し、結果を返却する
"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional
from bs4 import BeautifulSoup
import requests
import time
import json
import asyncio

router = APIRouter()


class ScrapeConfig(BaseModel):
    """スクレイピング設定"""
    urls: List[str]
    selector: Optional[str] = None  # 抽出するCSSセレクタ
    exclude_tags: Optional[List[str]] = None  # 除外するタグ（例: ["span", "script"]）
    sleep_interval: float = 5.0  # リクエスト間隔（秒）
    timeout: int = 30  # リクエストタイムアウト（秒）
    headers: Optional[dict] = None  # カスタムヘッダー


class ScrapeResult(BaseModel):
    """スクレイピング結果"""
    url: str
    success: bool
    status_code: Optional[int] = None
    content: Optional[str] = None
    extracted_data: Optional[List[str]] = None
    error: Optional[str] = None


class ScrapeResponse(BaseModel):
    """スクレイピングレスポンス"""
    results: List[ScrapeResult]
    total: int
    success_count: int
    error_count: int


def scrape_single_url(
    url: str,
    selector: Optional[str] = None,
    exclude_tags: Optional[List[str]] = None,
    timeout: int = 30,
    headers: Optional[dict] = None
) -> ScrapeResult:
    """
    単一URLをスクレイピングする
    """
    default_headers = {
        'User-Agent': 'Mozilla/5.0 (compatible; WebScrapingTool/1.0; Educational Purpose)'
    }
    if headers:
        default_headers.update(headers)
    
    try:
        response = requests.get(url, timeout=timeout, headers=default_headers)
        
        if response.status_code != 200:
            return ScrapeResult(
                url=url,
                success=False,
                status_code=response.status_code,
                error=f"HTTPエラー: {response.status_code}"
            )
        
        soup = BeautifulSoup(response.text, 'lxml')
        
        # セレクタが指定されていれば抽出
        extracted_data = None
        if selector:
            elements = soup.select(selector)
            extracted_texts = []
            for el in elements:
                # 除外タグを削除してからテキスト取得
                if exclude_tags:
                    for tag in exclude_tags:
                        for child in el.find_all(tag):
                            child.decompose()
                extracted_texts.append(el.get_text(strip=True))
            extracted_data = extracted_texts
        
        # コンテンツ全体（先頭1000文字まで）
        content = response.text[:1000]
        
        return ScrapeResult(
            url=url,
            success=True,
            status_code=response.status_code,
            content=content,
            extracted_data=extracted_data
        )
    
    except requests.Timeout:
        return ScrapeResult(
            url=url,
            success=False,
            error="タイムアウトしました"
        )
    except requests.RequestException as e:
        return ScrapeResult(
            url=url,
            success=False,
            error=f"リクエストエラー: {str(e)}"
        )
    except Exception as e:
        return ScrapeResult(
            url=url,
            success=False,
            error=f"予期しないエラー: {str(e)}"
        )


@router.post("/scrape", response_model=ScrapeResponse)
async def scrape_urls(config: ScrapeConfig):
    """
    URLリストに対してスクレイピングを実行する
    
    注意: このエンドポイントは同期的に処理し、すべての結果を返却します
    """
    try:
        if not config.urls:
            raise HTTPException(status_code=400, detail="URLリストが空です")
        
        if len(config.urls) > 100:
            raise HTTPException(status_code=400, detail="URLは100件まで指定可能です")
        
        results = []
        success_count = 0
        error_count = 0
        
        for i, url in enumerate(config.urls):
            result = scrape_single_url(
                url=url,
                selector=config.selector,
                exclude_tags=config.exclude_tags,
                timeout=config.timeout,
                headers=config.headers
            )
            
            if result.success:
                success_count += 1
            else:
                error_count += 1
            
            results.append(result)
            
            # 最後のURL以外はスリープ
            if i < len(config.urls) - 1:
                await asyncio.sleep(config.sleep_interval)
        
        return ScrapeResponse(
            results=results,
            total=len(results),
            success_count=success_count,
            error_count=error_count
        )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"スクレイピングエラー: {str(e)}")


@router.post("/scrape-stream")
async def scrape_urls_stream(config: ScrapeConfig):
    """
    URLリストに対してスクレイピングを実行し、結果をストリーミングで返却する
    （Server-Sent Events）
    """
    async def generate():
        try:
            if not config.urls:
                yield f"data: {json.dumps({'error': 'URLリストが空です'})}\n\n"
                return
            
            total = len(config.urls)
            success_count = 0
            error_count = 0
            
            # 開始イベント
            yield f"data: {json.dumps({'type': 'start', 'total': total})}\n\n"
            
            for i, url in enumerate(config.urls):
                # 進捗イベント
                yield f"data: {json.dumps({'type': 'progress', 'current': i + 1, 'total': total, 'url': url})}\n\n"
                
                result = scrape_single_url(
                    url=url,
                    selector=config.selector,
                    exclude_tags=config.exclude_tags,
                    timeout=config.timeout,
                    headers=config.headers
                )
                
                if result.success:
                    success_count += 1
                else:
                    error_count += 1
                
                # 結果イベント
                yield f"data: {json.dumps({'type': 'result', 'data': result.model_dump()})}\n\n"
                
                # 最後のURL以外はスリープ
                if i < len(config.urls) - 1:
                    await asyncio.sleep(config.sleep_interval)
            
            # 完了イベント
            yield f"data: {json.dumps({'type': 'complete', 'total': total, 'success_count': success_count, 'error_count': error_count})}\n\n"
        
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
    
    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )
