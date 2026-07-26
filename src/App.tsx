import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { evaluateDoc, exportWithAnswers } from './engine/evaluateDoc'
import { formatNumber, formatTotal } from './engine/format'
import { createPaper, loadStore, saveStore } from './storage'
import type { PaperStore } from './engine/types'
import { SAMPLE_MENU, QUOTE_SAMPLE } from './fixtures/sampleMenu'
import { CalcEditor } from './editor/CalcEditor'
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
            <button type="button" className="btn ghost" onClick={copyExport}>
              导出
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
                  {isErr ? '—' : hasVal ? formatNumber(line!.value!) : ''}
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
    </div>
  )
}
