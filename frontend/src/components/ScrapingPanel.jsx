import { useState, useRef, useEffect } from 'react'

function ScrapingPanel({ urls = [], selector = '', onScrapingComplete, onViewResults }) {
    const [scrapeUrls, setScrapeUrls] = useState(urls)
    const [cssSelector, setCssSelector] = useState(selector || '')
    const [sleepInterval, setSleepInterval] = useState(5)
    const [isRunning, setIsRunning] = useState(false)
    const [logs, setLogs] = useState([])
    const [results, setResults] = useState([])
    const [robotsResults, setRobotsResults] = useState(null)
    const [checkingRobots, setCheckingRobots] = useState(false)
    const logsEndRef = useRef(null)
    const abortControllerRef = useRef(null)

    useEffect(() => {
        if (urls.length > 0) {
            setScrapeUrls(urls)
        }
    }, [urls])

    useEffect(() => {
        if (selector) {
            setCssSelector(selector)
        }
    }, [selector])

    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [logs])

    const addLog = (message, type = 'info') => {
        const timestamp = new Date().toLocaleTimeString('ja-JP')
        setLogs(prev => [...prev, { timestamp, message, type }])
    }

    const handleCheckRobots = async () => {
        if (scrapeUrls.length === 0) {
            addLog('URLリストが空です', 'error')
            return
        }

        setCheckingRobots(true)
        setRobotsResults(null)
        addLog('robots.txt をチェック中...', 'info')

        try {
            const response = await fetch('/api/check-robots', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ urls: scrapeUrls })
            })

            if (!response.ok) {
                throw new Error('robots.txt チェックに失敗しました')
            }

            const data = await response.json()
            setRobotsResults(data)

            if (data.all_allowed) {
                addLog('✓ すべてのURLでアクセスが許可されています', 'success')
            } else {
                addLog('⚠ 一部のURLでアクセスが制限されています', 'error')
            }
        } catch (err) {
            addLog(`エラー: ${err.message}`, 'error')
        } finally {
            setCheckingRobots(false)
        }
    }

    const handleStartScraping = async () => {
        if (scrapeUrls.length === 0) {
            addLog('URLリストが空です', 'error')
            return
        }

        setIsRunning(true)
        setResults([])
        addLog(`スクレイピング開始: ${scrapeUrls.length}件のURL`, 'info')

        abortControllerRef.current = new AbortController()

        try {
            const response = await fetch('/api/scrape-stream', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    urls: scrapeUrls,
                    selector: cssSelector || null,
                    sleep_interval: sleepInterval
                }),
                signal: abortControllerRef.current.signal
            })

            const reader = response.body.getReader()
            const decoder = new TextDecoder()

            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                const chunk = decoder.decode(value)
                const lines = chunk.split('\n').filter(line => line.startsWith('data: '))

                for (const line of lines) {
                    try {
                        const data = JSON.parse(line.slice(6))

                        if (data.type === 'progress') {
                            addLog(`[${data.current}/${data.total}] ${data.url}`, 'info')
                        } else if (data.type === 'result') {
                            const result = data.data
                            if (result.success) {
                                addLog(`✓ 成功: ${result.url}`, 'success')
                                setResults(prev => [...prev, result])
                            } else {
                                addLog(`✗ 失敗: ${result.url} - ${result.error}`, 'error')
                            }
                        } else if (data.type === 'complete') {
                            addLog(`完了: 成功 ${data.success_count}件 / 失敗 ${data.error_count}件`, 'info')
                        }
                    } catch (e) {
                        // JSON parse error, ignore
                    }
                }
            }
        } catch (err) {
            if (err.name === 'AbortError') {
                addLog('スクレイピングが中止されました', 'info')
            } else {
                addLog(`エラー: ${err.message}`, 'error')
            }
        } finally {
            setIsRunning(false)
            // 親コンポーネントに結果を通知
            if (onScrapingComplete) {
                onScrapingComplete(results)
            }
        }
    }

    const handleStopScraping = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort()
        }
        setIsRunning(false)
    }

    const handleClearUrls = () => {
        setScrapeUrls([])
        setResults([])
        setLogs([])
        setRobotsResults(null)
    }

    return (
        <div className="space-y-6">
            {/* URLリスト */}
            <div className="card p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <span>📋</span> URLリスト
                        <span className="text-sm font-normal bg-blue-600 px-2 py-0.5 rounded-full">
                            {scrapeUrls.length}件
                        </span>
                    </h2>
                    <button onClick={handleClearUrls} className="btn btn-secondary text-sm">
                        🗑️ クリア
                    </button>
                </div>

                {scrapeUrls.length > 0 ? (
                    <div className="bg-slate-900 rounded-lg p-4 font-mono text-sm max-h-40 overflow-y-auto">
                        {scrapeUrls.slice(0, 20).map((url, i) => (
                            <div key={i} className="text-slate-300 flex items-center gap-2 py-0.5">
                                <span className="text-slate-500 w-6 text-right">{i + 1}.</span>
                                <span className={robotsResults?.results?.[i]?.allowed === false ? 'text-red-400' : 'text-blue-400'}>
                                    {url}
                                </span>
                                {robotsResults?.results?.[i]?.allowed === false && (
                                    <span className="text-red-400 text-xs">⚠ 制限</span>
                                )}
                            </div>
                        ))}
                        {scrapeUrls.length > 20 && (
                            <div className="text-slate-500 pt-2">... 他 {scrapeUrls.length - 20} 件</div>
                        )}
                    </div>
                ) : (
                    <div className="text-center py-8 text-slate-500">
                        <p>「URL生成」タブでURLを生成してください</p>
                    </div>
                )}
            </div>

            {/* 設定 */}
            <div className="card p-6">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <span>⚙️</span> スクレイピング設定
                </h2>

                <div className="grid grid-cols-2 gap-6">
                    <div>
                        <label className="text-sm text-slate-400 mb-2 block">CSSセレクタ（オプション）</label>
                        <input
                            type="text"
                            value={cssSelector}
                            onChange={(e) => setCssSelector(e.target.value)}
                            placeholder=".article-title, #main-content"
                            className="input font-mono"
                        />
                        <p className="text-xs text-slate-500 mt-1">
                            指定すると、この要素のテキストのみ抽出します
                        </p>
                    </div>
                    <div>
                        <label className="text-sm text-slate-400 mb-2 block">リクエスト間隔（秒）</label>
                        <input
                            type="number"
                            value={sleepInterval}
                            onChange={(e) => setSleepInterval(parseFloat(e.target.value))}
                            min="1"
                            max="60"
                            step="0.5"
                            className="input"
                        />
                        <p className="text-xs text-slate-500 mt-1">
                            サーバー負荷軽減のため、2秒以上を推奨
                        </p>
                    </div>
                </div>

                {/* アクションボタン */}
                <div className="flex gap-4 mt-6">
                    <button
                        onClick={handleCheckRobots}
                        disabled={checkingRobots || isRunning || scrapeUrls.length === 0}
                        className="btn btn-secondary flex items-center gap-2"
                    >
                        {checkingRobots ? (
                            <>
                                <span className="animate-spin">⏳</span>
                                チェック中...
                            </>
                        ) : (
                            <>
                                <span>🤖</span>
                                robots.txt確認
                            </>
                        )}
                    </button>

                    {!isRunning ? (
                        <button
                            onClick={handleStartScraping}
                            disabled={scrapeUrls.length === 0}
                            className="btn btn-success flex items-center gap-2"
                        >
                            <span>▶️</span>
                            スクレイピング開始
                        </button>
                    ) : (
                        <button
                            onClick={handleStopScraping}
                            className="btn btn-danger flex items-center gap-2"
                        >
                            <span>⏹️</span>
                            停止
                        </button>
                    )}
                </div>
            </div>

            {/* robots.txt 結果 */}
            {robotsResults && (
                <div className={`alert ${robotsResults.all_allowed ? 'alert-success' : 'alert-warning'}`}>
                    <h3 className="font-medium mb-2">
                        {robotsResults.all_allowed ? '✓ robots.txt チェック完了' : '⚠ 注意が必要です'}
                    </h3>
                    <p className="text-sm opacity-80">
                        {robotsResults.all_allowed
                            ? 'すべてのURLでアクセスが許可されています'
                            : '一部のURLでアクセスが制限されている可能性があります。robots.txt の内容を確認してください。'
                        }
                    </p>
                </div>
            )}

            {/* ログ表示 */}
            <div className="card p-6">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <span>📜</span> 実行ログ
                </h2>
                <div className="log-area min-h-[150px]">
                    {logs.length === 0 ? (
                        <div className="text-slate-500">ログはここに表示されます...</div>
                    ) : (
                        logs.map((log, i) => (
                            <div key={i} className={`log-${log.type} py-0.5`}>
                                <span className="text-slate-500">[{log.timestamp}]</span> {log.message}
                            </div>
                        ))
                    )}
                    <div ref={logsEndRef} />
                </div>
            </div>

            {/* 結果表示 */}
            {results.length > 0 && (
                <div className="card p-6">
                    <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                        <span>📊</span> 取得結果（プレビュー）
                        <span className="text-sm font-normal bg-emerald-600 px-2 py-0.5 rounded-full">
                            {results.length}件
                        </span>
                        {onViewResults && (
                            <button
                                onClick={() => {
                                    if (onScrapingComplete) onScrapingComplete(results)
                                    onViewResults()
                                }}
                                className="btn btn-primary text-sm ml-auto"
                            >
                                📊 結果一覧を見る
                            </button>
                        )}
                    </h2>

                    <div className="space-y-4 max-h-[400px] overflow-y-auto">
                        {results.map((result, i) => (
                            <div key={i} className="bg-slate-900 rounded-lg p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm text-blue-400 font-mono truncate max-w-[80%]">
                                        {result.url}
                                    </span>
                                    <span className="text-xs bg-emerald-600 px-2 py-0.5 rounded">
                                        {result.status_code}
                                    </span>
                                </div>

                                {result.extracted_data && result.extracted_data.length > 0 ? (
                                    <div className="mt-2">
                                        <p className="text-xs text-slate-500 mb-1">抽出データ:</p>
                                        <div className="space-y-1">
                                            {result.extracted_data.slice(0, 5).map((data, j) => (
                                                <div key={j} className="text-sm text-slate-300 bg-slate-800 px-2 py-1 rounded">
                                                    {data}
                                                </div>
                                            ))}
                                            {result.extracted_data.length > 5 && (
                                                <div className="text-xs text-slate-500">
                                                    ... 他 {result.extracted_data.length - 5} 件
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-sm text-slate-400 mt-2">
                                        {result.content?.substring(0, 200)}...
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}

export default ScrapingPanel
