import { useEffect, useRef, useState } from 'react'

function HtmlViewer({ html, selectedElement, onElementClick }) {
    const iframeRef = useRef(null)
    const [elementInfo, setElementInfo] = useState(null)
    const [hoveredSelector, setHoveredSelector] = useState('')

    useEffect(() => {
        if (!html || !iframeRef.current) return

        const iframe = iframeRef.current
        const doc = iframe.contentDocument || iframe.contentWindow.document

        // iframeにHTMLを書き込む
        doc.open()
        doc.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          * { cursor: pointer !important; }
          .scraper-highlight {
            outline: 3px solid #3b82f6 !important;
            outline-offset: 2px;
            background-color: rgba(59, 130, 246, 0.1) !important;
          }
          .scraper-selected {
            outline: 3px solid #10b981 !important;
            outline-offset: 2px;
            background-color: rgba(16, 185, 129, 0.1) !important;
          }
          body {
            font-family: system-ui, -apple-system, sans-serif;
            padding: 16px;
            background: #fff;
            color: #1e293b;
          }
        </style>
      </head>
      <body>${html}</body>
      </html>
    `)
        doc.close()

        // クリックイベントの設定
        const handleClick = (e) => {
            e.preventDefault()
            e.stopPropagation()

            const target = e.target
            if (target.tagName.toLowerCase() === 'html' || target.tagName.toLowerCase() === 'body') return

            // 前の選択を解除
            doc.querySelectorAll('.scraper-selected').forEach(el => {
                el.classList.remove('scraper-selected')
            })

            // 新しい選択
            target.classList.add('scraper-selected')

            // 要素情報を抽出
            const classes = Array.from(target.classList).filter(c => !c.startsWith('scraper-'))
            const tagName = target.tagName.toLowerCase()

            // 利用可能なセレクタを生成
            const availableSelectors = []

            // タグ名のみ（常に追加）
            availableSelectors.push({
                type: 'tag',
                label: `タグ`,
                selector: tagName,
                description: `すべての <${tagName}> 要素`
            })

            // IDがあれば追加
            if (target.id) {
                availableSelectors.push({
                    type: 'id',
                    label: 'ID',
                    selector: `#${target.id}`,
                    description: 'この要素のみ'
                })
            }

            // クラスがあれば追加
            if (classes.length > 0) {
                // 各クラス単独
                classes.forEach(cls => {
                    availableSelectors.push({
                        type: 'class',
                        label: `クラス`,
                        selector: `.${cls}`,
                        description: `すべての .${cls} 要素`
                    })
                })
                // タグ + クラス
                availableSelectors.push({
                    type: 'tag-class',
                    label: 'タグ+クラス',
                    selector: `${tagName}.${classes.join('.')}`,
                    description: '同じタグ・クラスの要素'
                })
            }

            // 親要素を含むセレクタ（要素のコンテキスト）
            const parent = target.parentElement
            if (parent && parent.tagName.toLowerCase() !== 'body') {
                const parentTag = parent.tagName.toLowerCase()
                const parentClasses = Array.from(parent.classList).filter(c => !c.startsWith('scraper-'))

                if (parentClasses.length > 0) {
                    availableSelectors.push({
                        type: 'parent-child',
                        label: '親子',
                        selector: `${parentTag}.${parentClasses[0]} ${tagName}`,
                        description: '親要素配下の同タグ要素'
                    })
                } else {
                    availableSelectors.push({
                        type: 'parent-child',
                        label: '親子',
                        selector: `${parentTag} ${tagName}`,
                        description: `すべての <${parentTag}> 内の <${tagName}>`
                    })
                }
            }

            const info = {
                tag: tagName,
                id: target.id || null,
                classes: classes,
                dataAttrs: {},
                text: target.textContent?.substring(0, 100) || '',
                selector: generateSelector(target),
                availableSelectors: availableSelectors
            }

            // data-* 属性を抽出
            for (const attr of target.attributes) {
                if (attr.name.startsWith('data-')) {
                    info.dataAttrs[attr.name] = attr.value
                }
            }

            setElementInfo(info)
            onElementClick(info)
        }

        // ホバーイベントの設定
        const handleMouseOver = (e) => {
            const target = e.target
            if (target.tagName.toLowerCase() === 'html' || target.tagName.toLowerCase() === 'body') return
            target.classList.add('scraper-highlight')
            setHoveredSelector(generateSelector(target))
        }

        const handleMouseOut = (e) => {
            e.target.classList.remove('scraper-highlight')
            setHoveredSelector('')
        }

        doc.body.addEventListener('click', handleClick)
        doc.body.addEventListener('mouseover', handleMouseOver)
        doc.body.addEventListener('mouseout', handleMouseOut)

        return () => {
            doc.body.removeEventListener('click', handleClick)
            doc.body.removeEventListener('mouseover', handleMouseOver)
            doc.body.removeEventListener('mouseout', handleMouseOut)
        }
    }, [html, onElementClick])

    // CSSセレクタを生成
    const generateSelector = (element) => {
        if (element.id) {
            return `#${element.id}`
        }

        const classes = Array.from(element.classList).filter(c => !c.startsWith('scraper-'))
        if (classes.length > 0) {
            return `${element.tagName.toLowerCase()}.${classes.join('.')}`
        }

        return element.tagName.toLowerCase()
    }

    if (!html) {
        return (
            <div className="card p-12 text-center">
                <div className="text-6xl mb-4">👁️</div>
                <h2 className="text-xl font-bold text-white mb-2">HTMLビューア</h2>
                <p className="text-slate-400">
                    まず「HTML入力」タブでHTMLソースを入力してレンダリングしてください
                </p>
            </div>
        )
    }

    return (
        <div className="grid grid-cols-3 gap-6">
            {/* HTMLプレビュー */}
            <div className="col-span-2 card p-4">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <span>🖼️</span> HTMLプレビュー
                    </h2>
                    {hoveredSelector && (
                        <div className="text-sm text-slate-400 bg-slate-900 px-3 py-1 rounded-full font-mono">
                            {hoveredSelector}
                        </div>
                    )}
                </div>
                <div className="bg-white rounded-lg overflow-hidden">
                    <iframe
                        ref={iframeRef}
                        title="HTML Preview"
                        className="w-full h-[500px] border-0"
                        sandbox="allow-same-origin"
                    />
                </div>
                <p className="text-xs text-slate-500 mt-2">
                    💡 要素をクリックすると、右側に属性情報が表示されます
                </p>
            </div>

            {/* 要素情報パネル */}
            <div className="card p-4">
                <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <span>🔍</span> 要素情報
                </h2>

                {elementInfo ? (
                    <div className="space-y-4">
                        {/* タグ名 */}
                        <div>
                            <label className="text-xs text-slate-400 uppercase tracking-wide">タグ</label>
                            <div className="mt-1 font-mono text-blue-400 text-lg">&lt;{elementInfo.tag}&gt;</div>
                        </div>

                        {/* ID */}
                        {elementInfo.id && (
                            <div>
                                <label className="text-xs text-slate-400 uppercase tracking-wide">ID</label>
                                <div className="mt-1 font-mono text-emerald-400 bg-slate-900 px-3 py-2 rounded">
                                    #{elementInfo.id}
                                </div>
                            </div>
                        )}

                        {/* クラス */}
                        {elementInfo.classes.length > 0 && (
                            <div>
                                <label className="text-xs text-slate-400 uppercase tracking-wide">Class</label>
                                <div className="mt-1 flex flex-wrap gap-2">
                                    {elementInfo.classes.map((cls, i) => (
                                        <span key={i} className="font-mono text-purple-400 bg-slate-900 px-2 py-1 rounded text-sm">
                                            .{cls}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* data-* 属性 */}
                        {Object.keys(elementInfo.dataAttrs).length > 0 && (
                            <div>
                                <label className="text-xs text-slate-400 uppercase tracking-wide">Data属性</label>
                                <div className="mt-1 space-y-2">
                                    {Object.entries(elementInfo.dataAttrs).map(([key, value]) => (
                                        <div key={key} className="font-mono text-sm bg-slate-900 px-3 py-2 rounded">
                                            <span className="text-amber-400">{key}</span>
                                            <span className="text-slate-500">=</span>
                                            <span className="text-slate-300">"{value}"</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* 利用可能なセレクタ */}
                        {elementInfo.availableSelectors && elementInfo.availableSelectors.length > 0 && (
                            <div>
                                <label className="text-xs text-slate-400 uppercase tracking-wide">利用可能なセレクタ</label>
                                <p className="text-xs text-slate-500 mt-1 mb-2">
                                    クリックで選択 → スクレイピングで使用
                                </p>
                                <div className="mt-1 space-y-2">
                                    {elementInfo.availableSelectors.map((sel, i) => (
                                        <button
                                            key={i}
                                            onClick={() => {
                                                const updatedInfo = { ...elementInfo, selector: sel.selector }
                                                setElementInfo(updatedInfo)
                                                onElementClick(updatedInfo)
                                            }}
                                            className={`w-full text-left font-mono text-sm px-3 py-2 rounded border transition-all ${elementInfo.selector === sel.selector
                                                    ? 'bg-blue-600/30 border-blue-500 text-blue-300'
                                                    : 'bg-slate-900 border-slate-700 hover:border-blue-500 text-slate-300'
                                                }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <span className="text-cyan-400">{sel.selector}</span>
                                                <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded">
                                                    {sel.label}
                                                </span>
                                            </div>
                                            <div className="text-xs text-slate-500 mt-1">
                                                {sel.description}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* 選択中のセレクタ */}
                        <div className="pt-2 border-t border-slate-700">
                            <label className="text-xs text-slate-400 uppercase tracking-wide">選択中のセレクタ</label>
                            <div className="mt-1 font-mono text-cyan-400 bg-blue-900/30 border border-blue-500 px-3 py-2 rounded break-all">
                                {elementInfo.selector}
                            </div>
                        </div>

                        {/* テキスト内容 */}
                        {elementInfo.text && (
                            <div>
                                <label className="text-xs text-slate-400 uppercase tracking-wide">テキスト</label>
                                <div className="mt-1 text-slate-300 bg-slate-900 px-3 py-2 rounded text-sm max-h-24 overflow-y-auto">
                                    {elementInfo.text}
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="text-center py-8 text-slate-500">
                        <div className="text-4xl mb-2">👆</div>
                        <p>要素をクリックして選択</p>
                    </div>
                )}
            </div>
        </div>
    )
}

export default HtmlViewer
