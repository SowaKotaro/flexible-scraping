"""
URL生成API
テンプレートとパラメータからURLリストを生成する
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Union
import re

router = APIRouter()


class UrlTemplateInput(BaseModel):
    """URL生成入力モデル"""
    template: str  # 例: "https://example.com/page/{num}"
    placeholders: dict  # 例: {"num": {"type": "range", "start": 1, "end": 10}}


class UrlGenerateResponse(BaseModel):
    """URL生成レスポンスモデル"""
    urls: List[str]
    count: int


def parse_placeholder_value(placeholder_config: dict) -> List[str]:
    """
    プレースホルダ設定から値のリストを生成する
    
    Args:
        placeholder_config: プレースホルダ設定
            - type: "range" の場合 → start, end を使用
            - type: "list" の場合 → values を使用
    
    Returns:
        値のリスト
    """
    placeholder_type = placeholder_config.get('type', 'list')
    
    if placeholder_type == 'range':
        start = int(placeholder_config.get('start', 1))
        end = int(placeholder_config.get('end', 10))
        step = int(placeholder_config.get('step', 1))
        return [str(i) for i in range(start, end + 1, step)]
    
    elif placeholder_type == 'list':
        values = placeholder_config.get('values', [])
        return [str(v) for v in values]
    
    else:
        raise ValueError(f"未対応のプレースホルダタイプ: {placeholder_type}")


def generate_urls(template: str, placeholders: dict, max_urls: int = 100) -> List[str]:
    """
    テンプレートとプレースホルダからURLリストを生成する
    
    Args:
        template: URLテンプレート
        placeholders: プレースホルダ設定の辞書
        max_urls: 生成するURLの最大数
    
    Returns:
        生成されたURLのリスト
    """
    if not placeholders:
        return [template]
    
    # プレースホルダの値を展開
    placeholder_values = {}
    for key, config in placeholders.items():
        placeholder_values[key] = parse_placeholder_value(config)
    
    # 組み合わせを生成（単一プレースホルダの場合）
    if len(placeholder_values) == 1:
        key = list(placeholder_values.keys())[0]
        values = placeholder_values[key]
        urls = []
        for value in values[:max_urls]:
            url = template.replace(f"{{{key}}}", value)
            urls.append(url)
        return urls
    
    # 複数プレースホルダの場合は直積を生成
    from itertools import product
    
    keys = list(placeholder_values.keys())
    value_lists = [placeholder_values[k] for k in keys]
    
    urls = []
    for combination in product(*value_lists):
        if len(urls) >= max_urls:
            break
        url = template
        for key, value in zip(keys, combination):
            url = url.replace(f"{{{key}}}", value)
        urls.append(url)
    
    return urls


@router.post("/generate-urls", response_model=UrlGenerateResponse)
async def generate_url_list(input_data: UrlTemplateInput):
    """
    URLテンプレートとプレースホルダからURLリストを生成する
    
    例:
    - template: "https://example.com/page/{num}"
    - placeholders: {"num": {"type": "range", "start": 1, "end": 5}}
    → ["https://example.com/page/1", ..., "https://example.com/page/5"]
    """
    try:
        if not input_data.template.strip():
            raise HTTPException(status_code=400, detail="URLテンプレートが空です")
        
        urls = generate_urls(input_data.template, input_data.placeholders)
        
        return UrlGenerateResponse(
            urls=urls,
            count=len(urls)
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"URL生成エラー: {str(e)}")


@router.post("/preview-template")
async def preview_template(input_data: UrlTemplateInput):
    """
    URLテンプレートのプレビュー（最初の5件のみ）
    """
    try:
        urls = generate_urls(input_data.template, input_data.placeholders, max_urls=5)
        total_count = 1
        
        for config in input_data.placeholders.values():
            if config.get('type') == 'range':
                start = int(config.get('start', 1))
                end = int(config.get('end', 10))
                step = int(config.get('step', 1))
                total_count *= len(range(start, end + 1, step))
            elif config.get('type') == 'list':
                total_count *= len(config.get('values', []))
        
        return {
            "preview": urls,
            "total_estimated": total_count,
            "message": f"合計 {total_count} 件のURLが生成されます"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"プレビューエラー: {str(e)}")
