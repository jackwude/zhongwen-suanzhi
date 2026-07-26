import { preprocess } from './preprocess'
import type { LineKind } from './types'

export interface ParsedLine {
  kind: LineKind
  expr?: string
  name?: string
  /** `!` prefix: exclude value from document total */
  excludeFromTotal?: boolean
}

const ASSIGN_RE =
  /^([A-Za-z_\u4e00-\u9fff][A-Za-z0-9_\u4e00-\u9fff]*)\s*=\s*(.+)$/

function looksLikePureExpr(s: string): boolean {
  if (/[\u4e00-\u9fff]/.test(s) && /\d/.test(s) && /\s/.test(s)) {
    return false
  }
  return true
}

export function extractMixedExpr(preprocessed: string): string | null {
  const s = preprocessed.trim()
  if (!s) return null

  const opRe = /[+\-*/^()?:>=<]/
  const hasOps = opRe.test(s.replace(/^-/, ''))

  const numRe = /-?\d+(?:\.\d+)?/g
  const nums = [...s.matchAll(numRe)]
  if (nums.length === 0) {
    // might be pure var / #ref / 上一行 already rewritten
    if (/#__prev__|#\d+|[A-Za-z_\u4e00-\u9fff]/.test(s) && /[+\-*/^#]/.test(s)) {
      return s
    }
    if (/^#(__prev__|\d+)$/.test(s)) return s
    if (/^[A-Za-z_\u4e00-\u9fff][A-Za-z0-9_\u4e00-\u9fff]*$/.test(s)) return s
    return null
  }

  if (!hasOps || nums.length === 1) {
    // if has ternary/满减 already expanded, hasOps true with multiple nums
    if (hasOps && s.includes('?')) {
      const firstIdx = nums[0]!.index ?? 0
      let start = firstIdx
      while (start > 0 && /\s/.test(s[start - 1]!)) start--
      if (start > 0 && s[start - 1] === '(') start--
      return s.slice(start).trim()
    }
    const last = nums[nums.length - 1]!
    return last[0]
  }

  const firstIdx = nums[0]!.index ?? 0
  let start = firstIdx
  while (start > 0 && /\s/.test(s[start - 1]!)) start--
  if (start > 0 && s[start - 1] === '(') start--

  let candidate = s.slice(start).trim()
  // keep full expression if ternary / comparison
  if (candidate.includes('?') || candidate.includes('>=')) return candidate
  candidate = candidate.replace(/[\u4e00-\u9fff].*$/u, '').trim()
  if (candidate) return candidate
  return nums[nums.length - 1]![0]
}

/** Strip leading `!` (exclude from total) and optional space */
export function stripExcludePrefix(raw: string): {
  text: string
  excludeFromTotal: boolean
} {
  const m = raw.match(/^\s*!\s*(.*)$/)
  if (m) return { text: m[1] ?? '', excludeFromTotal: true }
  return { text: raw, excludeFromTotal: false }
}

export function parseLine(raw: string): ParsedLine {
  const { text: withoutBang, excludeFromTotal } = stripExcludePrefix(raw)
  const trimmed = withoutBang.trim()
  if (!trimmed) return { kind: 'empty', excludeFromTotal }
  if (trimmed.startsWith('//')) return { kind: 'comment', excludeFromTotal }

  const assignMatch = trimmed.match(ASSIGN_RE)
  if (assignMatch) {
    const name = assignMatch[1]!
    const rhs = preprocess(assignMatch[2]!)
    if (!rhs) return { kind: 'error', excludeFromTotal }
    return { kind: 'assign', name, expr: rhs, excludeFromTotal }
  }

  const pre = preprocess(trimmed)
  if (!pre) return { kind: 'comment', excludeFromTotal }

  if (looksLikePureExpr(pre)) {
    if (/^[\u4e00-\u9fffA-Za-z_][\u4e00-\u9fffA-Za-z0-9_]*$/.test(pre) && !/\d/.test(pre)) {
      return { kind: 'expr', expr: pre, excludeFromTotal }
    }
    if (!/[\u4e00-\u9fff]/.test(pre) || /[+\-*/^=#()?:]/.test(pre) || /^[A-Za-z_]/.test(pre) || pre.includes('#__prev__')) {
      return { kind: 'expr', expr: pre, excludeFromTotal }
    }
  }

  const extracted = extractMixedExpr(pre)
  if (extracted == null) return { kind: 'comment', excludeFromTotal }
  return { kind: 'mixed', expr: extracted, excludeFromTotal }
}
