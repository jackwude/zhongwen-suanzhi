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
}

export interface DocResult {
  lines: LineResult[]
  /** Sum of all finite line values (assignment rows included) */
  total: number
  variables: Record<string, number>
}
