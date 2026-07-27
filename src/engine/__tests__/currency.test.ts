import { describe, it, expect } from 'vitest'
import { parseCurrencyExpr } from '../currency'

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

  it('returns null for non-currency expressions', () => {
    expect(parseCurrencyExpr('100 + 200')).toBeNull()
    expect(parseCurrencyExpr('今天 + 30天')).toBeNull()
  })
})
