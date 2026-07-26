import { create, all, type MathNode } from 'mathjs'
import Decimal from 'decimal.js'
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

function cleanNumber(n: number): number {
  // prefer decimal rounding to 12 dp then number
  try {
    const d = new Decimal(n)
    const r = d.toDecimalPlaces(12, Decimal.ROUND_HALF_UP).toNumber()
    return Object.is(r, -0) ? 0 : r
  } catch {
    const r = Math.round(n * 1e12) / 1e12
    return Object.is(r, -0) ? 0 : r
  }
}

class VarTable {
  private toId = new Map<string, string>()
  private seq = 0
  values: Record<string, number> = {}
  scope: Record<string, number> = {}

  ensureId(name: string): string {
    let id = this.toId.get(name)
    if (!id) {
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

  rewrite(expr: string, prevLineNo: number | null): string {
    let s = expr
    // 上一行
    if (s.includes('#__prev__')) {
      if (prevLineNo == null) {
        throw new Error('没有上一行可引用')
      }
      s = s.replace(/#__prev__/g, `__line_${prevLineNo}`)
    }
    s = s.replace(/#(\d+)/g, (_, n: string) => `__line_${n}`)

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

    s = s.replace(IDENT_RE, (tok) => {
      if (tok.startsWith('__line_') || tok.startsWith('__v_')) return tok
      if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(tok)) return tok
      return this.ensureId(tok)
    })

    return s
  }
}

function evalExpr(
  expr: string,
  vars: VarTable,
  prevLineNo: number | null,
): { value?: number; error?: string } {
  try {
    const rewritten = vars.rewrite(expr, prevLineNo)
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

function findPrevValueLine(lines: LineResult[], beforeIndex: number): number | null {
  for (let j = beforeIndex - 1; j >= 0; j--) {
    if (typeof lines[j]?.value === 'number') return j + 1 // 1-based
  }
  return null
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
    const prevLineNo = findPrevValueLine(lines, i)
    const base: LineResult = {
      raw,
      kind: parsed.kind,
      excludeFromTotal: parsed.excludeFromTotal,
    }

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
    if (parsed.expr.includes('#__prev__') && prevLineNo == null) {
      refError = '没有上一行可引用'
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
      const { value, error } = evalExpr(parsed.expr, vars, prevLineNo)
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

    const { value, error } = evalExpr(parsed.expr, vars, prevLineNo)
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
  let totalAll = 0
  for (const line of lines) {
    if (typeof line.value === 'number' && Number.isFinite(line.value)) {
      totalAll = cleanNumber(totalAll + line.value)
      if (!line.excludeFromTotal) {
        total = cleanNumber(total + line.value)
      }
    }
  }

  return { lines, total, totalAll, variables: { ...vars.values } }
}

/** Export plain text with answers for sharing */
export function exportWithAnswers(text: string): string {
  const r = evaluateDoc(text)
  const out: string[] = []
  for (const line of r.lines) {
    if (line.kind === 'empty') {
      out.push('')
      continue
    }
    if (typeof line.value === 'number') {
      const mark = line.excludeFromTotal ? ' ·' : ''
      out.push(`${line.raw}  →  ${line.value}${mark}`)
    } else if (line.kind === 'error') {
      out.push(`${line.raw}  →  错误: ${line.error ?? ''}`)
    } else {
      out.push(line.raw)
    }
  }
  out.push('')
  out.push(`总计 ${r.total}`)
  return out.join('\n')
}
