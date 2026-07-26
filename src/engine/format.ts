import Decimal from 'decimal.js'

export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return '—'
  if (Object.is(n, -0)) return '0'
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
