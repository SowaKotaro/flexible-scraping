import { useEffect, useRef, useState } from 'react'

function HtmlViewer({ html, selectedElement, onElementClick }) {
    const iframeRef = useRef(null)
    const [elementInfo, setElementInfo] = useState(null)
    const [hoveredSelector, setHoveredSelector] = useState('')
    const [selectedElements, setSelectedElements] = useState([])
    const [commonSelectors, setCommonSelectors] = useState([])

    // 共通セレクタを計算
    const calculateCommonSelectors = (elements) => {
        if (elements.length < 2) {
            setCommonSelectors([])
            return
        }

        const selectors = []

        // 共通タグを取得
        const tags = elements.map(el => el.tag)
        const commonTag = tags.every(t => t === tags[0]) ? tags[0] : null

        if (commonTag) {
            selectors.push({
                type: 'common-tag',
                label: '共通タグ',
                selector: commonTag,
                description: `すべての選択要素が <${commonTag}> タグ`,
                matchCount: elements.length
            })
        }

        // 共通クラスを取得
        const allClasses = elements.map(el => new Set(el.classes))
        const commonClasses = [...allClasses[0]].filter(cls =>
            allClasses.every(classSet => classSet.has(cls))
        )

        commonClasses.forEach(cls => {
            selectors.push({
                type: 'common-class',
                label: '共通クラス',
                selector: `.${cls}`,
                description: `すべての選択要素が .${cls} クラスを持つ`,
                matchCount: elements.length
            })
        })

        // タグ + 共通クラス
        if (commonTag && commonClasses.length > 0) {
            selectors.push({
                type: 'common-tag-class',
                label: 'タグ+共通クラス',
                selector: `${commonTag}.${commonClasses.join('.')}`,
                description: '共通のタグとクラスの組み合わせ',
                matchCount: elements.length
            })
        }

        // 共通の親要素を探す
        const parentInfos = elements.map(el => el.parentInfo).filter(Boolean)
        if (parentInfos.length === elements.length) {
            const parentTags = parentInfos.map(p => p.tag)
            const commonParentTag = parentTags.every(t => t === parentTags[0]) ? parentTags[0] : null

            if (commonParentTag && commonTag) {
                const parentClasses = parentInfos.map(p => new Set(p.classes))
                const commonParentClasses = [...parentClasses[0]].filter(cls =>
                    parentClasses.every(classSet => classSet.has(cls))
                )

                if (commonParentClasses.length > 0) {
                    selectors.push({
                        type: 'common-parent-child',
                        label: '共通親子関係',
                        selector: `${commonParentTag}.${commonParentClasses[0]} ${commonTag}`,
                        description: '共通の親要素配下の同タグ要素',
                        matchCount: elements.length
                    })
                } else {
                    selectors.push({
                        type: 'common-parent-child',
                        label: '共通親子関係',
                        selector: `${commonParentTag} ${commonTag}`,
                        description: `共通の <${commonParentTag}> 内の <${commonTag}>`,
                        matchCount: elements.length
                    })
                }
            }
        }

        // 共通data属性
        const allDataAttrs = elements.map(el => el.dataAttrs || {})
        const commonDataAttrKeys = Object.keys(allDataAttrs[0] || {}).filter(key =>
            allDataAttrs.every(attrs => key in attrs)
        )

        commonDataAttrKeys.forEach(key => {
            if (commonTag) {
                selectors.push({
                    type: 'common-data-attr',
                    label: '共通Data属性',
                    selector: `${commonTag}[${key}]`,
                    description: `${key} 属性を持つ <${commonTag}> 要素`,
                    matchCount: elements.length
                })
            }
        })

        setCommonSelectors(selectors)
    }

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
          .scraper-multi-selected {
            outline: 3px solid #f59e0b !important;
            outline-offset: 2px;
            background-color: rgba(245, 158, 11, 0.15) !important;
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

            const isMultiSelect = e.ctrlKey || e.metaKey

            // 要素情報を抽出
            const classes = Array.from(target.classList).filter(c => !c.startsWith('scraper-'))
            const tagName = target.tagName.toLowerCase()

            // 親要素情報を取得
            const parent = target.parentElement
            let parentInfo = null
            if (parent && parent.tagName.toLowerCase() !== 'body') {
                const parentClasses = Array.from(parent.classList).filter(c => !c.startsWith('scraper-'))
                parentInfo = {
                    tag: parent.tagName.toLowerCase(),
                    classes: parentClasses
                }
            }

            // data-* 属性を抽出
            const dataAttrs = {}
            for (const attr of target.attributes) {
                if (attr.name.startsWith('data-')) {
                    dataAttrs[attr.name] = attr.value
                }
            }

            const newElementInfo = {
                tag: tagName,
                id: target.id || null,
                classes: classes,
                dataAttrs: dataAttrs,
                text: target.textContent?.substring(0, 100) || '',
                selector: generateSelector(target),
                parentInfo: parentInfo,
                element: target
            }

            // 利用可能なセレクタを生成
            const availableSelectors = generateAvailableSelectors(target, tagName, classes, parentInfo)
            newElementInfo.availableSelectors = availableSelectors

            if (isMultiSelect) {
                // 複数選択モード
                setSelectedElements(prev => {
                    const alreadySelected = prev.some(el => el.element === target)
                    let newSelection

                    if (alreadySelected) {
                        // 選択解除
                        target.classList.remove('scraper-multi-selected')
                        target.classList.remove('scraper-selected')
                        newSelection = prev.filter(el => el.element !== target)
                    } else {
                        // 追加選択
                        doc.querySelectorAll('.scraper-selected').forEach(el => {
                            el.classList.remove('scraper-selected')
                            el.classList.add('scraper-multi-selected')
                        })
                        target.classList.add('scraper-multi-selected')
                        newSelection = [...prev, newElementInfo]
                    }

                    calculateCommonSelectors(newSelection)
                    return newSelection
                })
            } else {
                // 単一選択モード - 前の選択をすべて解除
                doc.querySelectorAll('.scraper-selected, .scraper-multi-selected').forEach(el => {
                    el.classList.remove('scraper-selected')
                    el.classList.remove('scraper-multi-selected')
                })

                target.classList.add('scraper-selected')
                setSelectedElements([newElementInfo])
                setCommonSelectors([])
                setElementInfo(newElementInfo)
                onElementClick(newElementInfo)
            }
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

    // 利用可能なセレクタを生成
    const generateAvailableSelectors = (target, tagName, classes, parentInfo) => {
        const availableSelectors = []

        availableSelectors.push({
            type: 'tag',
            label: 'タグ',
            selector: tagName,
            description: `すべての <${tagName}> 要素`
        })

        if (target.id) {
            availableSelectors.push({
                type: 'id',
                label: 'ID',
                selector: `#${target.id}`,
                description: 'この要素のみ'
            })
        }

        if (classes.length > 0) {
            classes.forEach(cls => {
                availableSelectors.push({
                    type: 'class',
                    label: 'クラス',
                    selector: `.${cls}`,
                    description: `すべての .${cls} 要素`
                })
            })
            availableSelectors.push({
                type: 'tag-class',
                label: 'タグ+クラス',
                selector: `${tagName}.${classes.join('.')}`,
                description: '同じタグ・クラスの要素'
            })
        }

        if (parentInfo) {
            if (parentInfo.classes.length > 0) {
                availableSelectors.push({
                    type: 'parent-child',
                    label: '親子',
                    selector: `${parentInfo.tag}.${parentInfo.classes[0]} ${tagName}`,
                    description: '親要素配下の同タグ要素'
                })
            } else {
                availableSelectors.push({
                    type: 'parent-child',
                    label: '親子',
                    selector: `${parentInfo.tag} ${tagName}`,
                    description: `すべての <${parentInfo.tag}> 内の <${tagName}>`
                })
            }
        }

        return availableSelectors
    }

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

    // 選択をクリア
    const clearSelection = () => {
        if (iframeRef.current) {
            const doc = iframeRef.current.contentDocument || iframeRef.current.contentWindow.document
            doc.querySelectorAll('.scraper-selected, .scraper-multi-selected').forEach(el => {
                el.classList.remove('scraper-selected')
                el.classList.remove('scraper-multi-selected')
            })
        }
        setSelectedElements([])
        setCommonSelectors([])
        setElementInfo(null)
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
            <div className="col-span-2 card p-4 h-[820px] flex flex-col">
                <div className="flex items-center justify-between mb-4 h-[40px] flex-shrink-0">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <span>🖼️</span> HTMLプレビュー
                    </h2>
                    <div className="flex items-center gap-3">
                        <span className={`text-sm px-3 py-1 rounded-full min-w-[100px] text-center ${
                            selectedElements.length > 1 
                                ? 'text-amber-400 bg-amber-900/30' 
                                : 'text-transparent bg-transparent'
                        }`}>
                            {selectedElements.length > 1 ? `${selectedElements.length}個選択中` : '　'}
                        </span>
                        <div className="text-sm text-slate-400 bg-slate-900 px-3 py-1 rounded-full font-mono w-[180px] text-center truncate">
                            {hoveredSelector || '　'}
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-lg overflow-hidden flex-1">
                    <iframe
                        ref={iframeRef}
                        title="HTML Preview"
                        className="w-full h-full border-0"
                        sandbox="allow-same-origin"
                    />
                </div>
                <p className="text-xs text-slate-500 mt-2 flex-shrink-0">
                    💡 クリックで単一選択 / Ctrl(⌘)+クリックで複数選択 → 共通セレクタを自動検出
                </p>
            </div>

            {/* 要素情報パネル */}
            <div className="card p-4 h-[820px] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <span>🔍</span> 要素情報
                    </h2>
                    {selectedElements.length > 0 && (
                        <button
                            onClick={clearSelection}
                            className="text-xs text-slate-400 hover:text-white bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded"
                        >
                            選択クリア
                        </button>
                    )}
                </div>

                {/* 複数選択時の共通セレクタ */}
                {selectedElements.length > 1 && commonSelectors.length > 0 && (
                    <div className="mb-6 p-4 bg-amber-900/20 border border-amber-700 rounded-lg">
                        <label className="text-xs text-amber-400 uppercase tracking-wide font-bold">
                            🎯 共通セレクタ（{selectedElements.length}要素から検出）
                        </label>
                        <p className="text-xs text-slate-400 mt-1 mb-3">
                            選択した要素に共通するセレクタです
                        </p>
                        <div className="space-y-2">
                            {commonSelectors.map((sel, i) => (
                                <button
                                    key={i}
                                    onClick={() => {
                                        const updatedInfo = {
                                            ...elementInfo,
                                            selector: sel.selector,
                                            isCommonSelector: true
                                        }
                                        setElementInfo(updatedInfo)
                                        onElementClick(updatedInfo)
                                    }}
                                    className={`w-full text-left font-mono text-sm px-3 py-2 rounded border transition-all ${elementInfo?.selector === sel.selector
                                        ? 'bg-amber-600/30 border-amber-500 text-amber-300'
                                        : 'bg-slate-900 border-slate-700 hover:border-amber-500 text-slate-300'
                                        }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="text-amber-400">{sel.selector}</span>
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

                {/* 選択中の要素一覧（複数選択時） */}
                {selectedElements.length > 1 && (
                    <div className="mb-6">
                        <label className="text-xs text-slate-400 uppercase tracking-wide">選択中の要素</label>
                        <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                            {selectedElements.map((el, i) => (
                                <div key={i} className="text-xs bg-slate-900 px-2 py-1 rounded flex items-center gap-2">
                                    <span className="text-amber-400">{i + 1}.</span>
                                    <span className="text-blue-400">&lt;{el.tag}&gt;</span>
                                    {el.classes.length > 0 && (
                                        <span className="text-purple-400">.{el.classes[0]}</span>
                                    )}
                                    <span className="text-slate-500 truncate flex-1">{el.text?.substring(0, 30)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

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
                        {elementInfo.classes && elementInfo.classes.length > 0 && (
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
                        {elementInfo.dataAttrs && Object.keys(elementInfo.dataAttrs).length > 0 && (
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

                        {/* 利用可能なセレクタ（単一選択時のみ表示） */}
                        {selectedElements.length <= 1 && elementInfo.availableSelectors && elementInfo.availableSelectors.length > 0 && (
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
                        <p className="text-xs mt-2">Ctrl+クリックで複数選択</p>
                    </div>
                )}
            </div>
        </div>
    )
}

export default HtmlViewer
