import type { PaperDoc, PaperStore } from './engine/types'
import { SAMPLE_MENU } from './fixtures/sampleMenu'

const KEY_V2 = 'suanzhi.papers.v2'
const KEY_V1 = 'suanzhi.mvp.doc.v1'

function uid(): string {
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function defaultStore(): PaperStore {
  const id = uid()
  return {
    version: 2,
    activeId: id,
    papers: [
      {
        id,
        title: '点菜示例',
        content: SAMPLE_MENU,
        updatedAt: Date.now(),
      },
    ],
  }
}

export function loadStore(): PaperStore {
  try {
    const raw = localStorage.getItem(KEY_V2)
    if (raw) {
      const parsed = JSON.parse(raw) as PaperStore
      if (parsed?.version === 2 && Array.isArray(parsed.papers) && parsed.papers.length) {
        if (!parsed.papers.some((p) => p.id === parsed.activeId)) {
          parsed.activeId = parsed.papers[0]!.id
        }
        return parsed
      }
    }
    // migrate v1 single doc
    const v1 = localStorage.getItem(KEY_V1)
    if (v1 != null && v1.length) {
      const id = uid()
      const store: PaperStore = {
        version: 2,
        activeId: id,
        papers: [
          {
            id,
            title: '未命名算纸',
            content: v1,
            updatedAt: Date.now(),
          },
        ],
      }
      saveStore(store)
      return store
    }
  } catch {
    // fallthrough
  }
  return defaultStore()
}

export function saveStore(store: PaperStore): void {
  try {
    localStorage.setItem(KEY_V2, JSON.stringify(store))
  } catch {
    // ignore
  }
}

export function createPaper(title = '未命名算纸', content = ''): PaperDoc {
  return {
    id: uid(),
    title,
    content,
    updatedAt: Date.now(),
  }
}

// legacy shims (tests / old imports)
export function loadDoc(): string | null {
  try {
    return loadStore().papers.find((p) => p.id === loadStore().activeId)?.content ?? null
  } catch {
    return null
  }
}

export function saveDoc(_text: string): void {
  // no-op legacy — use saveStore
}
