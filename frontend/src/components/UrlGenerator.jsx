import { useState } from 'react'

function UrlGenerator({ onUrlsGenerated }) {
    const [template, setTemplate] = useState('')
    const [placeholderType, setPlaceholderType] = useState('range')
    const [placeholderName, setPlaceholderName] = useState('num')
    const [rangeStart, setRangeStart] = useState(1)
    const [rangeEnd, setRangeEnd] = useState(10)
    const [rangeStep, setRangeStep] = useState(1)
    const [listValues, setListValues] = useState('')
    const [preview, setPreview] = useState(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const sampleTemplates = [
        { label: 'ページ番号', template: 'https://example.com/news/page/{num}' },
        { label: '記事ID', template: 'https://example.com/article/{id}' },
        { label: 'ユーザー名', template: 'https://example.com/user/{name}/profile' },
    ]

    const buildPlaceholders = () => {
        const placeholder = {}

        if (placeholderType === 'range') {
            placeholder[placeholderName] = {
                type: 'range',
                start: parseInt(rangeStart),
                end: parseInt(rangeEnd),
                step: parseInt(rangeStep)
            }
        } else {
            const values = listValues.split(',').map(v => v.trim()).filter(v => v)
            placeholder[placeholderName] = {
                type: 'list',
                values
            }
        }

        return placeholder
    }

    const handlePreview = async () => {
        if (!template.trim()) {
            setError('URLテンプレートを入力してください')
            return
        }

        setLoading(true)
        setError('')

        try {
            const response = await fetch('/api/preview-template', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    template,
                    placeholders: buildPlaceholders()
                })
            })

            if (!response.ok) {
                const data = await response.json()
                throw new Error(data.detail || 'プレビュー生成に失敗しました')
            }

            const data = await response.json()
            setPreview(data)
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const handleGenerate = async () => {
        if (!template.trim()) {
            setError('URLテンプレートを入力してください')
            return
        }

        setLoading(true)
        setError('')

        try {
            const response = await fetch('/api/generate-urls', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    template,
                    placeholders: buildPlaceholders()
                })
            })

            if (!response.ok) {
                const data = await response.json()
                throw new Error(data.detail || 'URL生成に失敗しました')
            }

            const data = await response.json()
            onUrlsGenerated(data.urls)
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="space-y-6">
            {/* URLテンプレート入力 */}
            <div className="card p-6">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <span>🔗</span> URLテンプレート
                </h2>

                {/* サンプルテンプレート */}
                <div className="mb-4">
                    <label className="text-sm text-slate-400 mb-2 block">サンプルテンプレート:</label>
                    <div className="flex flex-wrap gap-2">
                        {sampleTemplates.map((sample, i) => (
                            <button
                                key={i}
                                onClick={() => setTemplate(sample.template)}
                                className="text-sm bg-slate-700 hover:bg-slate-600 px-3 py-1 rounded-full text-slate-300 transition"
                            >
                                {sample.label}
                            </button>
                        ))}
                    </div>
                </div>

                <input
                    type="text"
                    value={template}
                    onChange={(e) => setTemplate(e.target.value)}
                    placeholder="https://example.com/page/{num}"
                    className="input font-mono"
                />
                <p className="text-xs text-slate-500 mt-2">
                    💡 プレースホルダを <code className="text-blue-400">{'{name}'}</code> の形式で記述してください
                </p>
            </div>

            {/* プレースホルダ設定 */}
            <div className="card p-6">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <span>⚙️</span> プレースホルダ設定
                </h2>

                <div className="grid grid-cols-2 gap-6">
                    {/* プレースホルダ名 */}
                    <div>
                        <label className="text-sm text-slate-400 mb-2 block">プレースホルダ名</label>
                        <input
                            type="text"
                            value={placeholderName}
                            onChange={(e) => setPlaceholderName(e.target.value)}
                            className="input"
                            placeholder="num"
                        />
                    </div>

                    {/* タイプ選択 */}
                    <div>
                        <label className="text-sm text-slate-400 mb-2 block">タイプ</label>
                        <div className="flex gap-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    value="range"
                                    checked={placeholderType === 'range'}
                                    onChange={(e) => setPlaceholderType(e.target.value)}
                                    className="text-blue-500"
                                />
                                <span>数値範囲</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    value="list"
                                    checked={placeholderType === 'list'}
                                    onChange={(e) => setPlaceholderType(e.target.value)}
                                    className="text-blue-500"
                                />
                                <span>リスト</span>
                            </label>
                        </div>
                    </div>
                </div>

                {/* 数値範囲設定 */}
                {placeholderType === 'range' && (
                    <div className="grid grid-cols-3 gap-4 mt-4">
                        <div>
                            <label className="text-sm text-slate-400 mb-2 block">開始値</label>
                            <input
                                type="number"
                                value={rangeStart}
                                onChange={(e) => setRangeStart(e.target.value)}
                                className="input"
                            />
                        </div>
                        <div>
                            <label className="text-sm text-slate-400 mb-2 block">終了値</label>
                            <input
                                type="number"
                                value={rangeEnd}
                                onChange={(e) => setRangeEnd(e.target.value)}
                                className="input"
                            />
                        </div>
                        <div>
                            <label className="text-sm text-slate-400 mb-2 block">ステップ</label>
                            <input
                                type="number"
                                value={rangeStep}
                                onChange={(e) => setRangeStep(e.target.value)}
                                min="1"
                                className="input"
                            />
                        </div>
                    </div>
                )}

                {/* リスト設定 */}
                {placeholderType === 'list' && (
                    <div className="mt-4">
                        <label className="text-sm text-slate-400 mb-2 block">値リスト（カンマ区切り）</label>
                        <input
                            type="text"
                            value={listValues}
                            onChange={(e) => setListValues(e.target.value)}
                            placeholder="Alice, Bob, Carol, Tanaka"
                            className="input"
                        />
                    </div>
                )}

                {/* ボタン */}
                <div className="flex gap-4 mt-6">
                    <button
                        onClick={handlePreview}
                        disabled={loading}
                        className="btn btn-secondary flex items-center gap-2"
                    >
                        <span>👁️</span> プレビュー
                    </button>
                    <button
                        onClick={handleGenerate}
                        disabled={loading}
                        className="btn btn-primary flex items-center gap-2"
                    >
                        <span>🚀</span> URL生成してスクレイピングへ
                    </button>
                </div>
            </div>

            {/* エラー表示 */}
            {error && (
                <div className="alert alert-error flex items-center gap-2">
                    <span>❌</span>
                    <span>{error}</span>
                </div>
            )}

            {/* プレビュー結果 */}
            {preview && (
                <div className="card p-6">
                    <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                        <span>📋</span> URLプレビュー
                    </h2>
                    <div className="alert alert-info mb-4">
                        {preview.message}
                    </div>
                    <div className="bg-slate-900 rounded-lg p-4 font-mono text-sm space-y-1 max-h-48 overflow-y-auto">
                        {preview.preview.map((url, i) => (
                            <div key={i} className="text-slate-300 flex items-center gap-2">
                                <span className="text-slate-500 w-6">{i + 1}.</span>
                                <span className="text-blue-400">{url}</span>
                            </div>
                        ))}
                        {preview.total_estimated > 5 && (
                            <div className="text-slate-500 pt-2">
                                ... 他 {preview.total_estimated - 5} 件
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

export default UrlGenerator
