import { describe, expect, it, vi, beforeEach } from 'vitest'
import { parseCurrencyExpr, convertCurrencySync, getRateSync } from '../currency'
import { evaluateDoc } from '../evaluateDoc'

describe('parseCurrencyExpr', () => {
  it('parses $100 in CNY', () => {
    const result = parseCurrencyExpr('$100 in CNY')
    expect(result).toEqual({
      type: 'convert',
      amount: 100,
      from: 'USD',
      to: 'CNY'
    })
  })

  it('parses €50 to ¥', () => {
    const result = parseCurrencyExpr('€50 to ¥')
    expect(result).toEqual({
      type: 'convert',
      amount: 50,
      from: 'EUR',
      to: 'CNY'
    })
  })

  it('parses 100 USD to CNY', () => {
    const result = parseCurrencyExpr('100 USD to CNY')
    expect(result).toEqual({
      type: 'convert',
      amount: 100,
      from: 'USD',
      to: 'CNY'
    })
  })

  it('parses 汇率 USD CNY', () => {
    const result = parseCurrencyExpr('汇率 USD CNY')
    expect(result).toEqual({
      type: 'rate',
      from: 'USD',
      to: 'CNY'
    })
  })

  it('returns null for non-currency expression', () => {
    expect(parseCurrencyExpr('100 + 200')).toBeNull()
    expect(parseCurrencyExpr('单价 = 89')).toBeNull()
  })
})

describe('currency sync functions', () => {
  beforeEach(() => {
    // Mock localStorage
    const store: Record<string, string> = {}
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, value: string) => { store[key] = value },
      removeItem: (key: string) => { delete store[key] },
      clear: () => { Object.keys(store).forEach(k => delete store[k]) }
    })
  })

  it('convertCurrencySync uses default rates when no cache', () => {
    const result = convertCurrencySync(100, 'USD', 'CNY')
    expect(result).toBe(720) // 默认汇率 7.2
  })

  it('getRateSync uses default rates when no cache', () => {
    const result = getRateSync('USD', 'CNY')
    expect(result).toBe(7.2) // 默认汇率
  })

  it('convertCurrencySync uses cached rates', () => {
    // Manually set cache
    const cachedRates = {
      base: 'USD',
      rates: { CNY: 7.2345, EUR: 0.92 },
      lastUpdate: Date.now()
    }
    localStorage.setItem('suanzhi.currency.rates', JSON.stringify(cachedRates))

    const result = convertCurrencySync(100, 'USD', 'CNY')
    expect(result).toBeCloseTo(723.45, 2)
  })

  it('getRateSync uses cached rates', () => {
    const cachedRates = {
      base: 'USD',
      rates: { CNY: 7.2345, EUR: 0.92 },
      lastUpdate: Date.now()
    }
    localStorage.setItem('suanzhi.currency.rates', JSON.stringify(cachedRates))

    const result = getRateSync('USD', 'CNY')
    expect(result).toBeCloseTo(7.2345, 4)
  })
})

describe('evaluateDoc with currency', () => {
  beforeEach(() => {
    const store: Record<string, string> = {}
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, value: string) => { store[key] = value },
      removeItem: (key: string) => { delete store[key] },
      clear: () => { Object.keys(store).forEach(k => delete store[k]) }
    })
  })

  it('evaluates currency expression with cache', () => {
    const cachedRates = {
      base: 'USD',
      rates: { CNY: 7.2345, EUR: 0.92 },
      lastUpdate: Date.now()
    }
    localStorage.setItem('suanzhi.currency.rates', JSON.stringify(cachedRates))

    const result = evaluateDoc('$100 in CNY')
    expect(result.lines[0]?.value).toBeCloseTo(723.45, 2)
    expect(result.lines[0]?.isCurrency).toBe(true)
    expect(result.lines[0]?.currencyCode).toBe('CNY')
  })

  it('converts with default rates when no cache', () => {
    const result = evaluateDoc('$100 in CNY')
    expect(result.lines[0]?.kind).toBe('expr')
    expect(result.lines[0]?.value).toBe(720) // 100 * 7.2
  })

  it('evaluates rate query', () => {
    const cachedRates = {
      base: 'USD',
      rates: { CNY: 7.2345 },
      lastUpdate: Date.now()
    }
    localStorage.setItem('suanzhi.currency.rates', JSON.stringify(cachedRates))

    const result = evaluateDoc('汇率 USD CNY')
    expect(result.lines[0]?.value).toBeCloseTo(7.2345, 4)
    expect(result.lines[0]?.isCurrency).toBe(true)
  })

  it('currency line can be referenced', () => {
    const cachedRates = {
      base: 'USD',
      rates: { CNY: 7.2345 },
      lastUpdate: Date.now()
    }
    localStorage.setItem('suanzhi.currency.rates', JSON.stringify(cachedRates))

    const result = evaluateDoc('$100 in CNY\n#1 * 2')
    expect(result.lines[0]?.value).toBeCloseTo(723.45, 2)
    expect(result.lines[1]?.value).toBeCloseTo(1446.9, 1)
  })
})
