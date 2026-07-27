import { describe, it, expect } from 'vitest'
import {
  dateToDays,
  daysToDate,
  formatDate,
  preprocessDate,
  looksLikeDateExpr,
  isDateDiffExpr,
} from '../datetime'

describe('datetime utilities', () => {
  it('converts date to days and back', () => {
    const date = new Date(2026, 6, 27) // 2026-07-27
    const days = dateToDays(date)
    const back = daysToDate(days)
    expect(formatDate(back)).toBe('2026-07-27')
  })

  it('preprocesses 今天', () => {
    const { text, isDate } = preprocessDate('今天')
    expect(isDate).toBe(true)
    const days = Number(text)
    const date = daysToDate(days)
    const today = new Date()
    expect(date.getFullYear()).toBe(today.getFullYear())
    expect(date.getMonth()).toBe(today.getMonth())
    expect(date.getDate()).toBe(today.getDate())
  })

  it('preprocesses 明天', () => {
    const { text, isDate } = preprocessDate('明天')
    expect(isDate).toBe(true)
    const days = Number(text)
    const date = daysToDate(days)
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    expect(date.getDate()).toBe(tomorrow.getDate())
  })

  it('preprocesses 昨天', () => {
    const { text, isDate } = preprocessDate('昨天')
    expect(isDate).toBe(true)
    const days = Number(text)
    const date = daysToDate(days)
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    expect(date.getDate()).toBe(yesterday.getDate())
  })

  it('preprocesses 今天 + 30天', () => {
    const { text, isDate } = preprocessDate('今天 + 30天')
    expect(isDate).toBe(true)
    // Should contain a number (days) + 30
    expect(text).toMatch(/\d+ \+ 30/)
  })

  it('preprocesses ISO date 2026-08-01', () => {
    const { text, isDate } = preprocessDate('2026-08-01')
    expect(isDate).toBe(true)
    const days = Number(text)
    const date = daysToDate(days)
    expect(formatDate(date)).toBe('2026-08-01')
  })

  it('preprocesses ISO date 2026/08/01', () => {
    const { text, isDate } = preprocessDate('2026/08/01')
    expect(isDate).toBe(true)
    const days = Number(text)
    const date = daysToDate(days)
    expect(formatDate(date)).toBe('2026-08-01')
  })

  it('detects date expressions', () => {
    expect(looksLikeDateExpr('今天 + 30天')).toBe(true)
    expect(looksLikeDateExpr('2026-08-01 - 今天')).toBe(true)
    expect(looksLikeDateExpr('100 + 200')).toBe(false)
  })

  it('detects date diff expressions', () => {
    expect(isDateDiffExpr('2026-08-01 - 今天')).toBe(true)
    expect(isDateDiffExpr('今天 + 30天')).toBe(false)
  })

  it('preprocesses N天后', () => {
    const { text, isDate } = preprocessDate('30天后')
    expect(isDate).toBe(true)
    const days = Number(text)
    const date = daysToDate(days)
    const future = new Date()
    future.setDate(future.getDate() + 30)
    expect(date.getDate()).toBe(future.getDate())
  })

  it('preprocesses N天前', () => {
    const { text, isDate } = preprocessDate('7天前')
    expect(isDate).toBe(true)
    const days = Number(text)
    const date = daysToDate(days)
    const past = new Date()
    past.setDate(past.getDate() - 7)
    expect(date.getDate()).toBe(past.getDate())
  })
})
