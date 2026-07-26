import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { evaluateDoc } from './engine/evaluateDoc'
import { formatNumber, formatTotal } from './engine/format'
import { loadDoc, saveDoc } from './storage'
import { SAMPLE_MENU } from './fixtures/sampleMenu'
import './App.css'

const DEBOUNCE_MS = 100
const SAVE_MS = 300

export default function App() {
  const [text, setText] = useState(() => loadDoc() ?? SAMPLE_MENU)
  const [liveText, setLiveText] = useState(text)
  const saveTimer = useRef<number | null>(null)
  const calcTimer = useRef<number | null>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const numsRef = useRef<HTMLDivElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)

  // debounced evaluate source
  useEffect(() => {
    if (calcTimer.current) window.clearTimeout(calcTimer.current)
    calcTimer.current = window.setTimeout(() => setLiveText(text), DEBOUNCE_MS)
    return () => {
      if (calcTimer.current) window.clearTimeout(calcTimer.current)
    }
  }, [text])

  // persist
  useEffect(() => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => saveDoc(text), SAVE_MS)
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current)
    }
  }, [text])

  const doc = useMemo(() => evaluateDoc(liveText), [liveText])
  const lineCount = Math.max(liveText.split('\n').length, 1)

  const onScroll = useCallback(() => {
    const ta = taRef.current
    if (!ta) return
    const top = ta.scrollTop
    if (numsRef.current) numsRef.current.scrollTop = top
    if (resultsRef.current) resultsRef.current.scrollTop = top
  }, [])

  const clearAll = () => {
    if (window.confirm('清空当前算纸？')) {
      setText('')
      setLiveText('')
    }
  }

  const loadSample = () => {
    setText(SAMPLE_MENU)
    setLiveText(SAMPLE_MENU)
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">中文算纸</div>
        <div className="actions">
          <button type="button" className="btn ghost" onClick={loadSample}>
            点菜示例
          </button>
          <button type="button" className="btn ghost" onClick={clearAll}>
            清空
          </button>
        </div>
      </header>

      <div className="sheet">
        <div className="gutter-nums" ref={numsRef} aria-hidden>
          {Array.from({ length: lineCount }, (_, i) => (
            <div
              key={i}
              className={`num ${doc.lines[i]?.kind === 'error' ? 'err' : ''}`}
            >
              {i + 1}
            </div>
          ))}
        </div>

        <textarea
          ref={taRef}
          className="editor"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onScroll={onScroll}
          spellCheck={false}
          placeholder="左边写说明和数字，右边出结果…"
          autoCapitalize="off"
          autoCorrect="off"
        />

        <div className="divider" aria-hidden />

        <div className="results" ref={resultsRef} onScroll={() => {
          /* results scroll sync optional */
        }}>
          {Array.from({ length: lineCount }, (_, i) => {
            const line = doc.lines[i]
            const hasVal = line && typeof line.value === 'number'
            const isErr = line?.kind === 'error'
            return (
              <div
                key={i}
                className={`res-line ${isErr ? 'err' : ''} ${hasVal ? 'has' : ''}`}
                title={isErr ? line?.error : line?.expr}
              >
                {isErr ? '—' : hasVal ? formatNumber(line!.value!) : ''}
              </div>
            )
          })}
        </div>
      </div>

      <footer className="bottombar">
        <div className="hint">本地自动保存 · Math.js 求值 · 禁止 eval</div>
        <div className="total-pill" title="所有有效行结果之和（含赋值行）">
          总计 <strong>{formatTotal(doc.total)}</strong>
        </div>
      </footer>
    </div>
  )
}
