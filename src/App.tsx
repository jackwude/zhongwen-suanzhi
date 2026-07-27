import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { evaluateDoc, exportWithAnswers } from './engine/evaluateDoc'
import { formatNumber, formatTotal } from './engine/format'
import { createPaper, loadStore, saveStore } from './storage'
import type { PaperStore } from './engine/types'
import { SAMPLE_MENU, QUOTE_SAMPLE } from './fixtures/sampleMenu'
import { CalcEditor } from './editor/CalcEditor'
import html2canvas from 'html2canvas'
import './App.css'

const DEBOUNCE_MS = 100
const SAVE_MS = 300

export default function App() {
  const [store, setStore] = useState<PaperStore>(() => loadStore())
  const active = store.papers.find((p) => p.id === store.activeId) ?? store.papers[0]!
  const [text, setText] = useState(active.content)
  const [title, setTitle] = useState(active.title)
  const [liveText, setLiveText] = useState(active.content)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [helpOpen, setHelpOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const saveTimer = useRef<number | null>(null)
  const calcTimer = useRef<number | null>(null)
  const resultsRef = useRef<HTMLDivElement>(null)
  const skipPersist = useRef(false)

  // switch paper
  const switchPaper = useCallback(
    (id: string) => {
      setStore((prev) => {
        // flush current into store first
        const papers = prev.papers.map((p) =>
          p.id === prev.activeId
            ? { ...p, content: text, title, updatedAt: Date.now() }
            : p,
        )
        const next = { ...prev, papers, activeId: id }
        const t = papers.find((p) => p.id === id)
        skipPersist.current = true
        setText(t?.content ?? '')
        setTitle(t?.title ?? '未命名')
        setLiveText(t?.content ?? '')
        return next
      })
    },
    [text, title],
  )

  useEffect(() => {
    if (calcTimer.current) window.clearTimeout(calcTimer.current)
    calcTimer.current = window.setTimeout(() => setLiveText(text), DEBOUNCE_MS)
    return () => {
      if (calcTimer.current) window.clearTimeout(calcTimer.current)
    }
  }, [text])

  // persist store
  useEffect(() => {
    if (skipPersist.current) {
      skipPersist.current = false
      saveStore(store)
      return
    }
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => {
      setStore((prev) => {
        const papers = prev.papers.map((p) =>
          p.id === prev.activeId
            ? { ...p, content: text, title, updatedAt: Date.now() }
            : p,
        )
        const next = { ...prev, papers }
        saveStore(next)
        return next
      })
    }, SAVE_MS)
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current)
    }
  }, [text, title, store.activeId])

  const doc = useMemo(() => evaluateDoc(liveText), [liveText])
  const lineCount = Math.max(liveText.split('\n').length, 1)

  const onScrollTop = useCallback((top: number) => {
    if (resultsRef.current) resultsRef.current.scrollTop = top
  }, [])

  const showToast = (msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 1800)
  }

  const newPaper = () => {
    const p = createPaper('未命名算纸', '')
    setStore((prev) => {
      const flushed = prev.papers.map((x) =>
        x.id === prev.activeId ? { ...x, content: text, title, updatedAt: Date.now() } : x,
      )
      const next = {
        ...prev,
        papers: [p, ...flushed],
        activeId: p.id,
      }
      skipPersist.current = true
      setText('')
      setTitle(p.title)
      setLiveText('')
      saveStore(next)
      return next
    })
  }

  const deletePaper = () => {
    if (store.papers.length <= 1) {
      showToast('至少保留一张纸')
      return
    }
    if (!window.confirm(`删除「${title}」？`)) return
    setStore((prev) => {
      const papers = prev.papers.filter((p) => p.id !== prev.activeId)
      const activeId = papers[0]!.id
      const t = papers[0]!
      skipPersist.current = true
      setText(t.content)
      setTitle(t.title)
      setLiveText(t.content)
      const next = { ...prev, papers, activeId }
      saveStore(next)
      return next
    })
  }

  const clearAll = () => {
    if (window.confirm('清空当前算纸内容？')) {
      setText('')
      setLiveText('')
    }
  }

  const loadSample = (kind: 'menu' | 'quote') => {
    const c = kind === 'menu' ? SAMPLE_MENU : QUOTE_SAMPLE
    setText(c)
    setLiveText(c)
    if (kind === 'menu') setTitle('点菜示例')
    else setTitle('报价示例')
  }

  const copyExport = async () => {
    const body = exportWithAnswers(text)
    try {
      await navigator.clipboard.writeText(body)
      showToast('已复制带结果文本')
    } catch {
      // fallback
      window.prompt('复制以下内容', body)
    }
  }

  const exportImage = useCallback(async () => {
    const sheet = document.querySelector('.sheet') as HTMLElement
    if (!sheet) return
    
    try {
      const canvas = await html2canvas(sheet, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
      })
      
      canvas.toBlob((blob) => {
        if (!blob) return
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${title || '算纸'}-${new Date().toISOString().slice(0, 10)}.png`
        a.click()
        URL.revokeObjectURL(url)
      }, 'image/png')
    } catch (err) {
      console.error('导出图片失败:', err)
      alert('导出图片失败，请重试')
    }
  }, [title])

  return (
    <div className={`app ${sidebarOpen ? 'with-side' : ''}`}>
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="side-head">
          <span>算纸</span>
          <button type="button" className="btn ghost sm" onClick={newPaper}>
            + 新建
          </button>
        </div>
        <ul className="paper-list">
          {store.papers
            .slice()
            .sort((a, b) => b.updatedAt - a.updatedAt)
            .map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className={`paper-item ${p.id === store.activeId ? 'active' : ''}`}
                  onClick={() => switchPaper(p.id)}
                >
                  <div className="paper-title">{p.title || '未命名'}</div>
                  <div className="paper-meta">
                    {new Date(p.updatedAt).toLocaleString('zh-CN', {
                      month: 'numeric',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </button>
              </li>
            ))}
        </ul>
        <div className="side-foot">
          <div className="side-tip">
            行首 <code>!</code> 不计入总计
            <br />
            支持 满300减50 / 打八折 / 3斤
          </div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="left-tools">
            <button
              type="button"
              className="btn ghost sm"
              onClick={() => setSidebarOpen((v) => !v)}
              title="侧边栏"
            >
              {sidebarOpen ? '‹' : '›'} 纸
            </button>
            <input
              className="title-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="标题"
            />
          </div>
          <div className="actions">
            <button type="button" className="btn ghost" onClick={() => loadSample('menu')}>
              点菜
            </button>
            <button type="button" className="btn ghost" onClick={() => loadSample('quote')}>
              报价
            </button>
            <button type="button" className="btn ghost" onClick={copyExport} title="复制文本">
              导出文本
            </button>
            <button type="button" className="btn ghost" onClick={exportImage} title="导出为图片">
              导出图片
            </button>
            <button type="button" className="btn ghost" onClick={() => setHelpOpen(true)} title="帮助">
              ?
            </button>
            <button type="button" className="btn ghost" onClick={clearAll}>
              清空
            </button>
            <button type="button" className="btn ghost danger" onClick={deletePaper}>
              删除
            </button>
          </div>
        </header>

        <div className="sheet">
          <div className="editor-pane">
            <CalcEditor value={text} onChange={setText} onScrollTop={onScrollTop} />
          </div>
          <div className="divider" aria-hidden />
          <div className="results" ref={resultsRef}>
            {Array.from({ length: lineCount }, (_, i) => {
              const line = doc.lines[i]
              const hasVal = line && typeof line.value === 'number'
              const isErr = line?.kind === 'error'
              const excl = line?.excludeFromTotal
              return (
                <div
                  key={i}
                  className={`res-line ${isErr ? 'err' : ''} ${hasVal ? 'has' : ''} ${excl ? 'excl' : ''}`}
                  title={
                    isErr
                      ? line?.error
                      : line?.expr
                        ? `${line.expr}${excl ? '（不计总计）' : ''}`
                        : undefined
                  }
                >
                  {isErr ? '—' : hasVal ? formatNumber(line!.value!, line!.isDate) : ''}
                  {excl && hasVal ? <span className="excl-dot">·</span> : null}
                </div>
              )
            })}
          </div>
        </div>

        <footer className="bottombar">
          <div className="hint">
            本地多纸保存 · Math.js · 数字高亮 · 禁止 eval
            {toast ? <span className="toast"> · {toast}</span> : null}
          </div>
          <div
            className="total-pill"
            title="合计（已排除行首 ! 的行）"
          >
            总计 <strong>{formatTotal(doc.total)}</strong>
          </div>
        </footer>
      </div>

      {helpOpen && (
        <div className="modal-overlay" onClick={() => setHelpOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>数学函数帮助</h2>
              <button type="button" className="btn ghost" onClick={() => setHelpOpen(false)}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <h3>基础运算</h3>
              <ul>
                <li><code>sqrt(16)</code> → 4（平方根）</li>
                <li><code>abs(-5)</code> → 5（绝对值）</li>
                <li><code>log(100)</code> → 2（对数）</li>
                <li><code>pow(2, 3)</code> → 8（幂运算）</li>
              </ul>

              <h3>三角函数</h3>
              <ul>
                <li><code>sin(30)</code> → 0.5（正弦）</li>
                <li><code>cos(60)</code> → 0.5（余弦）</li>
                <li><code>tan(45)</code> → 1（正切）</li>
              </ul>

              <h3>日期计算</h3>
              <ul>
                <li><code>今天</code> → 2026-07-27</li>
                <li><code>明天</code> → 2026-07-28</li>
                <li><code>今天 + 30天</code> → 2026-08-26</li>
                <li><code>2026-08-01 - 今天</code> → 5（天数差）</li>
                <li><code>下周五</code> → 2026-07-31</li>
              </ul>

              <h3>中文语法</h3>
              <ul>
                <li><code>100 打八折</code> → 80</li>
                <li><code>500 满300减50</code> → 450</li>
                <li><code>3斤</code> → 1500（克）</li>
                <li><code>2亩</code> → 1333.34（平方米）</li>
                <li><code>100公里</code> → 100000（米）</li>
              </ul>

              <h3>变量与引用</h3>
              <ul>
                <li><code>单价 = 89</code> → 赋值</li>
                <li><code>数量 = 3</code> → 赋值</li>
                <li><code>总价 = 单价 * 数量</code> → 267</li>
                <li><code>#1 + #2</code> → 引用第1、2行结果</li>
                <li><code>上一行 * 1.1</code> → 引用上一行</li>
              </ul>

              <h3>百分比</h3>
              <ul>
                <li><code>50 + 10%</code> → 55（增加10%）</li>
                <li><code>50 * 10%</code> → 5（取10%）</li>
                <li><code>50 - 10%</code> → 45（减少10%）</li>
              </ul>

              <h3>排除总计</h3>
              <ul>
                <li><code>! 单价 = 89</code> → 不计入总计</li>
                <li>行首加 <code>!</code> 可排除该行</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
