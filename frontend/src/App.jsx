import { useState, useRef, useEffect } from 'react'
import HtmlInput from './components/HtmlInput'
import HtmlViewer from './components/HtmlViewer'
import UrlGenerator from './components/UrlGenerator'
import ScrapingPanel from './components/ScrapingPanel'
import ResultsViewer from './components/ResultsViewer'

function App() {
  const [activeTab, setActiveTab] = useState('html-input')
  const [parsedHtml, setParsedHtml] = useState('')
  const [selectedElement, setSelectedElement] = useState(null)
  const [generatedUrls, setGeneratedUrls] = useState([])
  const [scrapingResults, setScrapingResults] = useState([])

  const tabs = [
    { id: 'html-input', label: 'HTML入力', icon: '📝' },
    { id: 'html-viewer', label: 'HTMLビューア', icon: '👁️' },
    { id: 'url-generator', label: 'URL生成', icon: '🔗' },
    { id: 'scraping', label: 'スクレイピング', icon: '🕷️' },
    { id: 'results', label: '結果一覧', icon: '📊', badge: scrapingResults.length || null },
  ]

  const handleHtmlParsed = (html) => {
    setParsedHtml(html)
    setActiveTab('html-viewer')
  }

  const handleElementClick = (elementInfo) => {
    setSelectedElement(elementInfo)
  }

  const handleUrlsGenerated = (urls) => {
    setGeneratedUrls(urls)
    setActiveTab('scraping')
  }

  const handleScrapingComplete = (results) => {
    setScrapingResults(results)
  }

  const handleViewResults = () => {
    setActiveTab('results')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* ヘッダー */}
      <header className="bg-slate-800/80 backdrop-blur-sm border-b border-slate-700/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🕸️</span>
              <div>
                <h1 className="text-xl font-bold text-white">Webスクレイピング支援ツール</h1>
                <p className="text-xs text-slate-400">HTML解析・URL生成・データ抽出</p>
              </div>
            </div>
            <div className="alert alert-warning text-sm py-2 px-3 flex items-center gap-2">
              <span>⚠️</span>
              <span>スクレイピング前に robots.txt を確認してください</span>
            </div>
          </div>
        </div>
      </header>

      {/* タブナビゲーション */}
      <nav className="bg-slate-800/50 border-b border-slate-700/50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`tab ${activeTab === tab.id ? 'active' : ''} relative`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
                {tab.badge && (
                  <span className="ml-2 bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* メインコンテンツ */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {activeTab === 'html-input' && (
          <HtmlInput onHtmlParsed={handleHtmlParsed} />
        )}
        {activeTab === 'html-viewer' && (
          <HtmlViewer
            html={parsedHtml}
            selectedElement={selectedElement}
            onElementClick={handleElementClick}
          />
        )}
        {activeTab === 'url-generator' && (
          <UrlGenerator onUrlsGenerated={handleUrlsGenerated} />
        )}
        {activeTab === 'scraping' && (
          <ScrapingPanel
            urls={generatedUrls}
            selector={selectedElement?.selector}
            onScrapingComplete={handleScrapingComplete}
            onViewResults={handleViewResults}
          />
        )}
        {activeTab === 'results' && (
          <ResultsViewer results={scrapingResults} />
        )}
      </main>

      {/* フッター */}
      <footer className="bg-slate-800/50 border-t border-slate-700/50 py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-6 text-center text-slate-500 text-sm">
          <p>🔒 教育・調査目的専用 | robots.txt のルールを遵守してください</p>
        </div>
      </footer>
    </div>
  )
}

export default App
