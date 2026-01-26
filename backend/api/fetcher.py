"""
URLからHTMLを取得するAPI
robots.txtのチェックを行い、許可されている場合のみHTMLを取得する
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import requests
from urllib.parse import urlparse
from .robots_checker import check_url_allowed, get_robots_url, fetch_robots_txt
from .html_parser import sanitize_html
from bs4 import BeautifulSoup

router = APIRouter()


class FetchHtmlRequest(BaseModel):
    url: str
    user_agent: str = "FlexibleScrapingTool/1.0"


class FetchHtmlResponse(BaseModel):
    url: str
    sanitized_html: str
    elements_count: int
    has_scripts: bool
    robots_check_passed: bool
    message: str


@router.post("/fetch-html", response_model=FetchHtmlResponse)
async def fetch_html(request: FetchHtmlRequest):
    """
    指定されたURLからHTMLを取得し、サニタイズして返却する
    robots.txtで禁止されている場合はエラーを返す
    """
    try:
        # 1. robots.txt チェック
        robots_url = get_robots_url(request.url)
        robots_content = fetch_robots_txt(robots_url)
        allowed = check_url_allowed(robots_content, request.url, request.user_agent)

        if not allowed:
            raise HTTPException(
                status_code=403, 
                detail="robots.txtによりアクセスが禁止されています"
            )

        # 2. HTML取得
        headers = {"User-Agent": request.user_agent}
        response = requests.get(request.url, headers=headers, timeout=30)
        response.raise_for_status()
        
        # エンコーディングの自動検出と設定
        response.encoding = response.apparent_encoding

        # 3. HTMLサニタイズ
        sanitized_html, has_scripts = sanitize_html(response.text)
        
        # 4. 要素数カウント
        soup = BeautifulSoup(sanitized_html, 'lxml')
        elements_count = len(soup.find_all(True))

        return FetchHtmlResponse(
            url=request.url,
            sanitized_html=sanitized_html,
            elements_count=elements_count,
            has_scripts=has_scripts,
            robots_check_passed=True,
            message="HTMLの取得に成功しました"
        )

    except requests.RequestException as e:
        raise HTTPException(status_code=400, detail=f"HTML取得エラー: {str(e)}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"予期せぬエラー: {str(e)}")
