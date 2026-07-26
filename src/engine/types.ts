export type LineKind = 'empty' | 'comment' | 'assign' | 'expr' | 'mixed' | 'error'

export interface LineResult {
  raw: string
  kind: LineKind
  /** Expression actually evaluated (after preprocess), if any */
  expr?: string
  /** Variable name for assignment lines */
  name?: string
  value?: number
  error?: string
  /** Prefix `!` — show value but exclude from total */
  excludeFromTotal?: boolean
}

export interface DocResult {
  lines: LineResult[]
  /** Sum of finite line values that are not excludeFromTotal */
  total: number
  /** Sum including excluded lines (debug) */
  totalAll: number
  variables: Record<string, number>
}

export interface PaperDoc {
  id: string
  title: string
  content: string
  updatedAt: number
}

export interface PaperStore {
  version: 2
  activeId: string
  papers: PaperDoc[]
}
