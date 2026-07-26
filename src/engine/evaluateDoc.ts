import { create, all, type MathNode } from 'mathjs'
import { parseLine } from './line'
import type { DocResult, LineResult } from './types'

const math = create(all, {
  number: 'number',
})

const MAX_LINES = 500
const MAX_LINE_LEN = 500

const IDENT_RE = /[A-Za-z_\u4e00-\u9fff][A-Za-z0-9_\u4e00-\u9fff]*/g

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** mathjs does not accept CJK identifiers — map to __v_n */
class VarTable {
  private toId = new Map<string, string>()
  private seq = 0
  /** public names → values (original names) */
  values: Record<string, number> = {}
  /** id → value for mathjs scope */
  scope: Record<string, number> = {}

  ensureId(name: string): string {
    let id = this.toId.get(name)
    if (!id) {
      // pure ascii identifiers can stay (mathjs-friendly)
      if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
        id = name
      } else {
        this.seq += 1
        id = `__v_${this.seq}`
      }
      this.toId.set(name, id)
    }
    return id
  }

  set(name: string, value: number) {
    const id = this.ensureId(name)
    this.values[name] = value
    this.scope[id] = value
  }

  /** Rewrite user expr: #n and known (and bare) identifiers */
  rewrite(expr: string): string {
    let s = expr.replace(/#(\d+)/g, (_, n: string) => `__line_${n}`)

    // longest name first
    const names = [...this.toId.keys()].sort((a, b) => b.length - a.length)
    for (const name of names) {
      const id = this.toId.get(name)!
      if (name === id) continue
      const re = new RegExp(
        `(?<![A-Za-z0-9_\\u4e00-\\u9fff])${escapeRegExp(name)}(?![A-Za-z0-9_\\u4e00-\\u9fff])`,
        'g',
      )
      s = s.replace(re, id)
    }

    // any remaining CJK/unicode idents → ensure mapping (undefined vars will fail at eval)
    s = s.replace(IDENT_RE, (tok) => {
      if (tok.startsWith('__line_') || tok.startsWith('__v_')) return tok
      if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(tok)) return tok
      return this.ensureId(tok)
    })

    return s
  }
}

function cleanNumber(n: number): number {
  // kill binary float dust from percent etc.
  const r = Math.round(n * 1e12) / 1e12
  return Object.is(r, -0) ? 0 : r
}

function evalExpr(
  expr: string,
  vars: VarTable,
): { value?: number; error?: string } {
  try {
    const rewritten = vars.rewrite(expr)
    const node: MathNode = math.parse(rewritten)
    const raw = node.evaluate(vars.scope)
    const num = typeof raw === 'number' ? raw : Number(raw)
    if (!Number.isFinite(num)) {
      return { error: '结果不是有效数字' }
    }
    return { value: cleanNumber(num) }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { error: msg }
  }
}

export function evaluateDoc(text: string): DocResult {
  const rawLines = text.split('\n').slice(0, MAX_LINES)
  const vars = new VarTable()
  const lines: LineResult[] = []

  for (let i = 0; i < rawLines.length; i++) {
    let raw = rawLines[i] ?? ''
    if (raw.length > MAX_LINE_LEN) raw = raw.slice(0, MAX_LINE_LEN)

    const parsed = parseLine(raw)
    const lineNo = i + 1
    const base: LineResult = { raw, kind: parsed.kind }

    if (parsed.kind === 'empty' || parsed.kind === 'comment') {
      lines.push(base)
      continue
    }

    if (!parsed.expr) {
      lines.push({ ...base, kind: 'error', error: '无法解析' })
      continue
    }

    const refs = [...parsed.expr.matchAll(/#(\d+)/g)]
    let refError: string | undefined
    for (const m of refs) {
      const refN = Number(m[1])
      if (refN < 1 || refN >= lineNo) {
        refError = `只能引用更小行号（#${refN}）`
        break
      }
      if (vars.scope[`__line_${refN}`] === undefined) {
        refError = `#${refN} 无有效结果`
        break
      }
    }
    if (refError) {
      lines.push({
        ...base,
        kind: 'error',
        expr: parsed.expr,
        name: parsed.name,
        error: refError,
      })
      continue
    }

    if (parsed.kind === 'assign' && parsed.name) {
      const { value, error } = evalExpr(parsed.expr, vars)
      if (error != null || value === undefined) {
        lines.push({
          ...base,
          kind: 'error',
          name: parsed.name,
          expr: parsed.expr,
          error: error ?? '求值失败',
        })
        continue
      }
      vars.set(parsed.name, value)
      vars.scope[`__line_${lineNo}`] = value
      lines.push({
        ...base,
        kind: 'assign',
        name: parsed.name,
        expr: parsed.expr,
        value,
      })
      continue
    }

    const { value, error } = evalExpr(parsed.expr, vars)
    if (error != null || value === undefined) {
      lines.push({
        ...base,
        kind: 'error',
        expr: parsed.expr,
        error: error ?? '求值失败',
      })
      continue
    }
    vars.scope[`__line_${lineNo}`] = value
    lines.push({
      ...base,
      kind: parsed.kind === 'mixed' ? 'mixed' : 'expr',
      expr: parsed.expr,
      value,
    })
  }

  let total = 0
  for (const line of lines) {
    if (typeof line.value === 'number' && Number.isFinite(line.value)) {
      total += line.value
    }
  }

  return { lines, total, variables: { ...vars.values } }
}
