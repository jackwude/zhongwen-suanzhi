import { preprocess } from './preprocess'
import type { LineKind } from './types'

export interface ParsedLine {
  kind: LineKind
  /** expression to evaluate (preprocessed) */
  expr?: string
  name?: string
}

const ASSIGN_RE =
  /^([A-Za-z_\u4e00-\u9fff][A-Za-z0-9_\u4e00-\u9fff]*)\s*=\s*(.+)$/

/** Looks like a pure math expression (no CJK letters as labels) */
function looksLikePureExpr(s: string): boolean {
  // allow identifiers (vars), numbers, ops, #refs, parens, spaces, dots
  if (/[\u4e00-\u9fff]/.test(s)) {
    // Chinese only OK if it's part of var names already assigned — still try as expr
    // Pure expr path: if starts with digit/(/var/# it's expr candidate
  }
  // Reject if there is a CJK run that is NOT a valid identifier-only string
  // Heuristic: if contains CJK and also a number separated by spaces from Chinese label
  if (/[\u4e00-\u9fff]/.test(s) && /\d/.test(s) && /\s/.test(s)) {
    // e.g. 蒸蒸日上 128
    return false
  }
  // Chinese-only identifier without ops might be var ref
  return true
}

/**
 * Extract computable fragment from mixed text (Soulver-style).
 * Rules (MVP locked):
 * - one number only → that number
 * - multiple numbers, no operators → last number
 * - has operators → try substring from first number/paren to end; else last number
 */
export function extractMixedExpr(preprocessed: string): string | null {
  const s = preprocessed.trim()
  if (!s) return null

  const opRe = /[+\-*/^()]/
  const hasOps = opRe.test(s.replace(/^-/, '')) // leading minus on number ok

  const numRe = /-?\d+(?:\.\d+)?/g
  const nums = [...s.matchAll(numRe)]
  if (nums.length === 0) return null

  if (!hasOps || nums.length === 1) {
    // last number
    const last = nums[nums.length - 1]
    return last[0]
  }

  // has operators: from first number (or leading paren before it) to end
  const firstIdx = nums[0].index ?? 0
  // include a '(' immediately before first number
  let start = firstIdx
  while (start > 0 && /\s/.test(s[start - 1]!)) start--
  if (start > 0 && s[start - 1] === '(') start--

  let candidate = s.slice(start).trim()
  // drop trailing Chinese labels if any
  candidate = candidate.replace(/[\u4e00-\u9fff].*$/u, '').trim()
  if (candidate) return candidate

  return nums[nums.length - 1]![0]
}

export function parseLine(raw: string): ParsedLine {
  const trimmed = raw.trim()
  if (!trimmed) return { kind: 'empty' }
  if (trimmed.startsWith('//')) return { kind: 'comment' }

  // assignment on raw (name may be Chinese)
  const assignMatch = trimmed.match(ASSIGN_RE)
  if (assignMatch) {
    const name = assignMatch[1]!
    const rhsRaw = assignMatch[2]!
    const rhs = preprocess(rhsRaw)
    if (!rhs) return { kind: 'error', expr: undefined }
    return { kind: 'assign', name, expr: rhs }
  }

  const pre = preprocess(trimmed)
  if (!pre) return { kind: 'comment' }

  // line reference tokens ok in expr
  if (looksLikePureExpr(pre)) {
    // if pure Chinese without digits/ops — treat as empty/no result (label only)
    if (/^[\u4e00-\u9fffA-Za-z_][\u4e00-\u9fffA-Za-z0-9_]*$/.test(pre) && !/\d/.test(pre)) {
      // bare identifier — still an expr (variable reference)
      return { kind: 'expr', expr: pre }
    }
    if (!/[\u4e00-\u9fff]/.test(pre) || /[+\-*/^=#()]/.test(pre) || /^[A-Za-z_]/.test(pre)) {
      return { kind: 'expr', expr: pre }
    }
  }

  // mixed
  const extracted = extractMixedExpr(pre)
  if (extracted == null) {
    // no number — description only
    return { kind: 'comment' }
  }
  return { kind: 'mixed', expr: extracted }
}
