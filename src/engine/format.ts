import Decimal from 'decimal.js'
import { daysToDate, formatDate } from './datetime'

export function formatNumber(n: number, isDate?: boolean): string {
  if (!Number.isFinite(n)) return '—'
  if (Object.is(n, -0)) return '0'
  
  // 日期结果：转为 YYYY-MM-DD
  if (isDate && Number.isInteger(n) && n >= 0 && n <= 36500) {
    const date = daysToDate(n)
    return formatDate(date)
  }
  
  try {
    const d = new Decimal(n)
    if (d.isInteger()) return d.toFixed(0)
    // up to 6 dp, trim zeros
    let s = d.toDecimalPlaces(6, Decimal.ROUND_HALF_UP).toFixed(6)
    s = s.replace(/\.?0+$/, '')
    return s
  } catch {
    if (Number.isInteger(n)) return String(n)
    let s = n.toFixed(6)
    s = s.replace(/\.?0+$/, '')
    return s
  }
}

export function formatTotal(n: number): string {
  return formatNumber(n)
}
