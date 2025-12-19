"""
HTML解析API
BeautifulSoup4を使用してHTMLを解析し、安全なHTMLを返却する
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from bs4 import BeautifulSoup
import re

router = APIRouter()


class HtmlInput(BaseModel):
    """HTML入力モデル"""
    html: str


class HtmlParseResponse(BaseModel):
    """HTML解析レスポンスモデル"""
    sanitized_html: str
    elements_count: int
    has_scripts: bool


class ElementInfoRequest(BaseModel):
    """要素情報取得リクエスト"""
    html: str
    selector: str


def sanitize_html(html: str) -> tuple[str, bool]:
    """
    HTMLをサニタイズし、危険なスクリプトタグを除去する
    
    Args:
        html: 入力HTML
    
    Returns:
        (サニタイズ済みHTML, スクリプトタグが存在したかどうか)
    """
    soup = BeautifulSoup(html, 'lxml')
    has_scripts = False
    
    # script タグを除去
    for script in soup.find_all('script'):
        has_scripts = True
        script.decompose()
    
    # style タグ内の expression() や javascript: を除去
    for style in soup.find_all('style'):
        if style.string:
            style.string = re.sub(r'expression\s*\([^)]*\)', '', style.string, flags=re.IGNORECASE)
            style.string = re.sub(r'javascript:', '', style.string, flags=re.IGNORECASE)
    
    # イベントハンドラ属性を除去
    event_attrs = [
        'onload', 'onerror', 'onclick', 'onmouseover', 'onmouseout',
        'onmousedown', 'onmouseup', 'onkeydown', 'onkeyup', 'onkeypress',
        'onfocus', 'onblur', 'onchange', 'onsubmit', 'onreset'
    ]
    
    for tag in soup.find_all(True):
        for attr in event_attrs:
            if tag.has_attr(attr):
                del tag[attr]
        
        # href や src の javascript: スキームを除去
        for attr in ['href', 'src']:
            if tag.has_attr(attr) and tag[attr].strip().lower().startswith('javascript:'):
                del tag[attr]
    
    return str(soup), has_scripts


def extract_element_info(element) -> dict:
    """要素から属性情報を抽出する"""
    info = {
        'tag': element.name,
        'class': element.get('class', []),
        'id': element.get('id', ''),
        'data_attrs': {}
    }
    
    # data-* 属性を抽出
    for attr, value in element.attrs.items():
        if attr.startswith('data-'):
            info['data_attrs'][attr] = value
    
    # テキスト内容（先頭100文字まで）
    text = element.get_text(strip=True)
    info['text'] = text[:100] + '...' if len(text) > 100 else text
    
    return info


@router.post("/parse-html", response_model=HtmlParseResponse)
async def parse_html(input_data: HtmlInput):
    """
    HTMLソースを解析し、サニタイズ済みHTMLを返却する
    """
    try:
        if not input_data.html.strip():
            raise HTTPException(status_code=400, detail="HTMLが空です")
        
        sanitized_html, has_scripts = sanitize_html(input_data.html)
        
        # 要素数をカウント
        soup = BeautifulSoup(sanitized_html, 'lxml')
        elements_count = len(soup.find_all(True))
        
        return HtmlParseResponse(
            sanitized_html=sanitized_html,
            elements_count=elements_count,
            has_scripts=has_scripts
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"HTML解析エラー: {str(e)}")


@router.post("/element-info")
async def get_element_info(request: ElementInfoRequest):
    """
    指定されたセレクタに一致する要素の情報を取得する
    """
    try:
        soup = BeautifulSoup(request.html, 'lxml')
        elements = soup.select(request.selector)
        
        if not elements:
            return {"elements": [], "message": "要素が見つかりません"}
        
        element_infos = [extract_element_info(el) for el in elements[:10]]  # 最大10件
        
        return {"elements": element_infos, "total": len(elements)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"要素情報取得エラー: {str(e)}")
