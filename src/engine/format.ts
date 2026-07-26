/** Display formatting for answer column */
export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return '—'
  if (Object.is(n, -0)) return '0'
  // integers
  if (Number.isInteger(n)) return String(n)
  // max 6 decimal places, strip trailing zeros
  let s = n.toFixed(6)
  s = s.replace(/\.?0+$/, '')
  return s
}

export function formatTotal(n: number): string {
  return formatNumber(n)
}
