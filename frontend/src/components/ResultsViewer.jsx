import { useState, useMemo } from 'react'

function ResultsViewer({ results = [] }) {
    const [searchQuery, setSearchQuery] = useState('')
    const [currentPage, setCurrentPage] = useState(1)
    const [itemsPerPage, setItemsPerPage] = useState(50)
    const [expandedItems, setExpandedItems] = useState(new Set())
    const [showOnlyExtracted, setShowOnlyExtracted] = useState(false)
    const [copySuccess, setCopySuccess] = useState(false)

    // フィルタリングされた結果
    const filteredResults = useMemo(() => {
        let filtered = results

        // 検索フィルタ
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase()
            filtered = filtered.filter(r =>
                r.url.toLowerCase().includes(query) ||
                r.content?.toLowerCase().includes(query) ||
                r.extracted_data?.some(d => d.toLowerCase().includes(query))
            )
        }

        // 抽出データありのみフィルタ
        if (showOnlyExtracted) {
            filtered = filtered.filter(r => r.extracted_data && r.extracted_data.length > 0)
        }

        return filtered
    }, [results, searchQuery, showOnlyExtracted])

    // ページネーション
    const totalPages = Math.ceil(filteredResults.length / itemsPerPage)
    const paginatedResults = filteredResults.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    )

    // すべての抽出データを取得
    const allExtractedData = useMemo(() => {
        return results.flatMap(r => r.extracted_data || [])
    }, [results])

    // 抽出データをクリップボードにコピー
    const copyAllExtractedData = async () => {
        const textToCopy = allExtractedData.join('\n')
        try {
            await navigator.clipboard.writeText(textToCopy)
            setCopySuccess(true)
            setTimeout(() => setCopySuccess(false), 2000)
        } catch (err) {
            console.error('コピーに失敗しました:', err)
        }
    }

    // 展開・折りたたみ
    const toggleExpand = (index) => {
        const newExpanded = new Set(expandedItems)
        if (newExpanded.has(index)) {
            newExpanded.delete(index)
        } else {
            newExpanded.add(index)
        }
        setExpandedItems(newExpanded)
    }

    // CSVエクスポート
    const exportToCSV = () => {
        const headers = ['URL', 'ステータス', '抽出データ']
        const rows = filteredResults.map(r => [
            r.url,
            r.status_code || 'N/A',
            (r.extracted_data || []).join(' | ')
        ])

        const csv = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        ].join('\n')

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `scraping_results_${new Date().toISOString().slice(0, 10)}.csv`
        a.click()
        URL.revokeObjectURL(url)
    }

    // JSONエクスポート
    const exportToJSON = () => {
        const json = JSON.stringify(filteredResults, null, 2)
        const blob = new Blob([json], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `scraping_results_${new Date().toISOString().slice(0, 10)}.json`
        a.click()
        URL.revokeObjectURL(url)
    }

    if (results.length === 0) {
        return (
            <div className="card p-12 text-center">
                <div className="text-6xl mb-4">📊</div>
                <h2 className="text-xl font-bold text-white mb-2">取得結果一覧</h2>
                <p className="text-slate-400">
                    スクレイピングを実行すると、ここに結果が表示されます
                </p>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* 統計情報 */}
            <div className="grid grid-cols-4 gap-4">
                <div className="card p-4 text-center">
                    <div className="text-3xl font-bold text-blue-400">{results.length}</div>
                    <div className="text-sm text-slate-400">総取得件数</div>
                </div>
                <div className="card p-4 text-center">
                    <div className="text-3xl font-bold text-emerald-400">
                        {results.filter(r => r.success).length}
                    </div>
                    <div className="text-sm text-slate-400">成功</div>
                </div>
                <div className="card p-4 text-center">
                    <div className="text-3xl font-bold text-red-400">
                        {results.filter(r => !r.success).length}
                    </div>
                    <div className="text-sm text-slate-400">失敗</div>
                </div>
                <div className="card p-4 text-center">
                    <div className="text-3xl font-bold text-purple-400">{allExtractedData.length}</div>
                    <div className="text-sm text-slate-400">抽出データ数</div>
                </div>
            </div>

            {/* ツールバー */}
            <div className="card p-4">
                <div className="flex flex-wrap items-center gap-4">
                    {/* 検索 */}
                    <div className="flex-1 min-w-[200px]">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value)
                                setCurrentPage(1)
                            }}
                            placeholder="🔍 URL、抽出データで検索..."
                            className="input"
                        />
                    </div>

                    {/* フィルタ */}
                    <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={showOnlyExtracted}
                            onChange={(e) => {
                                setShowOnlyExtracted(e.target.checked)
                                setCurrentPage(1)
                            }}
                            className="rounded"
                        />
                        抽出データありのみ
                    </label>

                    {/* 表示件数 */}
                    <select
                        value={itemsPerPage}
                        onChange={(e) => {
                            setItemsPerPage(Number(e.target.value))
                            setCurrentPage(1)
                        }}
                        className="input w-auto"
                    >
                        <option value={25}>25件</option>
                        <option value={50}>50件</option>
                        <option value={100}>100件</option>
                        <option value={500}>500件</option>
                    </select>

                    {/* エクスポート */}
                    <div className="flex gap-2">
                        <button onClick={exportToCSV} className="btn btn-secondary text-sm">
                            📥 CSV
                        </button>
                        <button onClick={exportToJSON} className="btn btn-secondary text-sm">
                            📥 JSON
                        </button>
                    </div>
                </div>

                <div className="text-sm text-slate-500 mt-2">
                    {filteredResults.length} 件中 {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredResults.length)} 件を表示
                </div>
            </div>

            {/* 結果一覧 */}
            <div className="card p-4">
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                    {paginatedResults.map((result, i) => {
                        const globalIndex = (currentPage - 1) * itemsPerPage + i
                        const isExpanded = expandedItems.has(globalIndex)

                        return (
                            <div
                                key={globalIndex}
                                className={`bg-slate-900 rounded-lg p-4 border transition-all ${result.success ? 'border-slate-700' : 'border-red-700/50'
                                    }`}
                            >
                                {/* ヘッダー */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                        <span className="text-slate-500 text-sm w-10">#{globalIndex + 1}</span>
                                        <span className={`text-xs px-2 py-0.5 rounded ${result.success
                                                ? 'bg-emerald-600 text-white'
                                                : 'bg-red-600 text-white'
                                            }`}>
                                            {result.status_code || 'ERR'}
                                        </span>
                                        <a
                                            href={result.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-400 hover:text-blue-300 font-mono text-sm truncate"
                                        >
                                            {result.url}
                                        </a>
                                    </div>
                                    <button
                                        onClick={() => toggleExpand(globalIndex)}
                                        className="text-slate-400 hover:text-white px-2"
                                    >
                                        {isExpanded ? '▲' : '▼'}
                                    </button>
                                </div>

                                {/* 抽出データサマリー */}
                                {result.extracted_data && result.extracted_data.length > 0 && (
                                    <div className="mt-2 text-sm text-slate-400">
                                        📦 抽出データ: {result.extracted_data.length}件
                                        {!isExpanded && result.extracted_data.length > 0 && (
                                            <span className="ml-2 text-slate-500">
                                                - {result.extracted_data[0].substring(0, 50)}
                                                {result.extracted_data[0].length > 50 ? '...' : ''}
                                            </span>
                                        )}
                                    </div>
                                )}

                                {/* 展開時の詳細 */}
                                {isExpanded && (
                                    <div className="mt-4 space-y-3">
                                        {/* 抽出データ一覧 */}
                                        {result.extracted_data && result.extracted_data.length > 0 && (
                                            <div>
                                                <label className="text-xs text-slate-400 uppercase tracking-wide">
                                                    抽出データ ({result.extracted_data.length}件)
                                                </label>
                                                <div className="mt-1 bg-slate-800 rounded p-3 max-h-48 overflow-y-auto">
                                                    {result.extracted_data.map((data, j) => (
                                                        <div
                                                            key={j}
                                                            className="py-1 px-2 hover:bg-slate-700 rounded text-sm text-slate-300 border-b border-slate-700 last:border-0"
                                                        >
                                                            <span className="text-slate-500 mr-2">{j + 1}.</span>
                                                            {data}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* コンテンツプレビュー */}
                                        {result.content && (
                                            <div>
                                                <label className="text-xs text-slate-400 uppercase tracking-wide">コンテンツ（先頭1000文字）</label>
                                                <div className="mt-1 bg-slate-800 rounded p-3 text-xs text-slate-400 font-mono max-h-32 overflow-y-auto whitespace-pre-wrap">
                                                    {result.content}
                                                </div>
                                            </div>
                                        )}

                                        {/* エラー */}
                                        {result.error && (
                                            <div className="text-red-400 text-sm">
                                                ❌ エラー: {result.error}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>

                {/* ページネーション */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t border-slate-700">
                        <button
                            onClick={() => setCurrentPage(1)}
                            disabled={currentPage === 1}
                            className="btn btn-secondary text-sm disabled:opacity-50"
                        >
                            ««
                        </button>
                        <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="btn btn-secondary text-sm disabled:opacity-50"
                        >
                            «
                        </button>
                        <span className="text-slate-400 px-4">
                            {currentPage} / {totalPages}
                        </span>
                        <button
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="btn btn-secondary text-sm disabled:opacity-50"
                        >
                            »
                        </button>
                        <button
                            onClick={() => setCurrentPage(totalPages)}
                            disabled={currentPage === totalPages}
                            className="btn btn-secondary text-sm disabled:opacity-50"
                        >
                            »»
                        </button>
                    </div>
                )}
            </div>

            {/* 全抽出データ一覧 */}
            {allExtractedData.length > 0 && (
                <div className="card p-4">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <span>📋</span> 全抽出データ一覧
                        <span className="text-sm font-normal bg-purple-600 px-2 py-0.5 rounded-full">
                            {allExtractedData.length}件
                        </span>
                        <button
                            onClick={copyAllExtractedData}
                            className="ml-auto btn btn-secondary text-sm flex items-center gap-1"
                        >
                            {copySuccess ? '✅ コピーしました' : '📋 すべてコピー'}
                        </button>
                    </h3>
                    <div className="bg-slate-900 rounded-lg p-4 max-h-64 overflow-y-auto font-mono text-sm">
                        {allExtractedData.slice(0, 500).map((data, i) => (
                            <div key={i} className="py-1 text-slate-300 border-b border-slate-800 last:border-0">
                                <span className="text-slate-500 mr-3">{i + 1}.</span>
                                {data}
                            </div>
                        ))}
                        {allExtractedData.length > 500 && (
                            <div className="text-slate-500 pt-2">
                                ... 他 {allExtractedData.length - 500} 件（エクスポートで全件取得可能）
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

export default ResultsViewer
