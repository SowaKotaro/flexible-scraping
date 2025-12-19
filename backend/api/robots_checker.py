"""
robots.txt チェックAPI
対象URLのrobots.txtを取得し、アクセス許可状態を確認する
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from urllib.parse import urlparse, urljoin
from urllib.robotparser import RobotFileParser
import requests

router = APIRouter()


class RobotsCheckInput(BaseModel):
    """robots.txt チェック入力モデル"""
    urls: List[str]
    user_agent: str = "*"


class RobotsCheckResult(BaseModel):
    """個別URLのチェック結果"""
    url: str
    allowed: bool
    robots_url: str


class RobotsCheckResponse(BaseModel):
    """robots.txt チェックレスポンスモデル"""
    results: List[RobotsCheckResult]
    all_allowed: bool
    robots_content: Optional[str] = None


def get_robots_url(url: str) -> str:
    """URLからrobots.txtのURLを生成する"""
    parsed = urlparse(url)
    return f"{parsed.scheme}://{parsed.netloc}/robots.txt"


def fetch_robots_txt(robots_url: str, timeout: int = 10) -> Optional[str]:
    """robots.txtを取得する"""
    try:
        response = requests.get(robots_url, timeout=timeout)
        if response.status_code == 200:
            return response.text
        return None
    except requests.RequestException:
        return None


def check_url_allowed(robots_content: Optional[str], url: str, user_agent: str = "*") -> bool:
    """
    URLがrobots.txtで許可されているかチェックする
    robots.txtが存在しない場合は許可とみなす
    """
    if robots_content is None:
        return True
    
    rp = RobotFileParser()
    rp.parse(robots_content.splitlines())
    return rp.can_fetch(user_agent, url)


@router.post("/check-robots", response_model=RobotsCheckResponse)
async def check_robots(input_data: RobotsCheckInput):
    """
    URLリストに対してrobots.txtをチェックする
    
    同一ドメインのURLはまとめて処理し、効率化を図る
    """
    try:
        if not input_data.urls:
            raise HTTPException(status_code=400, detail="URLリストが空です")
        
        # ドメインごとにURLをグループ化
        domain_urls = {}
        for url in input_data.urls:
            parsed = urlparse(url)
            domain = f"{parsed.scheme}://{parsed.netloc}"
            if domain not in domain_urls:
                domain_urls[domain] = []
            domain_urls[domain].append(url)
        
        # ドメインごとにrobots.txtを取得してチェック
        results = []
        all_allowed = True
        first_robots_content = None
        
        for domain, urls in domain_urls.items():
            robots_url = f"{domain}/robots.txt"
            robots_content = fetch_robots_txt(robots_url)
            
            if first_robots_content is None and robots_content:
                first_robots_content = robots_content
            
            for url in urls:
                allowed = check_url_allowed(robots_content, url, input_data.user_agent)
                if not allowed:
                    all_allowed = False
                
                results.append(RobotsCheckResult(
                    url=url,
                    allowed=allowed,
                    robots_url=robots_url
                ))
        
        return RobotsCheckResponse(
            results=results,
            all_allowed=all_allowed,
            robots_content=first_robots_content
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"robots.txtチェックエラー: {str(e)}")


@router.get("/fetch-robots")
async def fetch_robots(url: str):
    """
    指定URLのrobots.txtを取得して内容を返却する
    """
    try:
        robots_url = get_robots_url(url)
        content = fetch_robots_txt(robots_url)
        
        if content is None:
            return {
                "robots_url": robots_url,
                "exists": False,
                "content": None,
                "message": "robots.txtが見つかりません（アクセス許可とみなします）"
            }
        
        return {
            "robots_url": robots_url,
            "exists": True,
            "content": content,
            "message": "robots.txtを取得しました"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"robots.txt取得エラー: {str(e)}")
