/**
 * 日期/时间计算支持
 * 
 * 语法：
 * - 今天、明天、昨天
 * - 下周一、下周二...下周日
 * - 上周一、上周二...上周日
 * - 2026-08-01、2026/08/01
 * - 今天 + 30天、明天 - 7天
 * - 2026-08-01 - 今天（天数差）
 */

// 基准日期：2000-01-01
const EPOCH = new Date(2000, 0, 1)

/** 日期转天数（从 2000-01-01 开始） */
export function dateToDays(date: Date): number {
  const diff = date.getTime() - EPOCH.getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

/** 天数转日期 */
export function daysToDate(days: number): Date {
  return new Date(EPOCH.getTime() + days * 1000 * 60 * 60 * 24)
}

/** 格式化日期为 YYYY-MM-DD */
export function formatDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** 获取今天的日期（无时分秒） */
function getToday(): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

/** 获取指定 weekday 的日期（0=周日, 1=周一...6=周六） */
function getWeekday(weekday: number, offset: 'next' | 'prev'): Date {
  const today = getToday()
  const currentDay = today.getDay()
  let diff: number
  
  if (offset === 'next') {
    diff = weekday - currentDay
    if (diff <= 0) diff += 7
  } else {
    diff = currentDay - weekday
    if (diff <= 0) diff += 7
  }
  
  const target = new Date(today)
  target.setDate(today.getDate() + (offset === 'next' ? diff : -diff))
  return target
}

const WEEKDAY_MAP: Record<string, number> = {
  '日': 0, '天': 0,
  '一': 1, '二': 2, '三': 3, '四': 4,
  '五': 5, '六': 6
}

/** 预处理日期关键词 → 天数 */
export function preprocessDate(input: string): { text: string; isDate: boolean } {
  let s = input
  let isDate = false
  
  // 今天、明天、昨天
  if (/今天/.test(s)) {
    s = s.replace(/今天/g, String(dateToDays(getToday())))
    isDate = true
  }
  if (/明天/.test(s)) {
    const tomorrow = new Date(getToday())
    tomorrow.setDate(tomorrow.getDate() + 1)
    s = s.replace(/明天/g, String(dateToDays(tomorrow)))
    isDate = true
  }
  if (/昨天/.test(s)) {
    const yesterday = new Date(getToday())
    yesterday.setDate(yesterday.getDate() - 1)
    s = s.replace(/昨天/g, String(dateToDays(yesterday)))
    isDate = true
  }
  
  // 下周X、上周X
  s = s.replace(/下周([日天一二三四五六])/g, (_, w: string) => {
    const d = getWeekday(WEEKDAY_MAP[w]!, 'next')
    isDate = true
    return String(dateToDays(d))
  })
  s = s.replace(/上周([日天一二三四五六])/g, (_, w: string) => {
    const d = getWeekday(WEEKDAY_MAP[w]!, 'prev')
    isDate = true
    return String(dateToDays(d))
  })
  
  // ISO 日期：2026-08-01 或 2026/08/01
  s = s.replace(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/g, (_, y: string, m: string, d: string) => {
    const date = new Date(Number(y), Number(m) - 1, Number(d))
    if (isNaN(date.getTime())) return _
    isDate = true
    return String(dateToDays(date))
  })
  
  // N天后、N天前
  s = s.replace(/(\d+)\s*天后/g, (_, n: string) => {
    const d = new Date(getToday())
    d.setDate(d.getDate() + Number(n))
    isDate = true
    return String(dateToDays(d))
  })
  s = s.replace(/(\d+)\s*天前/g, (_, n: string) => {
    const d = new Date(getToday())
    d.setDate(d.getDate() - Number(n))
    isDate = true
    return String(dateToDays(d))
  })
  
  return { text: s, isDate }
}

/** 判断天数是否在合理日期范围内（2000-01-01 到 2100-01-01） */
export function isReasonableDate(days: number): boolean {
  return days >= 0 && days <= 36500 // 约 100 年
}

/** 判断是否为日期运算（包含日期关键词或 ISO 日期） */
export function looksLikeDateExpr(input: string): boolean {
  return /今天|明天|昨天|下周|上周|\d{4}[-/]\d{1,2}[-/]\d{1,2}|天后|天前/.test(input)
}

/** 判断是否为日期差运算（两个日期相减） */
export function isDateDiffExpr(input: string): boolean {
  // 如果包含两个日期关键词，且中间有减号
  const dateKeywords = (input.match(/今天|明天|昨天|下周[日天一二三四五六]|上周[日天一二三四五六]|\d{4}[-/]\d{1,2}[-/]\d{1,2}/g) || []).length
  return dateKeywords >= 2 && /-/.test(input)
}
