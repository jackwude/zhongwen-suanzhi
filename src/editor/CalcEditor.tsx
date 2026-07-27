import { useEffect, useRef } from 'react'
import { EditorState, RangeSetBuilder } from '@codemirror/state'
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
  Decoration,
  ViewPlugin,
  type ViewUpdate,
  type DecorationSet,
} from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { search, searchKeymap } from '@codemirror/search'

const numberMark = Decoration.mark({ class: 'cm-suanzhi-number' })
const bangMark = Decoration.mark({ class: 'cm-suanzhi-bang' })
const commentMark = Decoration.mark({ class: 'cm-suanzhi-comment' })

type Mark = typeof numberMark

function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Mark>()
  const numRe = /-?\d+(?:\.\d+)?/g
  for (const { from, to } of view.visibleRanges) {
    const text = view.state.doc.sliceString(from, to)
    let pos = from
    for (const line of text.split('\n')) {
      const lineStart = pos
      if (line.trimStart().startsWith('//')) {
        builder.add(lineStart, lineStart + line.length, commentMark)
      } else {
        const bang = line.match(/^(\s*!)/)
        if (bang) {
          const bangToken = bang[1]!
          const bangCharAt = bangToken.lastIndexOf('!')
          builder.add(lineStart + bangCharAt, lineStart + bangCharAt + 1, bangMark)
        }
        numRe.lastIndex = 0
        let m: RegExpExecArray | null
        while ((m = numRe.exec(line))) {
          builder.add(lineStart + m.index, lineStart + m.index + m[0].length, numberMark)
        }
      }
      pos += line.length + 1
    }
  }
  return builder.finish()
}

const highlightPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet
    constructor(view: EditorView) {
      this.decorations = buildDecorations(view)
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildDecorations(update.view)
      }
    }
  },
  { decorations: (v) => v.decorations },
)

const theme = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: '16px',
  },
  '.cm-scroller': {
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif",
    lineHeight: '28px',
    overflow: 'auto',
  },
  '.cm-content': {
    padding: '12px 8px',
    caretColor: '#007aff',
  },
  '.cm-gutters': {
    background: 'transparent',
    border: 'none',
    color: '#c7c7cc',
    fontSize: '13px',
  },
  '.cm-activeLineGutter': {
    background: 'transparent',
    color: '#8e8e93',
  },
  '.cm-activeLine': {
    background: 'rgba(0,122,255,0.04)',
  },
  '.cm-suanzhi-number': {
    color: '#007aff',
    fontWeight: '500',
  },
  '.cm-suanzhi-bang': {
    color: '#ff9500',
    fontWeight: '700',
  },
  '.cm-suanzhi-comment': {
    color: '#8e8e93',
  },
})

export interface CalcEditorProps {
  value: string
  onChange: (v: string) => void
  onScrollTop?: (top: number) => void
}

export function CalcEditor({ value, onChange, onScrollTop }: CalcEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  const onScrollRef = useRef(onScrollTop)
  onChangeRef.current = onChange
  onScrollRef.current = onScrollTop

  useEffect(() => {
    if (!hostRef.current) return

    const startState = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        history(),
        search(),
        keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),
        highlightPlugin,
        theme,
        EditorView.lineWrapping,
        EditorView.updateListener.of((u) => {
          if (u.docChanged) {
            onChangeRef.current(u.state.doc.toString())
          }
        }),
        EditorView.domEventHandlers({
          scroll: (_e, view) => {
            onScrollRef.current?.(view.scrollDOM.scrollTop)
            return false
          },
        }),
      ],
    })

    const view = new EditorView({
      state: startState,
      parent: hostRef.current,
    })
    viewRef.current = view

    return () => {
      view.destroy()
      viewRef.current = null
    }
    // mount once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const cur = view.state.doc.toString()
    if (cur !== value) {
      view.dispatch({
        changes: { from: 0, to: cur.length, insert: value },
      })
    }
  }, [value])

  return <div className="cm-host" ref={hostRef} />
}
