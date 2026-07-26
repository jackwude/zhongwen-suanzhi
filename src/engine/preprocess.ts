/**
 * Chinese / natural-language normalization → standard expression fragments.
 * Pure string transforms; no mathjs.
 */

const CN_DIGIT: Record<string, string> = {
  零: '0',
  一: '1',
  二: '2',
  两: '2',
  三: '3',
  四: '4',
  五: '5',
  六: '6',
  七: '7',
  八: '8',
  九: '9',
}

/** 中文小写数字 → 阿拉伯（仅个位，用于折扣） */
function cnDigitToArabic(s: string): string {
  return s.replace(/[零一二两三四五六七八九]/g, (ch) => CN_DIGIT[ch] ?? ch)
}

/** N折 / 打N折 → *(N/10)；支持打八折 */
function replaceDiscount(input: string): string {
  let s = input
  s = s.replace(/打\s*([零一二两三四五六七八九]+|\d+(?:\.\d+)?)\s*折/g, (_, n: string) => {
    const arabic = cnDigitToArabic(n)
    return `*( ${arabic} / 10 )`
  })
  s = s.replace(
    /(?<![.\d\u4e00-\u9fff])([零一二两三四五六七八九]+|\d+(?:\.\d+)?)\s*折/g,
    (_, n: string) => {
      const arabic = cnDigitToArabic(n)
      return `*( ${arabic} / 10 )`
    },
  )
  return s
}

/** 万 / 亿 */
function replaceChineseMagnitude(input: string): string {
  let s = input
  s = s.replace(/(\d+(?:\.\d+)?)\s*万/g, '($1*10000)')
  s = s.replace(/(\d+(?:\.\d+)?)\s*亿/g, '($1*100000000)')
  return s
}

/** Left operand before +/- percent: number, ), or identifier */
const LEFT_OP =
  '(?:\\d+(?:\\.\\d+)?|\\)|[A-Za-z_\\u4e00-\\u9fff][A-Za-z0-9_\\u4e00-\\u9fff]*)'

/**
 * Percent rewrite (product-locked):
 *   a + n% → a * (1 + n/100)
 *   a - n% → a * (1 - n/100)
 *   bare n% → (n/100)  so a * n% works
 */
function replacePercent(input: string): string {
  let s = input
  s = s.replace(
    new RegExp(`(${LEFT_OP})\\s*\\+\\s*(\\d+(?:\\.\\d+)?)\\s*%`, 'g'),
    '($1*(1+$2/100))',
  )
  s = s.replace(
    new RegExp(`(${LEFT_OP})\\s*-\\s*(\\d+(?:\\.\\d+)?)\\s*%`, 'g'),
    '($1*(1-$2/100))',
  )
  // remaining standalone n%
  s = s.replace(/(\d+(?:\.\d+)?)\s*%/g, '($1/100)')
  return s
}

/** Remove thousand separators in numbers: 3,000 → 3000 */
function stripThousands(input: string): string {
  return input.replace(/(\d),(\d{3})/g, '$1$2').replace(/(\d),(\d{3})/g, '$1$2')
}

function insertImplicitMul(input: string): string {
  let s = input.replace(/(\d+(?:\.\d+)?)\s+\*\s*\(/g, '$1*(')
  s = s.replace(/(\d+(?:\.\d+)?|\))\s+(\*\s*\()/g, '$1$2')
  s = s.replace(/(\d+(?:\.\d+)?|\))\s+\*/g, '$1*')
  return s
}

export function preprocess(input: string): string {
  let s = input.trim()
  if (!s) return s
  const commentIdx = s.indexOf('//')
  if (commentIdx >= 0) {
    s = s.slice(0, commentIdx).trim()
  }
  if (!s) return s

  s = stripThousands(s)
  s = replaceChineseMagnitude(s)
  s = replaceDiscount(s)
  s = insertImplicitMul(s)
  s = replacePercent(s)
  s = s.replace(/\s+/g, ' ').trim()
  return s
}
