import { preprocessDate } from './datetime'

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

function cnDigitToArabic(s: string): string {
  return s.replace(/[零一二两三四五六七八九]/g, (ch) => CN_DIGIT[ch] ?? ch)
}

/** N折 / 打N折 → *(N/10)；支持打八折 */
function replaceDiscount(input: string): string {
  let s = input
  s = s.replace(/打\s*([零一二两三四五六七八九]+|\d+(?:\.\d+)?)\s*折/g, (_, n: string) => {
    return `*( ${cnDigitToArabic(n)} / 10 )`
  })
  s = s.replace(
    /(?<![.\d\u4e00-\u9fff])([零一二两三四五六七八九]+|\d+(?:\.\d+)?)\s*折/g,
    (_, n: string) => `*( ${cnDigitToArabic(n)} / 10 )`,
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

/**
 * 国内常用单位 → 数值（基础量纲简化为数字，便于总计）
 * 斤→500g 数值用克；亩→㎡；公里→米
 */
function replaceUnits(input: string): string {
  let s = input
  s = s.replace(/(\d+(?:\.\d+)?)\s*公里/g, '($1*1000)')
  s = s.replace(/(\d+(?:\.\d+)?)\s*千克/g, '($1*1000)')
  s = s.replace(/(\d+(?:\.\d+)?)\s*公斤/g, '($1*1000)')
  s = s.replace(/(\d+(?:\.\d+)?)\s*斤/g, '($1*500)')
  s = s.replace(/(\d+(?:\.\d+)?)\s*两/g, '($1*50)')
  s = s.replace(/(\d+(?:\.\d+)?)\s*亩/g, '($1*666.67)')
  s = s.replace(/(\d+(?:\.\d+)?)\s*平方米/g, '($1)')
  s = s.replace(/(\d+(?:\.\d+)?)\s*㎡/g, '($1)')
  s = s.replace(/(\d+(?:\.\d+)?)\s*米(?![%a-zA-Z\u4e00-\u9fff])/g, '($1)')
  s = s.replace(/(\d+(?:\.\d+)?)\s*厘米/g, '($1*0.01)')
  return s
}

/**
 * 满减：`500 满300减50` → (500>=300?500-50:500)
 * 也支持无空格 `500满300减50`
 */
function replaceManjian(input: string): string {
  return input.replace(
    /(\d+(?:\.\d+)?|\))\s*满\s*(\d+(?:\.\d+)?)\s*减\s*(\d+(?:\.\d+)?)/g,
    '(($1>=$2)?($1-$3):$1)',
  )
}

/** 第二件半价：`单价 第二件半价` 按两件均价 → 单价 * 0.75（两件付 1.5 件价 / 2）
 *  产品写死：结果 = 单价 * 1.5 / 2 = 单价 * 0.75（单件均价）
 *  若要两件总价用 `*2` 自行乘。这里输出均价系数更直观用于「一件标价」。
 *  更好语义：`x 第二件半价` → 两件合计 = x + x*0.5 = 1.5x
 */
function replaceSecondHalf(input: string): string {
  return input.replace(
    /(\d+(?:\.\d+)?|\))\s*第二件半价/g,
    '($1*1.5)',
  )
}

const LEFT_OP =
  '(?:\\d+(?:\\.\\d+)?|\\)|[A-Za-z_\\u4e00-\\u9fff][A-Za-z0-9_\\u4e00-\\u9fff]*)'

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
  s = s.replace(/(\d+(?:\.\d+)?)\s*%/g, '($1/100)')
  return s
}

function stripThousands(input: string): string {
  return input.replace(/(\d),(\d{3})/g, '$1$2').replace(/(\d),(\d{3})/g, '$1$2')
}

function insertImplicitMul(input: string): string {
  let s = input.replace(/(\d+(?:\.\d+)?)\s+\*\s*\(/g, '$1*(')
  s = s.replace(/(\d+(?:\.\d+)?|\))\s+(\*\s*\()/g, '$1$2')
  s = s.replace(/(\d+(?:\.\d+)?|\))\s+\*/g, '$1*')
  return s
}

/** 上一行 → #__prev__ placeholder, resolved in evaluator */
function replacePrevLine(input: string): string {
  return input.replace(/上一行/g, '#__prev__')
}

export function preprocess(input: string): string {
  let s = input.trim()
  if (!s) return s
  const commentIdx = s.indexOf('//')
  if (commentIdx >= 0) {
    s = s.slice(0, commentIdx).trim()
  }
  if (!s) return s

  // 日期预处理（今天、明天、2026-08-01 等）
  const dateResult = preprocessDate(s)
  s = dateResult.text

  s = stripThousands(s)
  s = replacePrevLine(s)
  s = replaceChineseMagnitude(s)
  s = replaceUnits(s)
  s = replaceManjian(s)
  s = replaceSecondHalf(s)
  s = replaceDiscount(s)
  s = insertImplicitMul(s)
  s = replacePercent(s)
  s = s.replace(/\s+/g, ' ').trim()
  return s
}
