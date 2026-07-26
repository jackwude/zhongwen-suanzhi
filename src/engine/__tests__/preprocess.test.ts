import { describe, expect, it } from 'vitest'
import { preprocess } from '../preprocess'

describe('preprocess', () => {
  it('万 / 亿', () => {
    expect(preprocess('3万')).toBe('(3*10000)')
    expect(preprocess('1.2亿')).toBe('(1.2*100000000)')
  })

  it('打N折 / N折', () => {
    expect(preprocess('打八折').replace(/\s/g, '')).toBe('*(8/10)')
    expect(preprocess('打8折').replace(/\s/g, '')).toBe('*(8/10)')
    expect(preprocess('8折').replace(/\s/g, '')).toBe('*(8/10)')
    expect(preprocess('8.5折').replace(/\s/g, '')).toBe('*(8.5/10)')
  })

  it('100 打八折', () => {
    const p = preprocess('100 打八折').replace(/\s/g, '')
    expect(p).toBe('100*(8/10)')
  })

  it('100 打8折', () => {
    const p = preprocess('100 打8折').replace(/\s/g, '')
    expect(p).toBe('100*(8/10)')
  })

  it('percent a+n% and a*n%', () => {
    expect(preprocess('50 + 10%').replace(/\s/g, '')).toBe('(50*(1+10/100))')
    expect(preprocess('50 * 10%').replace(/\s/g, '')).toBe('50*(10/100)')
  })

  it('strips trailing comment', () => {
    expect(preprocess('1+2 // hi')).toBe('1+2')
  })

  it('thousand separators', () => {
    expect(preprocess('3,000')).toBe('3000')
  })
})
