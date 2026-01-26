import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

function HtmlInput({ onHtmlParsed }) {
    const [mode, setMode] = useState('url') // 'url' or 'source'
    const [inputValue, setInputValue] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [stats, setStats] = useState(null)

    const handleSubmit = async () => {
        if (!inputValue.trim()) {
            setError(mode === 'url' ? 'URLを入力してください' : 'HTMLを入力してください')
            return
        }

        setLoading(true)
        setError('')
        setStats(null)

        try {
            let data;

            if (mode === 'url') {
                const response = await fetch('/api/fetch-html', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url: inputValue })
                })

                if (!response.ok) {
                    const errData = await response.json()
                    throw new Error(errData.detail || 'HTMLの取得に失敗しました')
                }
                data = await response.json()

            } else {
                const response = await fetch('/api/parse-html', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ html: inputValue })
                })

                if (!response.ok) {
                    const errData = await response.json()
                    throw new Error(errData.detail || 'HTML解析に失敗しました')
                }
                data = await response.json()
            }

            setStats({
                elements: data.elements_count,
                hasScripts: data.has_scripts,
                robotsPassed: data.robots_check_passed
            })
            onHtmlParsed(data.sanitized_html)

        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const handleClear = () => {
        setInputValue('')
        setError('')
        setStats(null)
    }

    const sampleHtml = `<!DOCTYPE html>
<html>
<head>
  <title>サンプルページ</title>
</head>
<body>
  <header class="main-header" id="top">
    <h1 data-section="title">ようこそ</h1>
  </header>
  <main class="content">
    <article class="post" data-id="1">
      <h2>記事タイトル1</h2>
      <p class="summary">これはサンプル記事です。</p>
    </article>
    <article class="post" data-id="2">
      <h2>記事タイトル2</h2>
      <p class="summary">2つ目の記事です。</p>
    </article>
  </main>
</body>
</html>`

    return (
        <div className="space-y-6">
            <div className="card p-6">
                <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                    <span>📝</span> HTMLソース入力
                </h2>

                {/* モード切替タブ */}
                <div className="flex border-b border-slate-700 mb-6">
                    <button
                        className={`px-4 py-2 text-sm font-medium transition-colors ${mode === 'url'
                                ? 'text-blue-400 border-b-2 border-blue-400'
                                : 'text-slate-400 hover:text-slate-200'
                            }`}
                        onClick={() => {
                            setMode('url')
                            setError('')
                        }}
                    >
                        🌐 URLから取得
                    </button>
                    <button
                        className={`px-4 py-2 text-sm font-medium transition-colors ${mode === 'source'
                                ? 'text-blue-400 border-b-2 border-blue-400'
                                : 'text-slate-400 hover:text-slate-200'
                            }`}
                        onClick={() => {
                            setMode('source')
                            setError('')
                        }}
                    >
                        📄 ソースコード直接入力
                    </button>
                </div>

                <div className="mb-4">
                    {mode === 'url' ? (
                        <div>
                            <p className="text-slate-400 mb-2 text-sm">
                                スクレイピングしたいWebページのURLを入力してください。
                                自動的にrobots.txtを確認します。
                            </p>
                            <input
                                type="url"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                placeholder="https://example.com"
                                className="input w-full font-mono text-sm"
                            />
                        </div>
                    ) : (
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <p className="text-slate-400 text-sm">
                                    HTMLソースを直接貼り付けてください。
                                </p>
                                <button
                                    onClick={() => setInputValue(sampleHtml)}
                                    className="text-xs text-blue-400 hover:text-blue-300 underline"
                                >
                                    サンプルHTMLを挿入
                                </button>
                            </div>
                            <textarea
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                placeholder="<!DOCTYPE html>&#10;<html>&#10;  ..."
                                className="textarea min-h-[200px] font-mono text-sm leading-relaxed"
                                spellCheck="false"
                            />
                        </div>
                    )}
                </div>

                {/* ボタン群 */}
                <div className="flex gap-4 mt-6">
                    <button
                        onClick={handleSubmit}
                        disabled={loading || !inputValue.trim()}
                        className={`btn btn-primary flex items-center gap-2 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        {loading ? (
                            <>
                                <span className="animate-spin">⏳</span>
                                {mode === 'url' ? '取得中...' : '解析中...'}
                            </>
                        ) : (
                            <>
                                <span>🔍</span>
                                {mode === 'url' ? '取得・解析' : 'レンダリング'}
                            </>
                        )}
                    </button>
                    <button
                        onClick={handleClear}
                        className="btn btn-secondary"
                    >
                        🗑️ クリア
                    </button>
                </div>
            </div>

            {/* エラー表示 */}
            {error && (
                <div className="alert alert-error flex items-center gap-2 animate-pulse">
                    <span>❌</span>
                    <span>{error}</span>
                </div>
            )}

            {/* 統計情報 */}
            {stats && (
                <div className="card p-4 bg-slate-800/50 border border-slate-700">
                    <h3 className="font-medium text-white mb-2 flex items-center gap-2">
                        <span>📊</span> 解析結果
                    </h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <span className="text-slate-400">要素数:</span>
                            <span className="ml-2 text-blue-400 font-mono font-bold text-lg">{stats.elements}</span>
                        </div>
                        {stats.robotsPassed !== undefined && (
                            <div>
                                <span className="text-slate-400">robots.txt:</span>
                                <span className="ml-2 text-green-400 font-medium">✅ 許可済み</span>
                            </div>
                        )}
                        {stats.hasScripts && (
                            <div className="col-span-2 text-amber-400 bg-amber-900/20 px-3 py-1 rounded border border-amber-900/50">
                                ⚠️ スクリプトタグが除去されました
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* 注意事項 */}
            <div className="alert alert-info">
                <h3 className="font-medium mb-2 text-blue-200">💡 ヒント</h3>
                <ul className="text-sm space-y-1 text-slate-300/80 list-disc list-inside">
                    <li>URL入力モードでは、自動的に <code>robots.txt</code> のチェックを行います。</li>
                    <li>サイト管理者によってスクレイピングが禁止されているページは取得できません。</li>
                    <li>動的に生成されるコンテンツ（JavaScript）は正しく取得できない場合があります。</li>
                </ul>
            </div>
        </div>
    )
}

export default HtmlInput
