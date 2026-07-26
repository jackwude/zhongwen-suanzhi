import { describe, expect, it } from 'vitest'
import { extractMixedExpr, parseLine, stripExcludePrefix } from '../line'

describe('parseLine', () => {
  it('empty and comment', () => {
    expect(parseLine('').kind).toBe('empty')
    expect(parseLine('   ').kind).toBe('empty')
    expect(parseLine('// 备注').kind).toBe('comment')
  })

  it('assignment', () => {
    const p = parseLine('单价 = 89')
    expect(p.kind).toBe('assign')
    expect(p.name).toBe('单价')
    expect(p.expr).toBe('89')
  })

  it('exclude prefix', () => {
    const p = parseLine('!单价 = 89')
    expect(p.excludeFromTotal).toBe(true)
    expect(p.kind).toBe('assign')
    expect(p.name).toBe('单价')
  })

  it('pure expr', () => {
    const p = parseLine('1+2*3')
    expect(p.kind).toBe('expr')
    expect(p.expr).toBe('1+2*3')
  })

  it('mixed single number', () => {
    const p = parseLine('蒸蒸日上 128')
    expect(p.kind).toBe('mixed')
    expect(p.expr).toBe('128')
  })

  it('mixed last number', () => {
    const p = parseLine('锅边馍 小 15')
    expect(p.kind).toBe('mixed')
    expect(p.expr).toBe('15')
  })
})

describe('stripExcludePrefix', () => {
  it('works', () => {
    expect(stripExcludePrefix('! 12').excludeFromTotal).toBe(true)
    expect(stripExcludePrefix('! 12').text).toBe('12')
  })
})

describe('extractMixedExpr', () => {
  it('last of multiple nums without ops', () => {
    expect(extractMixedExpr('小 1 15')).toBe('15')
  })
})
