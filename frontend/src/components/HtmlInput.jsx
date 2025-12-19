import { useState } from 'react'

function HtmlInput({ onHtmlParsed }) {
    const [htmlInput, setHtmlInput] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [stats, setStats] = useState(null)

    const handleSubmit = async () => {
        if (!htmlInput.trim()) {
            setError('HTMLを入力してください')
            return
        }

        setLoading(true)
        setError('')

        try {
            const response = await fetch('/api/parse-html', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ html: htmlInput })
            })

            if (!response.ok) {
                const data = await response.json()
                throw new Error(data.detail || 'HTML解析に失敗しました')
            }

            const data = await response.json()
            setStats({
                elements: data.elements_count,
                hasScripts: data.has_scripts
            })
            onHtmlParsed(data.sanitized_html)
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const handleClear = () => {
        setHtmlInput('')
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
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <span>📝</span> HTMLソース入力
                </h2>
                <p className="text-slate-400 mb-4">
                    スクレイピング対象のHTMLソースを貼り付けてください。
                    ブラウザのデベロッパーツールからコピーできます。
                </p>

                {/* サンプルHTML挿入ボタン */}
                <button
                    onClick={() => setHtmlInput(sampleHtml)}
                    className="btn btn-secondary text-sm mb-4"
                >
                    📄 サンプルHTMLを挿入
                </button>

                {/* テキストエリア */}
                <textarea
                    value={htmlInput}
                    onChange={(e) => setHtmlInput(e.target.value)}
                    placeholder="<!DOCTYPE html>&#10;<html>&#10;  ..."
                    className="textarea min-h-[300px]"
                    spellCheck="false"
                />

                {/* ボタン群 */}
                <div className="flex gap-4 mt-4">
                    <button
                        onClick={handleSubmit}
                        disabled={loading || !htmlInput.trim()}
                        className={`btn btn-primary flex items-center gap-2 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        {loading ? (
                            <>
                                <span className="animate-spin">⏳</span>
                                解析中...
                            </>
                        ) : (
                            <>
                                <span>🔍</span>
                                レンダリング
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
                <div className="alert alert-error flex items-center gap-2">
                    <span>❌</span>
                    <span>{error}</span>
                </div>
            )}

            {/* 統計情報 */}
            {stats && (
                <div className="card p-4">
                    <h3 className="font-medium text-white mb-2">📊 解析結果</h3>
                    <div className="flex gap-6 text-sm">
                        <div>
                            <span className="text-slate-400">要素数:</span>
                            <span className="ml-2 text-blue-400 font-medium">{stats.elements}</span>
                        </div>
                        {stats.hasScripts && (
                            <div className="text-amber-400">
                                ⚠️ スクリプトタグが除去されました
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* 注意事項 */}
            <div className="alert alert-info">
                <h3 className="font-medium mb-2">💡 ヒント</h3>
                <ul className="text-sm space-y-1 text-blue-200/80">
                    <li>• ブラウザのデベロッパーツール（F12）→ Elements タブからHTMLをコピー</li>
                    <li>• 危険なスクリプトタグは自動的に除去されます</li>
                    <li>• 動的に生成されるコンテンツ（JavaScript）には対応していません</li>
                </ul>
            </div>
        </div>
    )
}

export default HtmlInput
